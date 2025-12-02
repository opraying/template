import { AppNamespace } from '@xstack/purchase/constants'
import * as Schema from 'effect/Schema'

export type PaddleEventName =
  | 'address.created'
  | 'address.updated'
  | 'address.imported'
  | 'adjustment.created'
  | 'adjustment.updated'
  | 'business.created'
  | 'business.imported'
  | 'business.updated'
  | 'customer.created'
  | 'customer.updated'
  | 'customer.imported'
  | 'discount.created'
  | 'discount.updated'
  | 'discount.imported'
  | 'payment_method.deleted'
  | 'payment_method.saved'
  | 'payout.created'
  | 'payout.paid'
  | 'price.created'
  | 'price.updated'
  | 'price.imported'
  | 'product.created'
  | 'product.updated'
  | 'product.imported'
  | 'subscription.activated'
  | 'subscription.canceled'
  | 'subscription.imported'
  | 'subscription.created'
  | 'subscription.past_due'
  | 'subscription.paused'
  | 'subscription.resumed'
  | 'subscription.trialing'
  | 'subscription.updated'
  | 'transaction.billed'
  | 'transaction.canceled'
  | 'transaction.completed'
  | 'transaction.paid'
  | 'transaction.created'
  | 'transaction.past_due'
  | 'transaction.payment_failed'
  | 'transaction.ready'
  | 'transaction.updated'
  | 'transaction.revised'
  | 'report.created'
  | 'report.updated'

const PaddleProductType = Schema.Literal('custom', 'standard')

const PaddleTaxCategory = Schema.Literal(
  'digital-goods',
  'ebooks',
  'implementation-services',
  'professional-services',
  'saas',
  'software-programming-services',
  'standard',
  'training-services',
  'website-hosting',
)

const PaddleObjectStatus = Schema.Literal('active', 'archived')

const PaddleTaxMode = Schema.Literal('account_setting', 'external', 'internal')

const PaddlePeriodInterval = Schema.Literal('day', 'week', 'month', 'year')

const PaddleSubscriptionStatus = Schema.Literal('active', 'canceled', 'past_due', 'paused', 'trialing')

const PaddleTransactionStatus = Schema.Literal('draft', 'ready', 'billed', 'paid', 'completed', 'canceled', 'past_due')

const UnitPrice = Schema.Struct({
  amount: Schema.String,
  currency_code: Schema.String,
})

const Quantity = Schema.Struct({
  minimum: Schema.Number,
  maximum: Schema.Number,
})

const BillingCycle = Schema.Struct({
  interval: PaddlePeriodInterval,
  frequency: Schema.Number,
})

const CustomData = Schema.Record({ key: Schema.String, value: Schema.Any }).pipe(
  Schema.optionalWith({ exact: true, nullable: true, default: () => ({}) }),
)

const DetailsTotals = Schema.Struct({
  subtotal: Schema.String,
  tax: Schema.String,
  discount: Schema.String,
  total: Schema.String,
  grand_total: Schema.String,
  fee: Schema.String.pipe(Schema.optionalWith({ exact: true, nullable: true })),
  credit: Schema.String,
  credit_to_balance: Schema.String,
  balance: Schema.String,
  earnings: Schema.String.pipe(Schema.optionalWith({ exact: true, nullable: true })),
  currency_code: Schema.String,
})

const UnitTotals = Schema.Struct({
  subtotal: Schema.String,
  discount: Schema.String,
  tax: Schema.String,
  total: Schema.String,
})

const AdjustedTotals = Schema.Struct({
  subtotal: Schema.String,
  tax: Schema.String,
  total: Schema.String,
  grand_total: Schema.String,
  fee: Schema.String.pipe(Schema.optionalWith({ exact: true, nullable: true })),
  earnings: Schema.String.pipe(Schema.optionalWith({ exact: true, nullable: true })),
  currency_code: Schema.String,
})

const Checkout = Schema.Struct({
  url: Schema.String,
})

const TaxRatesUsed = Schema.Struct({
  tax_rate: Schema.String,
  totals: UnitTotals,
})

export const PaddleProductCustomData = Schema.Struct({
  namespace: AppNamespace,
})

export class PaddleProduct extends Schema.Class<PaddleProduct>('PaddleProduct')({
  id: Schema.String,
  name: Schema.String,
  tax_category: PaddleTaxCategory,
  type: PaddleProductType,
  description: Schema.String,
  image_url: Schema.String.pipe(Schema.optionalWith({ exact: true, nullable: true })),
  custom_data: PaddleProductCustomData,
  status: PaddleObjectStatus,
  import_meta: CustomData,
  created_at: Schema.Date,
  updated_at: Schema.Date,
}) {}

const LineItem = Schema.Struct({
  id: Schema.String,
  price_id: Schema.String,
  quantity: Schema.Number,
  totals: UnitTotals,
  product: PaddleProduct,
  tax_rate: Schema.String,
  unit_totals: UnitTotals,
})

const PaymentAttemptStatus = Schema.Literal(
  'canceled',
  'authorized',
  'authorized_flagged',
  'captured',
  'error',
  'action_required',
  'pending_no_action_required',
  'created',
  'unknown',
  'dropped',
)

const PaymentMethodType = Schema.String

const PaymentCardType = Schema.String

const PaymentCard = Schema.Struct({
  type: PaymentCardType,
  last4: Schema.String,
  expiryMonth: Schema.Number,
  expiryYear: Schema.Number,
  cardholderName: Schema.String,
})

const PaymentAttempt = Schema.Struct({
  id: Schema.String.pipe(Schema.optionalWith({ exact: true, nullable: true })),
  amount: Schema.String,
  status: PaymentAttemptStatus,
  error: Schema.optional(Schema.String),
  details: Schema.optionalWith(
    Schema.Struct({
      type: PaymentMethodType,
      card: Schema.optionalWith(PaymentCard, { exact: true, nullable: true }),
    }),
    { nullable: true },
  ),
  created_at: Schema.Date,
  captured_at: Schema.optionalWith(Schema.Date, { exact: true, nullable: true }),
})

export const PaddlePriceCustomData = Schema.Struct({
  namespace: AppNamespace,
})

export class PaddlePrice extends Schema.Class<PaddlePrice>('PaddlePrice')({
  id: Schema.String,
  product_id: Schema.String,
  type: PaddleProductType,
  description: Schema.String,
  name: Schema.String.pipe(Schema.optionalWith({ exact: true, nullable: true })),
  billing_cycle: BillingCycle.pipe(Schema.optionalWith({ exact: true, nullable: true })),
  trial_period: Schema.Struct({
    interval: PaddlePeriodInterval,
    frequency: Schema.Number,
  }).pipe(Schema.optionalWith({ exact: true, nullable: true })),
  tax_mode: PaddleTaxMode,
  unit_price: UnitPrice,
  unit_price_overrides: Schema.Array(
    Schema.Struct({
      country_codes: Schema.Array(Schema.String),
      unit_price: UnitPrice,
    }),
  ),
  custom_data: PaddlePriceCustomData.pipe(Schema.optionalWith({ exact: true, nullable: true })),
  status: PaddleObjectStatus,
  quantity: Quantity,
  import_meta: CustomData,
  created_at: Schema.Date,
  updated_at: Schema.Date,
}) {}

export const PaddleCustomerCustomData = Schema.Struct({
  namespace: AppNamespace,
  userId: Schema.String,
})

export class PaddleCustomer extends Schema.Class<PaddleCustomer>('PaddleCustomer')({
  id: Schema.String,
  status: PaddleObjectStatus,
  custom_data: CustomData,
  name: Schema.String.pipe(Schema.optionalWith({ exact: true, nullable: true })),
  email: Schema.String,
  marketing_consent: Schema.Boolean,
  locale: Schema.String,
  created_at: Schema.Date,
  updated_at: Schema.Date,
  import_meta: CustomData,
}) {}

const BillingPeriod = Schema.Struct({
  starts_at: Schema.Date,
  ends_at: Schema.Date,
})

const BillingDetails = Schema.Struct({
  payment_terms: Schema.Struct({
    interval: PaddlePeriodInterval,
    frequency: Schema.Number,
  }),
  enable_checkout: Schema.Boolean,
  purchase_order_number: Schema.String,
  additional_information: Schema.String.pipe(Schema.optionalWith({ exact: true, nullable: true })),
})

const SubscriptionItem = Schema.Struct({
  status: Schema.String,
  quantity: Schema.Number,
  recurring: Schema.Boolean,
  price: PaddlePrice,
  product: PaddleProduct,
})

export class PaddleSubscription extends Schema.Class<PaddleSubscription>('PaddleSubscription')({
  id: Schema.String,
  status: PaddleSubscriptionStatus,
  customer_id: Schema.String,
  address_id: Schema.String,
  business_id: Schema.String.pipe(Schema.optionalWith({ exact: true, nullable: true })),
  currency_code: Schema.String,
  created_at: Schema.Date,
  updated_at: Schema.Date,
  started_at: Schema.Date,
  first_billed_at: Schema.Date.pipe(Schema.optionalWith({ exact: true, nullable: true })),
  next_billed_at: Schema.Date.pipe(Schema.optionalWith({ exact: true, nullable: true })),
  paused_at: Schema.Date.pipe(Schema.optionalWith({ exact: true, nullable: true })),
  canceled_at: Schema.Date.pipe(Schema.optionalWith({ exact: true, nullable: true })),
  collection_mode: Schema.String,
  billing_details: BillingDetails.pipe(Schema.optionalWith({ exact: true, nullable: true })),
  current_billing_period: BillingPeriod.pipe(Schema.optionalWith({ exact: true, nullable: true })),
  billing_cycle: BillingCycle,
  scheduled_change: Schema.Struct({
    action: Schema.Literal('cancel', 'pause', 'resume'),
    effective_at: Schema.Date,
    resume_at: Schema.Date.pipe(Schema.optionalWith({ exact: true, nullable: true })),
  }).pipe(Schema.optionalWith({ exact: true, nullable: true })),
  items: Schema.Array(SubscriptionItem),
  next_transaction: Schema.Struct({
    billing_period: BillingPeriod,
    details: Schema.Struct({
      tax_rates_used: Schema.Array(TaxRatesUsed),
      line_items: Schema.Array(LineItem),
      totals: Schema.Struct({
        subtotal: Schema.String,
        discount: Schema.String,
        tax: Schema.String,
        total: Schema.String,
        credit: Schema.String,
        creditToBalance: Schema.String,
        balance: Schema.String,
        grandTotal: Schema.String,
        fee: Schema.optionalWith(Schema.String, { exact: true, nullable: true }),
        earnings: Schema.optionalWith(Schema.String, { exact: true, nullable: true }),
        currencyCode: Schema.String,
      }),
    }),
  }).pipe(Schema.optionalWith({ exact: true, nullable: true })),
  custom_data: PaddleCustomerCustomData.pipe(Schema.optionalWith({ exact: true, nullable: true })),
  management_urls: Schema.Struct({
    update_payment_method: Schema.String,
    cancel: Schema.String,
  }),
  discount: Schema.Struct({
    id: Schema.String,
    starts_at: Schema.Date,
    ends_at: Schema.Date,
  }).pipe(Schema.optionalWith({ exact: true, nullable: true })),
  import_meta: CustomData,
}) {}

const TransactionItem = Schema.Struct({
  quantity: Schema.Number,
  price: PaddlePrice,
  proration: Schema.Struct({
    rate: Schema.String,
    billing_period: BillingPeriod,
  }).pipe(Schema.optionalWith({ exact: true, nullable: true })),
})

export class PaddleTransaction extends Schema.Class<PaddleTransaction>('PaddleTransaction')({
  id: Schema.String,
  status: PaddleTransactionStatus,
  customer_id: Schema.String,
  address_id: Schema.String.pipe(Schema.optionalWith({ exact: true, nullable: true })),
  business_id: Schema.String.pipe(Schema.optionalWith({ exact: true, nullable: true })),
  custom_data: PaddleCustomerCustomData.pipe(Schema.optionalWith({ exact: true, nullable: true })),
  origin: Schema.String,
  collection_mode: Schema.String,
  subscription_id: Schema.String.pipe(Schema.optionalWith({ exact: true, nullable: true })),
  invoice_id: Schema.String.pipe(Schema.optionalWith({ exact: true, nullable: true })),
  invoice_number: Schema.String.pipe(Schema.optionalWith({ exact: true, nullable: true })),
  billing_details: BillingDetails.pipe(Schema.optionalWith({ exact: true, nullable: true })),
  billing_period: BillingPeriod.pipe(Schema.optionalWith({ exact: true, nullable: true })),
  currency_code: Schema.String,
  discount_id: Schema.String.pipe(Schema.optionalWith({ exact: true, nullable: true })),
  created_at: Schema.Date,
  updated_at: Schema.Date,
  billed_at: Schema.Date.pipe(Schema.optionalWith({ exact: true, nullable: true })),
  revised_at: Schema.Date.pipe(Schema.optionalWith({ exact: true, nullable: true })),
  items: Schema.Array(TransactionItem),
  details: Schema.Struct({
    tax_rates_used: Schema.Array(TaxRatesUsed),
    totals: DetailsTotals,
    adjusted_totals: AdjustedTotals,
    payout_totals: Schema.Struct({
      subtotal: Schema.String,
      tax: Schema.String,
      discount: Schema.String,
      total: Schema.String,
      credit: Schema.String,
      credit_to_balance: Schema.String,
      balance: Schema.String,
    }).pipe(Schema.optionalWith({ exact: true, nullable: true })),
    adjusted_payout_totals: Schema.Struct({
      subtotal: Schema.String,
      tax: Schema.String,
      total: Schema.String,
      fee: Schema.String,
      chargeback_fee: Schema.Struct({
        amount: Schema.String,
        original: Schema.String.pipe(Schema.optionalWith({ exact: true, nullable: true })),
      }),
      earnings: Schema.String.pipe(Schema.optionalWith({ exact: true, nullable: true })),
      currency_code: Schema.String,
    }).pipe(Schema.optionalWith({ exact: true, nullable: true })),
    line_items: Schema.Array(LineItem),
  }),
  payments: Schema.Array(PaymentAttempt),
  checkout: Checkout,
}) {}
