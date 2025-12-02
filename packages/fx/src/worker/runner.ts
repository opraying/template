/// <reference lib="webworker" />

import * as BrowserWorkerRunner from '@effect/platform-browser/BrowserWorkerRunner'
import * as WorkerRunner from '@effect/platform/WorkerRunner'
import type * as WorkerSchema from '@xstack/fx/worker/schema'
import * as OtelGlobals from '@xstack/otel/session/globals'
import * as Cause from 'effect/Cause'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import { pipe } from 'effect/Function'
import { globalValue } from 'effect/GlobalValue'
import * as Layer from 'effect/Layer'
import * as LogLevel from 'effect/LogLevel'
import * as Metric from 'effect/Metric'
import * as Option from 'effect/Option'
import * as Redacted from 'effect/Redacted'
import type * as Schema from 'effect/Schema'
import * as Scope from 'effect/Scope'
import type * as Stream from 'effect/Stream'
import * as SubscriptionRef from 'effect/SubscriptionRef'

const GlobalAccessToken = globalValue('@x/global-access-token', () =>
  Effect.runSync(SubscriptionRef.make(Option.none<Redacted.Redacted<string>>())),
)

export const GlobalLogLevel = globalValue('@fx/worker-loglevel', () =>
  Effect.runSync(SubscriptionRef.make(LogLevel.All)),
)

export const run = <
  R,
  A extends Schema.TaggedRequest.All,
  I,
  Handlers_ extends WorkerRunner.SerializedRunner.Handlers<A>,
  Handlers extends Array<
    (
      scope: Scope.CloseableScope,
    ) => Partial<Omit<Handlers_, 'InitialMessage' | 'RunnerInterrupt' | 'WorkerConfigChange'>>
  >,
  R2,
>(
  schema: Schema.Schema<A, I>,
  layer: Layer.Layer<R, never, Scope.Scope>,
  handlers: Handlers,
  options: {
    layer: Layer.Layer<R2>
  },
) =>
  pipe(
    Effect.gen(function* () {
      const scope = yield* Scope.make()

      const userHandles = handlers.reduce(
        (acc, handler) => {
          const userHandles = handler(scope)

          return { ...acc, ...userHandles }
        },
        {
          InitialMessage: (config: WorkerSchema.InitialMessage) => {
            if (config.logLevel) {
              Effect.runSync(SubscriptionRef.set(GlobalLogLevel, LogLevel.fromLiteral(config.logLevel)))
            }
            if (config.sessionId) {
              OtelGlobals.setRumSessionId(config.sessionId)
            }
            Effect.runSync(
              SubscriptionRef.set(GlobalAccessToken, Option.fromNullable(config.token).pipe(Option.map(Redacted.make))),
            )
            return Layer.provide(layer, Layer.succeed(Scope.Scope, scope))
          },
          RunnerInterrupt: () =>
            Effect.gen(function* () {
              yield* Scope.close(scope, Exit.void)
            }),
          WorkerConfigChange: (config: WorkerSchema.WorkerConfigChange) => {
            if (config.logLevel) {
              Effect.runSync(SubscriptionRef.set(GlobalLogLevel, LogLevel.fromLiteral(config.logLevel)))
            }
            if (config.sessionId) {
              OtelGlobals.setRumSessionId(config.sessionId)
            }
            Effect.runSync(
              SubscriptionRef.set(GlobalAccessToken, Option.fromNullable(config.token).pipe(Option.map(Redacted.make))),
            )
            return Effect.void
          },
        } as WorkerRunner.SerializedRunner.Handlers<A>,
      )

      const runner = WorkerRunner.layerSerialized(schema, userHandles).pipe(
        Layer.provide(BrowserWorkerRunner.layer),
      ) as unknown as Layer.Layer<never, WorkerRunner.PlatformRunner>

      // @ts-ignore
      globalThis.eventLogMessage = (args: any) => {
        self.postMessage([99, args])
      }

      if (import.meta.env.DEV) {
        setInterval(() => {
          const snapshot = Metric.unsafeSnapshot()
          self.postMessage([98, { type: 'dev-metrics', params: {}, data: JSON.stringify(snapshot) }])
        }, 950)
      }

      yield* BrowserWorkerRunner.launch(runner)
    }),
    Effect.catchAllCause((cause) => {
      if (Cause.isDieType(cause)) {
        if (Cause.isInterruptedException(cause.defect)) {
          return Effect.void
        }
      }

      if (Cause.isInterrupted(cause)) {
        return Effect.void
      }

      return Effect.logError(cause)
    }),
    Effect.provide(options.layer),
    Effect.runFork,
  )

export const handler = <S extends Schema.TaggedRequest.All>(
  fn: (_: Scope.CloseableScope) => {
    [I in S['_tag']]: (
      _: S extends { _tag: I } ? S : never,
    ) =>
      | Effect.Effect<
          S extends { _tag: I } ? Schema.WithResult.Success<S> : never,
          S extends { _tag: I } ? Schema.WithResult.Failure<S> : never,
          any
        >
      | Stream.Stream<
          S extends { _tag: I } ? Schema.WithResult.Success<S> : never,
          S extends { _tag: I } ? Schema.WithResult.Failure<S> : never,
          any
        >
  },
) => {
  return fn
}
