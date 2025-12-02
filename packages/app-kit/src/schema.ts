import { ProjectSubscription } from '@xstack/purchase/api/schema'
import {
  BillingCycle,
  PaymentCardType,
  PaymentMethodType,
  PriceQuantity,
  TrialPeriod,
  UnitPrice,
} from '@xstack/purchase/schema'
import * as Schema from 'effect/Schema'
import * as Struct from 'effect/Struct'

export class AppPlan extends Schema.Class<AppPlan>('@appkit:plan')({
  /**
   * Price ID
   */
  id: Schema.String,
  /**
   * Plan name (e.g. "Basic", "Pro", "Enterprise")
   */
  plan: Schema.String,
  /**
   * Price name (e.g. "Monthly")
   */
  name: Schema.String,
  /**
   * Plan description
   */
  description: Schema.String,
  /**
   * Plan price
   */
  price: UnitPrice,
  /**
   * Plan quantity
   */
  quantity: PriceQuantity,
  /**
   * Plan billing cycle
   */
  billingCycle: Schema.optional(BillingCycle),
  /**
   * Plan trial period
   */
  trialPeriod: Schema.optional(TrialPeriod),
  /**
   * Is one time payment
   */
  isOneTime: Schema.Boolean,
  /**
   * Is recurring
   */
  isRecurring: Schema.Boolean,
  /**
   * Is trial
   */
  isTrial: Schema.Boolean,
  /**
   * Is active
   */
  isActive: Schema.Boolean,
}) {
  get isYearly() {
    return this.billingCycle?.interval === 'year'
  }

  get isMonthly() {
    return this.billingCycle?.interval === 'month'
  }
}

export { SubscriptionInfo } from '@xstack/purchase/schema'

export class AppSubscription extends Schema.Class<AppSubscription>('@appkit:subscription')({
  ...Struct.omit(ProjectSubscription.fields, 'latestPayment'),
}) {
  get isPaused() {
    return this.status === 'past_due' || this.status === 'paused'
  }

  get isTrialing() {
    return this.status === 'trialing'
  }

  get isValid() {
    return this.status === 'active' || this.status === 'trialing'
  }
}

export class AppPayment extends Schema.Class<AppPayment>('@appkit:payment')({
  /**
   * Payment type
   */
  type: PaymentMethodType,
  /**
   * Payment card
   */
  card: Schema.optionalWith(PaymentCardType, { nullable: true }),
  /**
   * Payment created at
   */
  createdAt: Schema.Date,
  /**
   * Payment captured at
   */
  capturedAt: Schema.optionalWith(Schema.Date, { nullable: true }),
}) {}

export const AppTransactionStatus = Schema.Union(
  Schema.Literal('completed'),
  Schema.Literal('pending'),
  Schema.Literal('failed'),
)

export class AppTransaction extends Schema.Class<AppTransaction>('@appkit:transaction')({
  /**
   * Transaction ID
   */
  id: Schema.String,
  /**
   * Transaction name
   */
  name: Schema.String,
  /**
   * Transaction description
   */
  description: Schema.String,
  /**
   * Transaction price
   */
  price: Schema.optional(UnitPrice),
  /**
   * Transaction status
   */
  status: AppTransactionStatus,
  /**
   * Transaction created at
   */
  createdAt: Schema.Date,
}) {}

export type CustomerCustomData = {
  namespace: string
  userId: string
}

const Page = Schema.NumberFromString.pipe(
  Schema.optional,
  Schema.withConstructorDefault(() => 1),
)

const PerPage = Schema.NumberFromString.pipe(
  Schema.optional,
  Schema.withConstructorDefault(() => 10),
)

export const SubscriptionQuery = Schema.Struct({
  page: Page,
  perPage: PerPage,
})
