import type { StripeConfig } from '@xstack/purchase/payment/internal/stripe-sdk'
import { StripeConfigFromEnv, StripeConfigFromRecord } from '@xstack/purchase/payment/internal/stripe-sdk'
import type { StripeImpl } from '@xstack/purchase/payment/payment-client'
import { PaymentImpl } from '@xstack/purchase/payment/payment-impl'
import type { PaymentProviderTag } from '@xstack/purchase/payment/type'
import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'

export class Stripe extends Context.Tag('@purchase:payment-stripe')<Stripe, StripeImpl>() {
  static readonly _tag: PaymentProviderTag = 'stripe'

  static make = Effect.gen(function* () {
    const methods = {
      _tag: Stripe._tag,

      stripeHi: Effect.succeed('hi'),
    } satisfies Partial<StripeImpl>

    return {
      ...methods,

      isPaddle: false,

      isStripe: true,

      is: (tag, effect) => {
        if (tag === Stripe._tag) {
          return effect(methods as any) as any
        }

        return Effect.void as any
      },
    } as StripeImpl
  })

  static FromConfig = (config: StripeConfig) =>
    Layer.succeed(
      PaymentImpl,
      PaymentImpl.of({
        _tag: Stripe._tag,
        make: Stripe.make.pipe(Effect.provide(StripeConfigFromRecord(config))),
      }),
    )

  static Live = Layer.succeed(
    PaymentImpl,
    PaymentImpl.of({
      _tag: Stripe._tag,
      make: Stripe.make.pipe(Effect.provide(StripeConfigFromEnv.pipe(Layer.orDie))),
    }),
  )
}
