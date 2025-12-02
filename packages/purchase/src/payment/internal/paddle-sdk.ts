import * as FetchHttpClient from '@effect/platform/FetchHttpClient'
import * as HttpBody from '@effect/platform/HttpBody'
import * as HttpClient from '@effect/platform/HttpClient'
import * as HttpClientError from '@effect/platform/HttpClientError'
import * as HttpClientRequest from '@effect/platform/HttpClientRequest'
import * as HttpClientResponse from '@effect/platform/HttpClientResponse'
import {
  PaddleCustomer,
  PaddlePrice,
  PaddleProduct,
  PaddleSubscription,
  PaddleTransaction,
} from '@xstack/purchase/payment/internal/paddle-schema'
import { CustomerAlreadyExistsError, CustomerNotFoundError, WebhookUnmarshalError } from '@xstack/purchase/schema'
import type { IEvents } from '@paddle/paddle-node-sdk'
import * as Config from 'effect/Config'
import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import * as Option from 'effect/Option'
import * as Redacted from 'effect/Redacted'
import * as Schema from 'effect/Schema'

const PaddleConfig_ = Config.all({
  apiToken: Config.redacted('PADDLE_API_TOKEN').pipe(Config.withDefault(Redacted.make(''))),
  webhookToken: Config.redacted('PADDLE_WEBHOOK_TOKEN').pipe(Config.withDefault(Redacted.make(''))),
  environment: Config.literal('sandbox', 'production')('PADDLE_ENVIRONMENT').pipe(Config.withDefault('sandbox')),
})
export type PaddleConfig = Config.Config.Success<typeof PaddleConfig_>
export const PaddleConfig = Context.GenericTag<PaddleConfig>('@purchase:payment-paddle-config')

export const PaddleConfigFromEnv = Layer.effect(PaddleConfig, PaddleConfig_)

export const PaddleConfigFromRecord = (config: PaddleConfig) => Layer.succeed(PaddleConfig, config)

class ProductNotFoundError extends Schema.TaggedError<ProductNotFoundError>()('ProductNotFoundError', {
  productId: Schema.String,
}) {}

class PriceNotFoundError extends Schema.TaggedError<PriceNotFoundError>()('PriceNotFoundError', {
  priceId: Schema.String,
}) {}

class TransactionNotFoundError extends Schema.TaggedError<TransactionNotFoundError>()('TransactionNotFoundError', {
  transactionId: Schema.String,
}) {}

class SubscriptionNotFoundError extends Schema.TaggedError<SubscriptionNotFoundError>()('SubscriptionNotFoundError', {
  subscriptionId: Schema.String,
}) {}

const PaddleError = Schema.Struct({
  error: Schema.Struct({
    type: Schema.Literal('request_error', 'api_error'),
    code: Schema.String,
    detail: Schema.String,
    documentation_url: Schema.String,
  }),
})

export class PaddleSdk extends Effect.Service<PaddleSdk>()('PaddleSdk', {
  effect: Effect.gen(function* () {
    const config = yield* PaddleConfig
    const { apiToken, environment } = config

    const apiUrl = environment === 'sandbox' ? 'https://sandbox-api.paddle.com' : 'https://api.paddle.com'

    const client = (yield* HttpClient.HttpClient.pipe(Effect.provide(FetchHttpClient.layer))).pipe(
      HttpClient.mapRequest((request) =>
        request.pipe(
          HttpClientRequest.prependUrl(apiUrl),
          HttpClientRequest.bearerToken(Redacted.value(apiToken)),
          HttpClientRequest.acceptJson,
        ),
      ),
    )

    const unexpectedStatus = (
      request: HttpClientRequest.HttpClientRequest,
      response: HttpClientResponse.HttpClientResponse,
    ) =>
      Effect.flatMap(
        Effect.all([
          Effect.orElseSucceed(response.text, () => 'Unexpected status code'),
          Effect.orElseSucceed(Schema.decodeUnknown(PaddleError)(response.json), () => {}),
        ]),
        ([description, json]) =>
          Effect.fail(
            new HttpClientError.ResponseError({
              request,
              response,
              reason: 'StatusCode',
              description: json ? json.error.detail : description,
              cause: json ? json.error : undefined,
            }),
          ),
      )

    const clientOK = HttpClient.filterOrElse(
      client,
      (self) => {
        return self.status >= 200 && self.status < 300
      },
      (response) => unexpectedStatus(response.request, response),
    )

    const prices = {
      list: Effect.fn(function* (
        args: {
          recurring?: boolean | undefined
          status?: string[] | undefined
          productId?: string[] | undefined
          type?: string[] | undefined
          after?: string | undefined
          perPage?: number | undefined
        } = {},
      ) {
        const status = args.status ?? ['active', 'archived']
        const res = yield* clientOK.get('/prices', {
          urlParams: {
            recurring: args.recurring,
            after: args.after,
            status,
            product_id: args.productId,
            per_page: args.perPage,
          },
        })

        const result = yield* pipe(
          res,
          HttpClientResponse.schemaBodyJson(Schema.Struct({ data: Schema.Array(PaddlePrice) })),
          Effect.map(({ data }) => data),
          Effect.catchTag('ParseError', Effect.die),
        )

        return result
      }),
      get: Effect.fn(function* (args: { priceId: string }) {
        const res = yield* client.get(`/prices/${args.priceId}`)

        const result = yield* pipe(
          res,
          HttpClientResponse.matchStatus({
            200: (response) => HttpClientResponse.schemaBodyJson(Schema.Struct({ data: PaddlePrice }))(response),
            404: (response) => Effect.fail(new PriceNotFoundError({ priceId: response.request.url })),
            orElse: (response) => unexpectedStatus(response.request, response),
          }),
          Effect.map(({ data }) => Option.fromNullable(data)),
          Effect.catchTags({
            ParseError: Effect.die,
            PriceNotFoundError: () => Effect.succeed(Option.none<PaddlePrice>()),
          }),
        )

        return result
      }),
    }

    const products = {
      list: Effect.fn(function* (
        args: {
          after?: string | undefined
          status?: string[] | undefined
          perPage?: number | undefined
          orderBy?: string | undefined
        } = {},
      ) {
        const res = yield* clientOK.get('/products', {
          urlParams: {
            status: args.status,
            after: args.after,
            per_page: args.perPage,
            order_by: args.orderBy,
          },
        })

        const result = yield* pipe(
          res,
          HttpClientResponse.schemaBodyJson(
            Schema.Struct({
              data: Schema.Array(PaddleProduct),
            }),
          ),
          Effect.map(({ data }) => data),
          Effect.catchTag('ParseError', Effect.die),
        )

        return result
      }),

      get: Effect.fn(function* (args: { productId: string }) {
        const res = yield* client.get(`/products/${args.productId}`)

        const result = yield* pipe(
          res,
          HttpClientResponse.matchStatus({
            200: (response) => HttpClientResponse.schemaBodyJson(Schema.Struct({ data: PaddleProduct }))(response),
            404: (response) => Effect.fail(new ProductNotFoundError({ productId: response.request.url })),
            orElse: (response) => unexpectedStatus(response.request, response),
          }),
          Effect.map(({ data }) => Option.fromNullable(data)),
          Effect.catchTags({
            ParseError: Effect.die,
            ProductNotFoundError: () => Effect.succeed(Option.none<PaddleProduct>()),
          }),
        )

        return result
      }),
    }

    const customers = {
      list: Effect.fn(function* (
        args: {
          active?: boolean | undefined
          after?: string | undefined
          perPage?: number | undefined
        } = {},
      ) {
        const active = args.active ?? true
        const res = yield* clientOK.get('/customers', {
          urlParams: {
            status: active ? 'active' : 'archived',
            after: args.after,
            per_page: args.perPage,
          },
        })

        const result = yield* pipe(
          res,
          HttpClientResponse.schemaBodyJson(Schema.Struct({ data: Schema.Array(PaddleCustomer) })),
          Effect.map(({ data }) => data),
          Effect.catchTag('ParseError', Effect.die),
        )

        return result
      }),

      get: Effect.fn(function* (args: { customerId: string }) {
        const res = yield* client.get(`/customers/${args.customerId}`)

        const result = yield* pipe(
          res,
          HttpClientResponse.matchStatus({
            200: (response) => HttpClientResponse.schemaBodyJson(Schema.Struct({ data: PaddleCustomer }))(response),
            404: (response) => Effect.fail(new CustomerNotFoundError({ customerId: response.request.url })),
            orElse: (response) => unexpectedStatus(response.request, response),
          }),
          Effect.map(({ data }) => Option.fromNullable(data)),
          Effect.catchTags({
            ParseError: Effect.die,
            CustomerNotFoundError: () => Effect.succeed(Option.none<PaddleCustomer>()),
          }),
        )

        return result
      }),

      find: Effect.fn(function* (
        args: {
          id?: string[] | undefined
          email?: string[] | undefined
          perPage?: number | undefined
        } = {},
      ) {
        const res = yield* clientOK.get('/customers', {
          urlParams: {
            id: args.id,
            email: args.email,
            per_page: args.perPage,
          },
        })

        const result = yield* pipe(
          res,
          HttpClientResponse.schemaBodyJson(Schema.Struct({ data: Schema.Array(PaddleCustomer) })),
          Effect.map(({ data }) => data),
          Effect.catchTag('ParseError', Effect.die),
        )

        return result
      }),

      create: Effect.fn(function* (args: {
        email: string
        userId: string
        name?: string | undefined
        locale?: string | undefined
      }) {
        const res = yield* client.post('/customers', {
          acceptJson: true,
          body: HttpBody.unsafeJson({
            email: args.email,
            name: args.name,
            custom_data: {
              userId: args.userId,
            },
            locale: args.locale,
          }),
        })

        const result = yield* pipe(
          res,
          HttpClientResponse.matchStatus({
            201: (response) => HttpClientResponse.schemaBodyJson(Schema.Struct({ data: PaddleCustomer }))(response),
            409: () =>
              Effect.fail(
                new CustomerAlreadyExistsError({
                  email: args.email,
                  userId: args.userId,
                }),
              ),
            orElse: (response) => unexpectedStatus(response.request, response),
          }),
          Effect.map(({ data }) => data),
          Effect.catchTag('ParseError', Effect.die),
        )

        return result
      }),

      update: Effect.fn(function* (args: {
        customerId: string
        email?: string | undefined
        name?: string | undefined
        locale?: string | undefined
      }) {
        const res = yield* clientOK.patch(`/customers/${args.customerId}`, {
          body: HttpBody.unsafeJson({
            name: args.name,
            locale: args.locale,
            email: args.email,
          }),
        })

        const result = yield* pipe(
          res,
          HttpClientResponse.schemaBodyJson(Schema.Struct({ data: PaddleCustomer })),
          Effect.map(({ data }) => data),
          Effect.catchTag('ParseError', Effect.die),
        )

        return result
      }),
    }

    const subscriptions = {
      list: Effect.fn(function* (args: {
        customerId?: string | undefined
        status?: string[] | undefined
        after?: string | undefined
        perPage?: number | undefined
        orderBy?: string | undefined
      }) {
        const res = yield* clientOK.get('/subscriptions', {
          urlParams: {
            customer_id: args.customerId ? [args.customerId] : undefined,
            status: args.status,
            after: args.after,
            per_page: args.perPage,
            order_by: args.orderBy,
          },
        })

        const result = yield* pipe(
          res,
          HttpClientResponse.schemaBodyJson(Schema.Struct({ data: Schema.Array(PaddleSubscription) })),
          Effect.map(({ data }) => data),
          Effect.catchTag('ParseError', Effect.die),
        )

        return result
      }),

      get: Effect.fn(function* (args: { subscriptionId: string }) {
        const res = yield* client.get(`/subscriptions/${args.subscriptionId}`)

        const result = yield* pipe(
          res,
          HttpClientResponse.matchStatus({
            200: (response) => HttpClientResponse.schemaBodyJson(Schema.Struct({ data: PaddleSubscription }))(response),
            404: (response) =>
              Effect.fail(
                new SubscriptionNotFoundError({
                  subscriptionId: response.request.url,
                }),
              ),
            orElse: (response) => unexpectedStatus(response.request, response),
          }),
          Effect.map(({ data }) => Option.fromNullable(data)),
          Effect.catchTags({
            ParseError: Effect.die,
            SubscriptionNotFoundError: () => Effect.succeed(Option.none<PaddleSubscription>()),
          }),
        )

        return result
      }),

      cancel: Effect.fn(function* (args: { subscriptionId: string; immediate?: boolean }) {
        const immediate = args.immediate ?? false

        yield* clientOK.post(`/subscriptions/${args.subscriptionId}/cancel`, {
          body: HttpBody.unsafeJson({
            effective_from: immediate ? 'immediately' : 'next_billing_period',
          }),
        })
      }),
    }

    const transactions = {
      list: Effect.fn(function* (args: {
        customerId?: string | undefined
        include?: string[] | undefined
        status?: string[] | undefined
        after?: string | undefined
        perPage?: number | undefined
        orderBy?: string | undefined
      }) {
        const res = yield* clientOK.get('/transactions', {
          urlParams: {
            customer_id: typeof args.customerId !== 'undefined' ? [args.customerId] : undefined,
            status: args.status,
            after: args.after,
            per_page: args.perPage,
            order_by: args.orderBy,
          },
        })

        const result = yield* pipe(
          res,
          HttpClientResponse.schemaBodyJson(Schema.Struct({ data: Schema.Array(PaddleTransaction) })),
          Effect.map(({ data }) => data),
          Effect.catchTag('ParseError', Effect.die),
        )

        return result
      }),

      get: Effect.fn(function* (args: { transactionId: string }) {
        const res = yield* client.get(`/transactions/${args.transactionId}`)

        const result = yield* pipe(
          res,
          HttpClientResponse.matchStatus({
            200: (response) => HttpClientResponse.schemaBodyJson(Schema.Struct({ data: PaddleTransaction }))(response),
            404: (response) =>
              Effect.fail(
                new TransactionNotFoundError({
                  transactionId: response.request.url,
                }),
              ),
            orElse: (response) => unexpectedStatus(response.request, response),
          }),
          Effect.map(({ data }) => Option.fromNullable(data)),
          Effect.catchTags({
            ParseError: Effect.die,
            TransactionNotFoundError: () => Effect.succeed(Option.none<PaddleTransaction>()),
          }),
        )

        return result
      }),

      generateInvoicePDF: Effect.fn(function* (args: { transactionId: string }) {
        const res = yield* clientOK.get(`/transactions/${args.transactionId}/invoice`)

        const result = yield* pipe(
          res,
          HttpClientResponse.schemaBodyJson(Schema.Struct({ url: Schema.String })),
          Effect.map(({ url }) => url),
          Effect.catchTag('ParseError', Effect.die),
        )

        return result
      }),
    }

    const webhooksUnmarshal = Effect.fn(function* (requestBody: string, secretKey: string, signature: string) {
      yield* Effect.tryPromise(() => new Webhooks().isValidSignature(requestBody, secretKey, signature)).pipe(
        Effect.filterOrFail(
          (isSignatureValid) => isSignatureValid,
          () => new WebhookUnmarshalError({ error: 'Invalid signature' }),
        ),
        Effect.catchAll((error) =>
          Effect.fail(
            new WebhookUnmarshalError({
              error: 'Invalid request body',
              cause: error,
            }),
          ),
        ),
      )

      return Webhooks.fromJson(requestBody)
    })

    return {
      config,
      prices,
      products,
      customers,
      subscriptions,
      transactions,
      webhooksUnmarshal,
    } as const
  }),
  dependencies: [],
}) {}

interface ParsedHeaders {
  ts: number
  h1: string
}

class Webhooks {
  private static readonly MAX_VALID_TIME_DIFFERENCE = 5

  private extractHeader(header: string): ParsedHeaders {
    const parts = header.split(';')
    let ts = ''
    let h1 = ''
    for (const part of parts) {
      const [key, value] = part.split('=')
      if (value) {
        if (key === 'ts') {
          ts = value
        } else if (key === 'h1') {
          h1 = value
        }
      }
    }
    if (ts && h1) {
      return { ts: Number.parseInt(ts), h1 }
    }
    throw new Error('[Paddle] Invalid webhook signature')
  }

  private async computeHmac(payload: string, secret: string): Promise<string> {
    const byteHexMapping = Array.from({ length: 256 })
    for (let i = 0; i < byteHexMapping.length; i++) {
      byteHexMapping[i] = i.toString(16).padStart(2, '0')
    }
    const encoder = new TextEncoder()

    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      {
        name: 'HMAC',
        hash: { name: 'SHA-256' },
      },
      false,
      ['sign'],
    )

    const signatureBuffer = await crypto.subtle.sign('hmac', key, encoder.encode(payload))

    // crypto.subtle returns the signature in base64 format. This must be
    // encoded in hex to match the CryptoProvider contract. We map each byte in
    // the buffer to its corresponding hex octet and then combine into a string.
    const signatureBytes = new Uint8Array(signatureBuffer)
    const signatureHexCodes = Array.from({ length: signatureBytes.length })

    for (let i = 0; i < signatureBytes.length; i++) {
      if (signatureBytes[i] !== undefined && signatureBytes[i] !== null) {
        signatureHexCodes[i] = byteHexMapping[signatureBytes[i]!]
      }
    }

    return signatureHexCodes.join('')
  }

  public async isValidSignature(requestBody: string, secretKey: string, signature: string) {
    const headers = this.extractHeader(signature)
    const payloadWithTime = `${headers.ts}:${requestBody}`

    // [FIXME] 暂时关闭时间戳验证
    // if (new Date().getTime() > new Date((headers.ts + Webhooks.MAX_VALID_TIME_DIFFERENCE) * 1000).getTime()) {
    //   return false
    // }

    const computedHash = await this.computeHmac(payloadWithTime, secretKey)
    return computedHash === headers.h1
  }

  public static fromJson(parsedRequest: any) {
    return JSON.parse(parsedRequest) as IEvents
  }
}
