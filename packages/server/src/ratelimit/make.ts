import { RatelimitError } from '@xstack/errors/server'
import * as Config from 'effect/Config'
import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'

export type RatelimitNativeType = 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4' | 'tier_5' | 'tier_6' | 'tier_7' | 'tier_8'

export type RatelimitAlgorithm =
  | {
      _tag: 'fixedWindow'
      tokens: number
      window: number
    }
  | {
      _tag: 'slidingWindow'
      tokens: number
      window: number
    }
  | {
      _tag: 'native'
      type: RatelimitNativeType
    }

export interface RatelimitConfig {
  namespace: string
}

export interface RatelimitUserOptions {
  algorithm: RatelimitAlgorithm
  prefix?: string | undefined
  identifier?: 'ip' | Effect.Effect<string> | undefined
  cost?: number
}

export interface RatelimitOptions {
  algorithm: RatelimitAlgorithm
  prefix: string | undefined
  identifier: string
  cost: number | undefined
}

export interface RatelimitRequestJson {
  namespace: string
  algorithm: RatelimitAlgorithm
  prefix: string
  identifier: string
  cost: number
}

export type RatelimitResponse =
  | {
      success: true
      /**
       * Maximum number of requests allowed within a window.
       */
      limit: number
      /**
       * How many requests the user has left within the current window.
       */
      remaining: number
      /**
       * Unix timestamp in milliseconds when the limits are reset.
       */
      reset: number
    }
  | {
      success: false
    }

export const isRatelimitResponse = (value: any): value is RatelimitResponse => {
  return value && 'success' in value
}

export interface RatelimitImpl {
  limit: (data: RatelimitRequestJson) => Effect.Effect<RatelimitResponse>
}

export interface RatelimitApi {
  limit: (req: RatelimitOptions) => Effect.Effect<RatelimiterResponse, RatelimitError, never>
}

export type RatelimiterResponse = {
  /**
   * Maximum number of requests allowed within a window.
   */
  limit: number
  /**
   * How many requests the user has left within the current window.
   */
  remaining: number
  /**
   * Unix timestamp in milliseconds when the limits are reset.
   */
  reset: number
}

export const Ratelimit = Context.GenericTag<RatelimitImpl>('@ratelimit')

export class Ratelimiter extends Effect.Tag('@ratelimiter')<
  Ratelimiter,
  {
    limit: (req: RatelimitOptions) => Effect.Effect<RatelimiterResponse, RatelimitError, never>
  }
>() {
  static Default = Layer.effect(
    Ratelimiter,
    Effect.gen(function* () {
      const impl = yield* Ratelimit
      const namespace = yield* Config.string('NAMESPACE').pipe(Effect.orDie)

      return {
        limit: (req) =>
          pipe(
            impl.limit({
              namespace,
              algorithm: req.algorithm,
              prefix: req.prefix ?? '',
              cost: req.cost ?? 1,
              identifier: req.identifier,
            }),
            Effect.filterOrFail(
              (result) => result.success,
              () =>
                new RatelimitError({
                  reason: 'RemainingLimitExceeded',
                  message: 'Remaining limit exceeded',
                }),
            ),
            Effect.catchAll((error) => {
              if (error._tag === 'RatelimitError') {
                return error
              }

              const message = error instanceof Error ? error.message : 'blockUntilReady unknown error'

              return pipe(
                Effect.logError(`Ratelimiter unknown error: ${message}`),
                Effect.zipRight(
                  new RatelimitError({
                    reason: 'UnknownError',
                    message,
                    cause: error,
                  }),
                ),
              )
            }),
            Effect.withSpan('Ratelimiter.limit'),
          ),
      }
    }),
  )
}
