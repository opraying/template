import * as HttpApiSchema from '@effect/platform/HttpApiSchema'
import * as Schema from 'effect/Schema'

export class SubscriptionError extends Schema.TaggedError<SubscriptionError>()(
  '@appkit:subscription-error',
  {
    message: Schema.String,
    cause: Schema.Defect.pipe(Schema.optional),
  },
  HttpApiSchema.annotations({
    status: 400,
  }),
) {}

export class PaymentError extends Schema.TaggedError<PaymentError>()(
  '@appkit:payment-error',
  {
    message: Schema.String,
    cause: Schema.Defect.pipe(Schema.optional),
  },
  HttpApiSchema.annotations({
    status: 400,
  }),
) {}
