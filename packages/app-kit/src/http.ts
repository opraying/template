import * as HttpApiBuilder from '@effect/platform/HttpApiBuilder'
import * as HttpApiClient from '@effect/platform/HttpApiClient'
import * as HttpServerResponse from '@effect/platform/HttpServerResponse'
import { MyHttpApi as Api } from '@xstack/purchase/http-api'
import { PaymentEnvironmentTag, PaymentProviderTag } from '@xstack/purchase/payment'
import { CustomerEmail } from '@xstack/purchase/schema'
import { PurchaseHttpApi } from '@xstack/app-kit/api/purchase'
import { AppPlan, AppSubscription, AppTransaction } from '@xstack/app-kit/schema'
import * as WorkerService from '@xstack/cloudflare/worker-service'
import { securityCookieDecode } from '@xstack/user-kit/authentication'
import { CurrentAuthSession, SessionSecurityMiddleware } from '@xstack/user-kit/middleware'
import * as Config from 'effect/Config'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Option from 'effect/Option'
import * as Schema from 'effect/Schema'

export class ApiClient extends Effect.Service<ApiClient>()('ApiClient', {
  effect: HttpApiClient.make(Api).pipe(Effect.provide(WorkerService.make('infra-purchase', () => 'PURCHASE'))),
}) {}

const SubscriptionHttpConfig = Config.all({
  namespace: Config.string('NAMESPACE'),
}).pipe(Effect.orDie)

const PaymentHttpConfig = Config.all({
  provider: Config.string('PROVIDER').pipe(Config.map((value) => Schema.decodeUnknownSync(PaymentProviderTag)(value))),
  providerId: Config.string('PROVIDER_ID'),
  environment: Config.string('ENVIRONMENT').pipe(
    Config.map((value) => Schema.decodeUnknownSync(PaymentEnvironmentTag)(value)),
  ),
}).pipe(Config.nested('PAYMENT'), Effect.orDie)

export const HttpPlansLive = HttpApiBuilder.group(PurchaseHttpApi, 'plans', (handles) =>
  Effect.gen(function* () {
    const client = yield* ApiClient
    const {
      PaymentHttpConfig: paymentConfig,
      SubscriptionHttpConfig: { namespace },
    } = yield* Effect.all({ SubscriptionHttpConfig, PaymentHttpConfig })

    return handles
      .handle('list', () =>
        Effect.gen(function* () {
          const products = yield* client.products.list({ path: { namespace } }).pipe(Effect.orElseSucceed(() => []))

          const plans = products.flatMap((product) =>
            product.prices.map((price) => {
              const isOneTime = !price.billingCycle
              const isActive = false

              return AppPlan.make({
                id: price.id,
                plan: product.name,
                name: price.name,
                description: product.description,
                billingCycle: price.billingCycle,
                trialPeriod: price.trialPeriod,
                price: price.unitPrice,
                quantity: price.quantity,
                isOneTime,
                isRecurring: !isOneTime,
                isTrial: !!price.trialPeriod,
                isActive,
              })
            }),
          )

          return {
            plans,
            system: paymentConfig,
            namespace,
          }
        }).pipe(Effect.orDie),
      )
      .handle('list2', () =>
        Effect.gen(function* () {
          const sessionSecurity = yield* SessionSecurityMiddleware
          const getSession = securityCookieDecode.pipe(
            Effect.flatMap(sessionSecurity.cookie),
            Effect.optionFromOptional,
            Effect.orElseSucceed(() => Option.none<CurrentAuthSession>()),
          )

          const getProducts = client.products.list({ path: { namespace } }).pipe(Effect.orElseSucceed(() => []))

          const { session, products } = yield* Effect.all(
            {
              session: getSession,
              products: getProducts,
            },
            { concurrency: 'unbounded' },
          )

          const subscription = yield* Option.map(session, (session) => {
            const customerEmail = CustomerEmail.make(session.user.email)
            return client.subscriptions.details({ path: { namespace, customerId: customerEmail } }).pipe(Effect.orDie)
          }).pipe(Effect.transposeOption)

          const plans = products.flatMap((product) =>
            product.prices.map((price) => {
              const isOneTime = !price.billingCycle
              const isActive =
                Option.isSome(subscription) &&
                subscription.value.productId === price.productId &&
                subscription.value.priceId === price.id

              // TODO: hasTrial
              return AppPlan.make({
                id: price.id,
                plan: product.name,
                name: price.name,
                description: product.description,
                billingCycle: price.billingCycle,
                trialPeriod: price.trialPeriod,
                price: price.unitPrice,
                quantity: price.quantity,
                isOneTime,
                isRecurring: !isOneTime,
                isTrial: !!price.trialPeriod,
                isActive,
              })
            }),
          )

          return {
            plans,
            system: paymentConfig,
            namespace,
          }
        }).pipe(Effect.orDie),
      )
  }),
).pipe(Layer.provide(ApiClient.Default))

export const HttpSubscriptionLive = HttpApiBuilder.group(PurchaseHttpApi, 'subscriptions', (handles) =>
  Effect.gen(function* () {
    const client = yield* ApiClient
    const { namespace } = yield* SubscriptionHttpConfig

    return handles
      .handle('get', () =>
        Effect.gen(function* () {
          const auth = yield* CurrentAuthSession
          const customerEmail = CustomerEmail.make(auth.user.email)

          yield* Effect.annotateLogsScoped({ namespace, customerId: customerEmail })

          const item = yield* client.subscriptions
            .details({ path: { namespace, customerId: customerEmail } })
            .pipe(Effect.orDie)

          const subscription = AppSubscription.make(item, { disableValidation: true })

          return subscription
        }),
      )
      .handle('cancel', () =>
        Effect.gen(function* () {
          const auth = yield* CurrentAuthSession
          const customerEmail = CustomerEmail.make(auth.user.email)

          const item = yield* client.subscriptions
            .info({ path: { namespace, customerId: customerEmail } })
            .pipe(Effect.orDie)

          const subscriptionId = item.id

          yield* Effect.annotateLogsScoped({ namespace, customerEmail, subscriptionId })

          yield* client.subscriptions
            .cancel({ path: { namespace, customerId: customerEmail, subscriptionId } })
            .pipe(Effect.orDie)

          yield* Effect.logDebug('subscription canceled')
        }),
      )
  }),
).pipe(Layer.provide(ApiClient.Default))

export const HttpTransactionLive = HttpApiBuilder.group(PurchaseHttpApi, 'transactions', (handles) =>
  Effect.gen(function* () {
    const client = yield* ApiClient
    const { namespace } = yield* SubscriptionHttpConfig

    return handles
      .handle('list', ({ urlParams }) =>
        Effect.gen(function* () {
          const auth = yield* CurrentAuthSession
          const customerEmail = CustomerEmail.make(auth.user.email)

          yield* Effect.annotateLogsScoped({ namespace, customerId: customerEmail })

          const { items, isLast } = yield* client.transactions
            .list({
              path: { namespace, customerId: customerEmail },
              urlParams: { page: urlParams.page, perPage: urlParams.perPage },
            })
            .pipe(Effect.orDie)

          const transactions = items.map((item) =>
            AppTransaction.make({
              id: item.id,
              description: `Payment for ${item.name}`,
              name: item.name,
              price: item.price,
              status: item.status,
              createdAt: item.createdAt,
            }),
          )

          return {
            items: transactions,
            isLast,
          }
        }),
      )
      .handleRaw('invoicePDF', ({ path }) =>
        Effect.gen(function* () {
          const auth = yield* CurrentAuthSession
          const customerEmail = CustomerEmail.make(auth.user.email)

          const { transactionId } = path

          yield* Effect.annotateLogsScoped({ namespace, customerId: customerEmail, transactionId })

          const pdfUrl = yield* client.transactions
            .invoiceGeneratePDF({
              path: { namespace, customerId: customerEmail, transactionId },
            })
            .pipe(Effect.orDie)

          return HttpServerResponse.redirect(pdfUrl, {
            status: 302,
          })
        }),
      )
  }),
).pipe(Layer.provide(ApiClient.Default))

export const HttpPurchaseLive = Layer.mergeAll(HttpPlansLive, HttpSubscriptionLive, HttpTransactionLive)
