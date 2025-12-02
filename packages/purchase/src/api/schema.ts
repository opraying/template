import { AppNamespace } from '@xstack/purchase/constants'
import {
  BillingCycle,
  BillingPeriod,
  CustomerEmail,
  CustomerId,
  ErrorCode,
  PaymentAttemptStatus,
  PaymentCard,
  PaymentMethodType,
  PriceId,
  PriceName,
  PriceQuantity,
  ProductId,
  ProductName,
  SubscriptionStatus,
  TransactionId,
  TrialPeriod,
  UnitPrice,
} from '@xstack/purchase/schema'
import * as Schema from 'effect/Schema'

// ----- Project -----

export class ProjectPrice extends Schema.Struct({
  /**
   * price id
   */
  id: PriceId,
  /**
   * product id
   */
  productId: ProductId,
  /**
   * price name
   */
  name: PriceName,
  /**
   * price
   */
  unitPrice: UnitPrice,
  /**
   * billing cycle
   */
  billingCycle: Schema.optional(BillingCycle),
  /**
   * trial period
   */
  trialPeriod: Schema.optional(TrialPeriod),
  /**
   * price quantity
   */
  quantity: PriceQuantity,
  active: Schema.Boolean,
}) {}

export class ProjectProduct extends Schema.Class<ProjectProduct>('ProjectProduct')({
  /**
   * product id
   */
  id: ProductId,
  /**
   * product name
   */
  name: ProductName,
  active: Schema.Boolean,
  /**
   * product prices
   */
  prices: Schema.Array(ProjectPrice),
  /**
   * product description
   */
  description: Schema.String,
}) {
  static decode = Schema.decodeUnknown(this)
  static encode = Schema.encodeUnknown(this)
}

export class ProjectSubscription extends Schema.Class<ProjectSubscription>('ProjectSubscription')({
  /**
   * Subscription id
   */
  id: Schema.String,
  /**
   * Subscription name
   */
  name: Schema.String,
  /**
   * Subscription description
   */
  description: Schema.String,
  /**
   * Subscription product id
   */
  productId: ProductId,
  /**
   * Subscription price id
   */
  priceId: PriceId,
  /**
   * Subscription price
   */
  price: UnitPrice,
  /**
   * Subscription status
   */
  status: SubscriptionStatus,
  /**
   * Subscription started at
   */
  startedAt: Schema.optional(Schema.Date),
  /**
   * Subscription first billed at
   */
  firstBilledAt: Schema.optional(Schema.Date),
  /**
   * Subscription next billed at
   */
  nextBilledAt: Schema.optional(Schema.Date),
  /**
   * Subscription paused at
   */
  pausedAt: Schema.optional(Schema.Date),
  /**
   * Subscription canceled at
   */
  canceledAt: Schema.optional(Schema.Date),
  /**
   * Subscription billing cycle
   */
  billingCycle: Schema.optional(BillingCycle),
  /**
   * Subscription billing period
   */
  billingPeriod: Schema.optional(BillingPeriod),
  /**
   * Subscription trial period
   */
  trialDates: Schema.optional(BillingPeriod),
  /**
   * Subscription management urls
   */
  managementUrls: Schema.Struct({
    updatePaymentMethod: Schema.optional(Schema.String),
    cancel: Schema.optional(Schema.String),
  }),
  /**
   * Latest payment
   */
  latestPayment: Schema.optional(
    Schema.Struct({
      status: PaymentAttemptStatus,
      price: UnitPrice,
      error: Schema.optional(ErrorCode),
      type: Schema.optional(PaymentMethodType),
      card: Schema.optional(PaymentCard),
    }),
  ),
}) {
  static decode = Schema.decodeUnknown(this)
  static encode = Schema.encodeUnknown(this)
}

export class ProjectTransaction extends Schema.Class<ProjectTransaction>('ProjectTransaction')({
  id: Schema.String,
  name: Schema.String,
  price: Schema.optional(UnitPrice),
  invoiceId: Schema.optional(Schema.String),
  reason: Schema.String,
  status: Schema.Literal('completed', 'pending', 'failed'),
  createdAt: Schema.Date,
}) {}

// ----- Query -----

const PerPage = Schema.NumberFromString.pipe(
  Schema.optional,
  Schema.withConstructorDefault(() => 10),
)

const Page = Schema.NumberFromString.pipe(
  Schema.optional,
  Schema.withConstructorDefault(() => 1),
)

export class ProductsQuery extends Schema.Struct({
  namespace: AppNamespace,
  active: Schema.optional(Schema.BooleanFromString),
}) {}

export class ProductQuery extends Schema.Struct({
  namespace: AppNamespace,
  productId: ProductId,
}) {}

const ID = Schema.Union(CustomerId, CustomerEmail)

export class CustomerQuery extends Schema.Struct({
  namespace: AppNamespace,
  customerId: ID,
}) {}

export class SubscriptionQuery extends Schema.Struct({
  namespace: AppNamespace,
  customerId: ID,
}) {}

export class SubscriptionCancelQuery extends Schema.Struct({
  namespace: AppNamespace,
  customerId: ID,
  subscriptionId: Schema.String,
}) {}

export class TransactionsQuery extends Schema.Struct({
  namespace: AppNamespace,
  customerId: ID,
}) {}

export class TransactionsParams extends Schema.Struct({
  perPage: PerPage,
  page: Page,
}) {}

export class TransactionQuery extends Schema.Struct({
  namespace: AppNamespace,
  customerId: ID,
  transactionId: TransactionId,
}) {}
