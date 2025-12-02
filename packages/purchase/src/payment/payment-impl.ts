import type { PaymentClient } from '@xstack/purchase/payment/payment-client'
import type { PaymentProviderTag } from '@xstack/purchase/payment/type'
import * as Context from 'effect/Context'
import type * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'

export interface PaymentImpl {
  readonly _tag: PaymentProviderTag
  readonly make: Effect.Effect<PaymentClient, never, never>
}
export const PaymentImpl = Context.GenericTag<PaymentImpl>('@purchase:payment-impl')

export class PaymentTags extends Context.Tag('@purchase:payment-tags')<
  PaymentTags,
  {
    providers: Record<PaymentProviderTag, Layer.Layer<PaymentImpl>>
  }
>() {
  static FromRecords = (providers: Record<PaymentProviderTag, Layer.Layer<PaymentImpl>>) =>
    Layer.succeed(this, { providers })
}
