import * as HttpApiSchema from '@effect/platform/HttpApiSchema'
import * as Schema from 'effect/Schema'

export class CustomerNotFound extends Schema.TaggedError<CustomerNotFound>()(
  'CustomerNotFound',
  {},
  HttpApiSchema.annotations({
    status: 404,
  }),
) {}

export class ProductNotFound extends Schema.TaggedError<ProductNotFound>()(
  'ProductNotFound',
  {},
  HttpApiSchema.annotations({
    status: 404,
  }),
) {}

export class SubscriptionCancelError extends Schema.TaggedError<SubscriptionCancelError>()('SubscriptionCancelError', {
  message: Schema.String,
}) {}

export class SubscriptionNotFound extends Schema.TaggedError<SubscriptionNotFound>()(
  'SubscriptionNotFound',
  {
    message: Schema.String.pipe(
      Schema.propertySignature,
      Schema.withConstructorDefault(() => 'Subscription not found'),
    ),
  },
  HttpApiSchema.annotations({
    status: 404,
  }),
) {}

export class TransactionNotFound extends Schema.TaggedError<TransactionNotFound>()(
  'TransactionNotFound',
  {
    message: Schema.String.pipe(
      Schema.propertySignature,
      Schema.withConstructorDefault(() => 'Transaction not found'),
    ),
  },
  HttpApiSchema.annotations({
    status: 404,
  }),
) {}

export class InvoiceNotFound extends Schema.TaggedError<InvoiceNotFound>()(
  'InvoiceNotFound',
  {},
  HttpApiSchema.annotations({
    status: 404,
  }),
) {}
