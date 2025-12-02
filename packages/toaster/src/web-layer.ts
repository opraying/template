import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import { wrapWithEffect } from './internal'
import { Toaster } from './toaster'
import { makeWebToaster } from './web'

export const WebToaster = Layer.effect(
  Toaster,
  Effect.sync(() => wrapWithEffect(makeWebToaster())),
)
