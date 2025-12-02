import * as Schema from 'effect/Schema'

export const MagicLinkTemplateSchema = Schema.Struct({
  loginCode: Schema.Redacted(Schema.String),
  hint: Schema.String.pipe(Schema.optional),
})

export const SubscriptionNotificationTemplateSchema = Schema.Struct({
  customer: Schema.Struct({
    name: Schema.String,
    email: Schema.String,
  }),
  plan: Schema.Struct({
    name: Schema.String,
    price: Schema.String, // 预格式化的价格字符串
    interval: Schema.String.pipe(Schema.optional),
  }),
  subtotal: Schema.String.pipe(Schema.optional), // 预格式化的小计
  discount: Schema.Struct({
    description: Schema.String,
    amount: Schema.String, // 预格式化的折扣金额
  }).pipe(Schema.optional),
  tax: Schema.Struct({
    rate: Schema.String, // 预格式化的税率
    amount: Schema.String, // 预格式化的税额
  }).pipe(Schema.optional),
  total: Schema.String, // 预格式化的总金额
  date: Schema.String,
  nextBillingDate: Schema.String.pipe(Schema.optional),
  orderId: Schema.String.pipe(Schema.optional),
  invoiceUrl: Schema.String.pipe(Schema.optional),
  refund: Schema.Struct({
    amount: Schema.String, // 预格式化的退款金额
    reason: Schema.String.pipe(Schema.optional),
  }).pipe(Schema.optionalWith({ exact: true })),
})

export const WelcomeTemplateSchema = Schema.Struct({
  message: Schema.String,
})
