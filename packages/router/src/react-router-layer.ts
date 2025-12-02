import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import { wrapWithEffect } from './internal'
import { Navigate } from './navigate'
import { makeReactRouterNavigate } from './react-router'

export const ReactRouterNavigate = Layer.effect(
  Navigate,
  Effect.sync(() => wrapWithEffect(makeReactRouterNavigate())),
)
