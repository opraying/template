import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import { makeNativeToaster } from './expo'
import { wrapWithEffect } from './internal'
import { Toaster } from './toaster'

export const ExpoToaster = Layer.effect(
  Toaster,
  Effect.sync(() => wrapWithEffect(makeNativeToaster())),
)
