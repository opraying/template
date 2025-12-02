import * as Config from 'effect/Config'
import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Stripe from 'stripe'

export const StripeConfig_ = Config.all({
  apiKey: Config.redacted('STRIPE_API_KEY').pipe(Config.withDefault('')),
})
export type StripeConfig = Config.Config.Success<typeof StripeConfig_>
export const StripeConfig = Context.GenericTag<StripeConfig>('@purchase:payment-stripe-config')

export const StripeConfigFromEnv = Layer.effect(
  StripeConfig,
  Effect.gen(function* () {
    const { apiKey } = yield* StripeConfig_

    return StripeConfig.of({ apiKey })
  }),
)

export const StripeConfigFromRecord = (config: StripeConfig) => Layer.succeed(StripeConfig, config)

export class StripeSdk extends Effect.Service<StripeSdk>()('StripeSdk', {
  effect: Effect.gen(function* () {
    const _stripe = new Stripe.Stripe('')

    return {} as any
  }),
}) {}
