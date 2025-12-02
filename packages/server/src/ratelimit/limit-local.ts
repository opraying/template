import { Ratelimit, Ratelimiter } from '@xstack/server/ratelimit/make'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'

export const RatelimiterLocal = Ratelimiter.Default.pipe(
  Layer.provide(
    Layer.succeed(
      Ratelimit,
      Ratelimit.of({
        limit: () => Effect.succeed({ success: true, limit: 100, remaining: 100, reset: 100 }),
      }),
    ),
  ),
)
