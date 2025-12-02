import type { PaymentClient } from '@xstack/purchase/payment/payment-client'
import { PaymentImpl, PaymentTags } from '@xstack/purchase/payment/payment-impl'
import type { PaymentProviderTag } from '@xstack/purchase/payment/type'
import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'

export * from '@xstack/purchase/payment/type'

export class Payment extends Context.Tag('@purchase:payment')<
  Payment,
  {
    readonly use: (tag: PaymentProviderTag) => Effect.Effect<PaymentClient, never, never>
  }
>() {
  static Default = Layer.effect(
    this,
    Effect.gen(function* () {
      const tags = yield* PaymentTags
      const get = (tag: PaymentProviderTag) => PaymentImpl.pipe(Effect.provide(tags.providers[tag]))

      return {
        use: (tag) =>
          pipe(
            get(tag),
            Effect.flatMap((_) => _.make),
            Effect.orDie,
          ),
      }
    }),
  )

  static FromTag = <T extends PaymentProviderTag>(
    tag: T,
    layerRecord: Record<PaymentProviderTag, Layer.Layer<PaymentImpl>>,
  ) =>
    Layer.effect(
      this,
      Effect.gen(function* () {
        const tags = yield* PaymentTags
        const get = tags.providers[tag]
        const impl = yield* PaymentImpl.pipe(Effect.provide(get))

        return {
          use: () => impl.make.pipe(Effect.orDie),
        }
      }),
    ).pipe(Layer.provide(PaymentTags.FromRecords(layerRecord)))

  static FromTags = (layerRecord: Record<PaymentProviderTag, Layer.Layer<PaymentImpl>>) =>
    Payment.Default.pipe(Layer.provide(PaymentTags.FromRecords(layerRecord)))

  static client = Payment.pipe(Effect.flatMap((_) => _.use('any' as PaymentProviderTag)))
}
