import * as Schema from 'effect/Schema'

export const PaymentProviderTag = Schema.Literal('paddle', 'stripe')
export type PaymentProviderTag = typeof PaymentProviderTag.Type

export const PaymentEnvironmentTag = Schema.Literal('sandbox', 'production')
export type PaymentEnvironmentTag = typeof PaymentEnvironmentTag.Type
