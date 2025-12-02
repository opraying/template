import * as HttpApiMiddleware from '@effect/platform/HttpApiMiddleware'
import { RatelimitError } from '@xstack/errors/server'
import type { RatelimitAlgorithm, RatelimitNativeType, RatelimitUserOptions } from '@xstack/server/ratelimit/make'
import * as Context from 'effect/Context'
import * as Duration from 'effect/Duration'

/**
 * @deprecated Use native ratelimit instead
 */
export const slidingWindow = (tokens: number, window: Duration.DurationInput) =>
  ({
    _tag: 'slidingWindow',
    tokens,
    window: Duration.toSeconds(window),
  }) as RatelimitAlgorithm

/**
 * @deprecated Use native ratelimit instead
 */
export const fixedWindow = (tokens: number, window: Duration.DurationInput) =>
  ({
    _tag: 'fixedWindow',
    tokens,
    window: Duration.toSeconds(window),
  }) as RatelimitAlgorithm

/**
 * Tier 1: [critical, real-time, peak] -> 600 req/min
 *
 * Tier 2: [high, premium, priority] -> 300 req/min
 *
 * Tier 3: [standard, general, moderate] -> 120 req/min
 *
 * Tier 4: [regular, common, typical] -> 80 req/min
 *
 * Tier 5: [basic, default, normal] -> 40 req/min
 *
 * Tier 6: [limited, low, constrained] -> 20 req/min
 *
 * Tier 7: [minimal, rare, occasional] -> 10 req/min
 *
 * Tier 8: [extremely, extremely, execptional] -> 5 req/min
 */
export const native = (type: RatelimitNativeType = 'tier_5') =>
  ({
    _tag: 'native',
    type,
  }) as RatelimitAlgorithm

export const toHeaders = (result: {
  limit?: number | undefined
  remaining?: number | undefined
  reset?: number | undefined
}) => {
  const headers: Record<string, string> = {}

  if (typeof result.limit !== 'undefined') {
    headers['X-Ratelimit-Limit'] = result.limit.toString()
  }
  if (typeof result.remaining !== 'undefined') {
    headers['X-Ratelimit-Remaining'] = result.remaining.toString()
  }
  if (typeof result.reset !== 'undefined') {
    headers['X-Ratelimit-Reset'] = result.reset.toString()
  }

  return headers
}

class RatelimitMiddleware extends HttpApiMiddleware.Tag<RatelimitMiddleware>()('RatelimitMiddleware', {
  failure: RatelimitError,
}) {}

export { RatelimitMiddleware as Middleware }

export interface RatelimitApiConfig extends RatelimitUserOptions {}
export const RatelimitApiConfig = Context.GenericTag<RatelimitApiConfig>('@server:ratelimit:api-config')

export const annotations = (annotations: RatelimitUserOptions) =>
  Context.make(RatelimitApiConfig, RatelimitApiConfig.of(annotations))
