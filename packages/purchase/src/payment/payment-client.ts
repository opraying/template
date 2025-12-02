import type { PaymentProviderTag } from '@xstack/purchase/payment/type'
import type {
  Customer,
  CustomerAlreadyExistsError,
  CustomerId,
  CustomerNotFoundError,
  CustomerProviderId,
  InvoiceNotFoundError,
  Product,
  ProductId,
  Subscription,
  SubscriptionId,
  Transaction,
  TransactionId,
  WebhookUnmarshalError,
} from '@xstack/purchase/schema'
import type * as Effect from 'effect/Effect'
import type * as Option from 'effect/Option'
import type * as Stream from 'effect/Stream'

export interface PaymentClient {
  readonly _tag: PaymentProviderTag

  readonly isPaddle: boolean

  readonly isStripe: boolean

  readonly is: <A, E, R, T extends PaymentProviderTag>(
    tag: T,
    effect: (
      _: T extends 'paddle'
        ? Omit<PaddleImpl, 'is' | 'isPaddle' | 'isStripe'>
        : Omit<StripeImpl, 'is' | 'isPaddle' | 'isStripe'>,
    ) => Effect.Effect<A, E, R>,
  ) => Effect.Effect<A, E, R>

  readonly webhooksUnmarshal: ({
    payload,
    signature,
  }: {
    payload: string
    signature: string
  }) => Effect.Effect<any, WebhookUnmarshalError, never>

  readonly products: {
    list: (options: {
      namespace: string
      after?: string | undefined
      perPage?: number | undefined
    }) => Effect.Effect<readonly Product[], never, never>

    get: ({ productId }: { productId: ProductId }) => Effect.Effect<Option.Option<Product>, never, never>

    stream: (options?: {
      namespace?: string | undefined
      status?: string[] | undefined
      after?: string | undefined
      perPage?: number | undefined
      orderBy?: string | undefined
    }) => Stream.Stream<Product>
  }

  readonly customers: {
    get: (options: {
      customerId: CustomerId
      providerId: CustomerProviderId
    }) => Effect.Effect<Option.Option<Customer>, never, never>

    create: (options: {
      userId: string
      email: string
      name?: string | undefined
      locale?: string | undefined
    }) => Effect.Effect<Customer, CustomerAlreadyExistsError, never>

    update: (options: {
      providerId: CustomerProviderId
      email?: string | undefined
      name?: string | undefined
      locale?: string | undefined
    }) => Effect.Effect<Customer, CustomerNotFoundError, never>
  }

  readonly subscriptions: {
    list: (options: {
      namespace: string
      customerId: CustomerId
      providerId: CustomerProviderId
      after?: string | undefined
      perPage?: number | undefined
      orderBy?: string | undefined
    }) => Effect.Effect<readonly Subscription[], never, never>

    get: (options: {
      customerId: CustomerId
      subscriptionId: SubscriptionId
    }) => Effect.Effect<Option.Option<Subscription>, never, never>

    latest: (options: {
      namespace: string
      customerId: CustomerId
      providerId: CustomerProviderId
    }) => Effect.Effect<Option.Option<Subscription>, never, never>

    cancel: (options: {
      subscriptionId: SubscriptionId
      effectiveFrom?: 'immediately' | 'next_billing_period' | undefined
    }) => Effect.Effect<void, never, never>

    stream: (options: {
      namespace?: string | undefined
      customerId?: CustomerId | undefined
      providerId?: CustomerProviderId | undefined
      after?: string | undefined
      perPage?: number | undefined
    }) => Stream.Stream<Subscription>
  }

  readonly transactions: {
    list: (options: {
      namespace: string
      customerId: CustomerId
      providerId: CustomerProviderId
      after?: string | undefined
      perPage?: number | undefined
    }) => Effect.Effect<readonly Transaction[], never, never>

    get: (options: {
      customerId: CustomerId
      providerId?: CustomerProviderId
      transactionId: TransactionId
    }) => Effect.Effect<Option.Option<Transaction>, never, never>

    latest: (options: {
      namespace: string
      customerId: CustomerId
      providerId: CustomerProviderId
    }) => Effect.Effect<Option.Option<Transaction>, never, never>

    stream: (options: {
      namespace?: string | undefined
      customerId?: CustomerId | undefined
      providerId?: CustomerProviderId | undefined
      after?: string | undefined
      perPage?: number | undefined
    }) => Stream.Stream<Transaction>

    generateInvoicePDF: (options: {
      transactionId: TransactionId
    }) => Effect.Effect<string, InvoiceNotFoundError, never>
  }
}

export interface PaddleImpl extends PaymentClient {
  readonly paddleHi: Effect.Effect<string, never, never>
}

export interface StripeImpl extends PaymentClient {
  readonly stripeHi: Effect.Effect<string, never, never>
}
