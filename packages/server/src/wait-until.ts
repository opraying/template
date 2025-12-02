import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Fiber from 'effect/Fiber'
import * as Option from 'effect/Option'
import * as Runtime from 'effect/Runtime'

export class WaitUntil extends Context.Tag('@wait-until')<WaitUntil, (promise: Promise<any>) => void>() {
  static do = Effect.fn(function* <T>(promise: Promise<T>) {
    const runtime = yield* Effect.runtime<never>()
    const context = runtime.context

    return yield* Option.match(Context.getOption(context, WaitUntil), {
      onNone: () =>
        Effect.sync(() => {
          Runtime.runFork(
            runtime,
            Effect.promise(() => promise),
          )
        }),
      onSome: (fn) => Effect.sync(() => fn(promise)),
    })
  }, Effect.withSpan('waitUntil.promise'))

  static effect = Effect.fn(function* (effect: Effect.Effect<any, never, never>) {
    const runtime = yield* Effect.runtime<never>()
    const context = runtime.context

    return yield* Option.match(Context.getOption(context, WaitUntil), {
      onNone: () =>
        Effect.sync(() => {
          Runtime.runFork(runtime, effect)
        }),
      onSome: (fn) => Effect.sync(() => fn(Runtime.runPromise(runtime, effect))),
    })
  }, Effect.withSpan('waitUntil.effect'))

  static fork = Effect.fn(function* (effect: Effect.Effect<any, never, never>) {
    const runtime = yield* Effect.runtime<never>()
    const context = runtime.context

    return yield* Option.match(Context.getOption(context, WaitUntil), {
      onNone: () =>
        Effect.sync(() => {
          Runtime.runFork(runtime, effect)
        }),
      onSome: (fn) =>
        Effect.sync(() => {
          const fiber = Runtime.runFork(runtime, effect)
          return fn(Runtime.runPromise(runtime, Fiber.join(fiber)))
        }),
    })
  }, Effect.withSpan('waitUntil.fork'))
}
