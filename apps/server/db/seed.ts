import * as Effect from 'effect/Effect'

export const start = Effect.gen(function* () {
  yield* Effect.logDebug('Running db seed')
})
