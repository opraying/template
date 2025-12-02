import type {
  PaddleCustomer,
  PaddlePrice,
  PaddleProduct,
  PaddleSubscription,
  PaddleTransaction,
} from '@xstack/purchase/payment/internal/paddle-schema'
import {
  type PaddleConfig,
  PaddleConfigFromEnv,
  PaddleConfigFromRecord,
  PaddleSdk,
} from '@xstack/purchase/payment/internal/paddle-sdk'
import type { PaddleImpl, PaymentClient } from '@xstack/purchase/payment/payment-client'
import { PaymentImpl } from '@xstack/purchase/payment/payment-impl'
import type { PaymentProviderTag } from '@xstack/purchase/payment/type'
import {
  Customer,
  type CustomerId,
  type CustomerProviderId,
  InvoiceNotFoundError,
  type Price,
  Product,
  type ProductId,
  Subscription,
  type SubscriptionId,
  Transaction,
  type TransactionId,
} from '@xstack/purchase/schema'
import * as Chunk from 'effect/Chunk'
import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import * as Option from 'effect/Option'
import * as Redacted from 'effect/Redacted'
import * as Stream from 'effect/Stream'

function getPaymentReason(origin: string) {
  if (origin === 'web' || origin === 'subscription_charge') {
    return 'New'
  }
  return 'Renewal of '
}

const formatTransactionStatus = (status: typeof PaddleTransaction.Type.status): (typeof Transaction.Type)['status'] => {
  return status
}

const formatSubscriptionStatus = (
  status: typeof PaddleSubscription.Type.status,
): (typeof Subscription.Type)['status'] => {
  return status
}

const formatCustomer = (_: PaddleCustomer): typeof Customer.Encoded => {
  return {
    id: _.id,
    email: _.email,
    name: _.name || _.email,
    metadata: _.custom_data,
  } satisfies typeof Customer.Encoded
}

const formatPrices = (_: PaddlePrice): typeof Price.Encoded => {
  return {
    id: _.id,
    name: _.name || 'unknown',
    productId: _.product_id,
    unitPrice: {
      amount: _.unit_price.amount,
      currencyCode: _.unit_price.currency_code,
    },
    unitPriceOverride: _.unit_price_overrides.map((_) => {
      return {
        countryCodes: _.country_codes,
        unitPrice: {
          amount: _.unit_price.amount,
          currencyCode: _.unit_price.currency_code,
        },
      }
    }),
    billingCycle: _.billing_cycle || null,
    trialPeriod: _.trial_period || null,
    active: _.status === 'active',
    createdAt: _.created_at.toISOString(),
    updatedAt: _.updated_at.toISOString(),
    quantity: _.quantity,
    metadata: _.custom_data || {},
  } satisfies typeof Price.Encoded
}

const formatProduct = (_: PaddleProduct, prices: readonly PaddlePrice[]): typeof Product.Encoded => {
  const currentPrices = prices.filter((price) => price.product_id === _.id)

  return {
    id: _.id,
    active: _.status === 'active',
    name: _.name,
    description: _.description,
    metadata: _.custom_data,
    prices: currentPrices.map(formatPrices),
  } satisfies typeof Product.Encoded
}

const formatSubscription = (_: PaddleSubscription): typeof Subscription.Encoded => {
  const item = _.items[0]
  return {
    id: _.id,
    status: formatSubscriptionStatus(_.status),
    product: {
      id: item.product.id,
      name: item.product.name,
      description: item.product.description,
    },
    price: {
      id: item.price.id,
      name: item.price.name || '',
      unitPrice: {
        amount: item.price.unit_price.amount,
        currencyCode: item.price.unit_price.currency_code,
      },
    },
    addressId: _.address_id,
    currencyCode: _.currency_code,
    createdAt: _.created_at.toISOString(),
    updatedAt: _.updated_at.toISOString(),
    startedAt: _.started_at.toISOString(),
    firstBilledAt: _.first_billed_at?.toISOString() || null,
    nextBilledAt: _.next_billed_at?.toISOString() || null,
    pausedAt: _.paused_at?.toISOString() || null,
    canceledAt: _.canceled_at?.toISOString() || null,
    currentBillingPeriod: _.current_billing_period
      ? {
          startsAt: _.current_billing_period.starts_at.toISOString(),
          endsAt: _.current_billing_period.ends_at.toISOString(),
        }
      : null,
    billingCycle: _.billing_cycle,
    scheduledChange: _.scheduled_change
      ? {
          action: _.scheduled_change.action,
          effectiveAt: _.scheduled_change.effective_at.toISOString(),
          resumeAt: _.scheduled_change.resume_at?.toISOString(),
        }
      : null,
    managementUrls: {
      updatePaymentMethod: _.management_urls.update_payment_method,
      cancel: _.management_urls.cancel,
    },
    metadata: _.custom_data ?? {},
    items: _.items.map((_) => ({
      quantity: _.quantity,
      recurring: _.recurring,
      price: {
        id: _.price.id,
        unitPrice: {
          amount: _.price.unit_price.amount,
          currencyCode: _.price.unit_price.currency_code,
        },
        name: _.price.name || 'unknown name',
        description: _.price.description || 'unknown description',
      },
      product: {
        id: _.product.id,
        name: _.product.name || 'unknown name',
        description: _.product.description || 'unknown description',
      },
    })),
    nextTransaction: _.next_transaction
      ? {
          billingPeriod: {
            endsAt: _.next_transaction.billing_period.ends_at?.toISOString(),
            startsAt: _.next_transaction.billing_period.starts_at?.toISOString(),
          },
          taxRatesUsed: _.next_transaction.details.tax_rates_used.map((_) => {
            return {
              taxRate: _.tax_rate,
              totals: _.totals,
            }
          }),
          totals: _.next_transaction.details.totals,
          items: _.next_transaction.details.line_items.map((_) => ({
            priceId: _.price_id,
            quantity: _.quantity,
            taxRate: _.tax_rate,
            totals: _.totals,
            unitTotals: _.unit_totals,
            product: {
              id: _.product.id,
              name: _.product.name || '',
              description: _.product.description || '',
            },
          })),
        }
      : null,
  } satisfies typeof Subscription.Encoded
}

const formatTransaction = (_: PaddleTransaction): typeof Transaction.Encoded => {
  return {
    id: _.id,
    reason: getPaymentReason(_.origin),
    status: formatTransactionStatus(_.status),
    invoiceId: _.invoice_id,
    currencyCode: _.currency_code,
    createdAt: _.created_at.toISOString(),
    billedAt: _.billed_at?.toISOString(),
    updatedAt: _.updated_at?.toISOString(),
    discount: _.discount_id,
    billingPeriod: _.billing_period
      ? {
          startsAt: _.billing_period.starts_at.toISOString(),
          endsAt: _.billing_period.ends_at.toISOString(),
        }
      : null,
    items: _.items.map((item) => {
      return {
        name: item.price.name || 'unknown',
        productId: item.price.product_id,
        priceId: item.price.id,
        unitPrice: {
          amount: item.price.unit_price.amount,
          currencyCode: item.price.unit_price.currency_code,
        },
        quantity: item.quantity,
      }
    }),
    payments: _.payments.map((_) => {
      return {
        id: _.id || '',
        amount: _.amount,
        status: _.status,
        error: _.error || undefined,
        details: _.details
          ? {
              type: _.details.type,
              card: _.details.card,
            }
          : undefined,
        createdAt: _.created_at.toISOString(),
        capturedAt: _.captured_at?.toISOString(),
      }
    }),
  } satisfies typeof Transaction.Encoded
}

export class Paddle extends Context.Tag('@purchase:payment-paddle')<Paddle, PaddleImpl>() {
  static readonly _tag: PaymentProviderTag = 'paddle'

  static make = Effect.gen(function* () {
    const paddle = yield* PaddleSdk
    const config = paddle.config

    const webhooksUnmarshal = ({ signature, payload }: Parameters<PaymentClient['webhooksUnmarshal']>[0]) =>
      paddle.webhooksUnmarshal(payload, Redacted.value(config.webhookToken), signature)

    const subscriptionStream = (args: {
      namespace?: string | undefined
      providerId?: CustomerProviderId | undefined
      status?: string[] | undefined
      after?: string | undefined
      perPage?: number | undefined
      orderBy?: string | undefined
    }) =>
      Stream.unwrap(
        Effect.gen(function* () {
          const get = (after: string | undefined) =>
            paddle.subscriptions
              .list({
                customerId: args.providerId,
                after,
                status: args.status,
                perPage: args.perPage ?? 10,
                orderBy: args.orderBy,
              })
              .pipe(
                Effect.flatMap((transactions) =>
                  Subscription.decodeMany(
                    transactions
                      .filter((_) => {
                        if (!args.namespace) return _

                        return _.custom_data?.namespace === args.namespace
                      })
                      .map(formatSubscription),
                  ),
                ),
                Effect.orDie,
              )

          return Stream.paginateChunkEffect(args.after, (after) =>
            Effect.map(get(after), (results) => [
              Chunk.fromIterable(results),
              results.length === 0 ? Option.none<string>() : Option.some<string>(results[results.length - 1].id),
            ]),
          )
        }),
      )

    const transactionStream = (args: {
      namespace?: string | undefined
      providerId?: CustomerProviderId | undefined
      status?: string[] | undefined
      after?: string | undefined
      perPage?: number | undefined
      orderBy?: string | undefined
    }) =>
      Stream.unwrap(
        Effect.gen(function* () {
          const get = (after: string | undefined) =>
            paddle.transactions
              .list({
                customerId: args.providerId,
                after,
                status: args.status ?? ['completed', 'canceled', 'past_due'],
                perPage: args.perPage,
                orderBy: args.orderBy,
              })
              .pipe(
                Effect.flatMap((transactions) =>
                  Transaction.decodeMany(
                    transactions
                      .filter((_) => {
                        if (!args.namespace) return _

                        return _.custom_data?.namespace === args.namespace
                      })
                      .map(formatTransaction),
                  ),
                ),
                Effect.orDie,
              )

          return Stream.paginateChunkEffect(args.after, (after) =>
            Effect.map(get(after), (results) => [
              Chunk.fromIterable(results),
              results.length === 0 ? Option.none<string>() : Option.some<string>(results[results.length - 1].id),
            ]),
          )
        }),
      )

    const productsStream = ({
      namespace,
      status,
      after,
      perPage,
      orderBy,
    }: {
      namespace?: string | undefined
      status?: string[] | undefined
      after?: string | undefined
      perPage?: number | undefined
      orderBy?: string | undefined
    } = {}) =>
      Stream.unwrap(
        Effect.gen(function* () {
          const findStatus = status ?? ['active', 'archived']
          const prices = yield* paddle.prices
            .list({
              type: ['standard'],
              status: findStatus,
              perPage: perPage ?? 50,
            })
            .pipe(
              Effect.map((list) => {
                if (namespace) return list.filter((_) => _.custom_data?.namespace === namespace)
                return list
              }),
              Effect.orDie,
            )

          const get = (after: string | undefined) =>
            paddle.products.list({ status: findStatus, after, perPage, orderBy }).pipe(
              Effect.map((products) => {
                if (namespace) return products.filter((_) => _.custom_data?.namespace === namespace)
                return products
              }),
              Effect.flatMap((products) =>
                Product.decodeMany(products.map((product) => formatProduct(product, prices))),
              ),
              Effect.orDie,
            )

          const products = Stream.paginateChunkEffect(after, (after) =>
            pipe(
              Effect.map(get(after), (results) => [
                Chunk.fromIterable(results),
                results.length === 0 ? Option.none<string>() : Option.some<string>(results[results.length - 1].id),
              ]),
            ),
          )

          return products
        }),
      )
    const methods = {
      _tag: Paddle._tag,

      paddleHi: Effect.succeed('hi'),

      webhooksUnmarshal,

      products: {
        list: Effect.fn(function* ({
          namespace,
          after,
          perPage,
        }: {
          namespace: string
          after?: string | undefined
          perPage?: number | undefined
        }) {
          return yield* productsStream({ namespace, after, status: ['active'], perPage }).pipe(
            Stream.take(perPage ?? 10),
            Stream.runCollect,
            Effect.map(Chunk.toReadonlyArray),
          )
        }),

        get: Effect.fn(function* ({ productId }: { productId: ProductId }) {
          const [paddleProduct, productPrices] = yield* Effect.all(
            [paddle.products.get({ productId }), paddle.prices.list({ productId: [productId] })],
            { concurrency: 'unbounded' },
          ).pipe(Effect.orDie)

          return yield* Option.match(paddleProduct, {
            onNone: () => Effect.succeed(Option.none<Product>()),
            onSome: (product) =>
              pipe(Product.decode(formatProduct(product, productPrices)), Effect.map(Option.some), Effect.orDie),
          })
        }),

        stream: productsStream,
      },

      customers: {
        get: Effect.fn(function* ({
          customerId,
          providerId,
        }: {
          customerId: CustomerId
          providerId: CustomerProviderId
        }) {
          const paddleCustomer = yield* paddle.customers
            .get({ customerId: providerId })
            .pipe(Effect.map(Option.map(formatCustomer)), Effect.orDie)

          return yield* Option.match(paddleCustomer, {
            onNone: () => Effect.succeed(Option.none<Customer>()),
            onSome: (customer) => Customer.decode(customer).pipe(Effect.map(Option.some), Effect.orDie),
          })
        }),

        create: Effect.fn(function* (input: {
          userId: string
          email: string
          name?: string | undefined
          locale?: string | undefined
        }) {
          const paddleCustomer = yield* paddle.customers.create(input).pipe(Effect.orDie)

          const customerEncoded = formatCustomer(paddleCustomer)

          return yield* Customer.decode(customerEncoded).pipe(Effect.orDie)
        }),

        update: Effect.fn(function* (input: {
          providerId: CustomerProviderId
          email?: string | undefined
          name?: string | undefined
          locale?: string | undefined
        }) {
          const paddleCustomer = yield* paddle.customers
            .update({
              customerId: input.providerId,
              email: input.email,
              name: input.name,
              locale: input.locale,
            })
            .pipe(Effect.orDie)

          const customerEncoded = formatCustomer(paddleCustomer)

          return yield* Customer.decode(customerEncoded).pipe(Effect.orDie)
        }),
      },

      subscriptions: {
        list: Effect.fn(function* ({
          namespace,
          customerId,
          providerId,
          after,
          perPage,
          limit,
          orderBy,
        }: {
          namespace: string
          customerId: CustomerId
          providerId: CustomerProviderId
          after?: string | undefined
          perPage?: number | undefined
          limit?: number | undefined
          orderBy?: string | undefined
        }) {
          return yield* subscriptionStream({ namespace, providerId, after, orderBy, perPage }).pipe(
            Stream.take(limit ?? 10),
            Stream.runCollect,
            Effect.map(Chunk.toReadonlyArray),
          )
        }),

        get: Effect.fn(function* ({
          customerId,
          subscriptionId,
        }: {
          customerId: CustomerId
          subscriptionId: SubscriptionId
        }) {
          const paddleSubscription = yield* paddle.subscriptions
            .get({ subscriptionId })
            .pipe(Effect.map(Option.map(formatSubscription)), Effect.orDie)

          const subscription = yield* Option.match(paddleSubscription, {
            onNone: () => Effect.succeed(Option.none<Subscription>()),
            onSome: (subscription) =>
              Subscription.decode(subscription).pipe(Effect.map(Option.fromNullable), Effect.orDie),
          })

          return subscription
        }),

        latest: Effect.fn(function* ({
          namespace,
          customerId,
          providerId,
        }: {
          namespace: string
          customerId: CustomerId
          providerId: CustomerProviderId
        }) {
          return yield* subscriptionStream({ namespace, providerId }).pipe(Stream.take(1), Stream.runHead)
        }),

        cancel: Effect.fn(function* ({
          subscriptionId,
          effectiveFrom,
        }: {
          subscriptionId: SubscriptionId
          effectiveFrom?: 'immediately' | 'next_billing_period' | undefined
        }) {
          return yield* paddle.subscriptions
            .cancel({ subscriptionId, immediate: effectiveFrom === 'immediately' })
            .pipe(Effect.orDie)
        }),

        stream: subscriptionStream,
      },

      transactions: {
        list: Effect.fn(function* ({
          namespace,
          customerId,
          providerId,
          after,
          perPage,
          limit,
        }: {
          namespace: string
          customerId: CustomerId
          providerId: CustomerProviderId
          after?: string | undefined
          perPage?: number | undefined
          limit?: number | undefined
        }) {
          return yield* transactionStream({
            namespace,
            providerId,
            after,
            perPage,
          }).pipe(Stream.take(limit ?? 10), Stream.runCollect, Effect.map(Chunk.toReadonlyArray))
        }),

        latest: Effect.fn(function* ({
          namespace,
          customerId,
          providerId,
        }: {
          namespace: string
          customerId: CustomerId
          providerId: CustomerProviderId
        }) {
          return yield* transactionStream({
            namespace,
            status: ['completed'],
            providerId: providerId,
            perPage: 10,
            // orderBy: "created_at[desc]",
          }).pipe(Stream.take(1), Stream.runHead)
        }),

        get: Effect.fn(function* ({
          customerId,
          transactionId,
        }: {
          customerId: CustomerId
          transactionId: TransactionId
        }) {
          const paddleTransaction = yield* paddle.transactions
            .get({ transactionId })
            .pipe(Effect.map(Option.map(formatTransaction)), Effect.orDie)

          return yield* Option.match(paddleTransaction, {
            onNone: () => Effect.succeed(Option.none<Transaction>()),
            onSome: (transaction) => Transaction.decode(transaction).pipe(Effect.map(Option.some), Effect.orDie),
          })
        }),

        stream: transactionStream,

        generateInvoicePDF: ({ transactionId }: { transactionId: TransactionId }) =>
          paddle.transactions
            .generateInvoicePDF({ transactionId })
            .pipe(Effect.mapError(() => new InvoiceNotFoundError())),
      },
    } satisfies Partial<PaddleImpl>

    return {
      ...methods,

      isPaddle: true,

      isStripe: false,

      is: (tag, effect) => {
        if (tag === Paddle._tag) {
          return effect(methods as any) as any
        }

        return Effect.void as any
      },
    } satisfies PaddleImpl as unknown as PaddleImpl
  })

  static FromConfig = (config: PaddleConfig) =>
    Layer.succeed(
      PaymentImpl,
      PaymentImpl.of({
        _tag: Paddle._tag,
        make: Paddle.make.pipe(Effect.provide(pipe(PaddleSdk.Default, Layer.provide(PaddleConfigFromRecord(config))))),
      }),
    )

  static Live = Layer.succeed(
    PaymentImpl,
    PaymentImpl.of({
      _tag: Paddle._tag,
      make: Paddle.make.pipe(Effect.provide(pipe(PaddleSdk.Default, Layer.provide(PaddleConfigFromEnv), Layer.orDie))),
    }),
  )
}
