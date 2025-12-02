import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import { makeExpoRouterNavigate } from './expo'
import { wrapWithEffect } from './internal'
import { Navigate } from './navigate'

export const ExpoRouterNavigate = Layer.effect(
  Navigate,
  Effect.sync(() => wrapWithEffect(makeExpoRouterNavigate())),
)
