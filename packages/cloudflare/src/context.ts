import { CloudflareExecutionContext } from '@xstack/cloudflare/execution-context'
import * as KV from '@xstack/cloudflare/kv'
import { RatelimiterWorkerLive } from '@xstack/cloudflare/limit'
import * as R2 from '@xstack/cloudflare/r2'
import { OtelLive } from '@xstack/cloudflare/otel'
import { LoggerLive } from '@xstack/server/logger'
import { RatelimiterLocal } from '@xstack/server/ratelimit/limit-local'
import { WaitUntil } from '@xstack/server/wait-until'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'

export const WaitUntilGlobalLive = Layer.effect(
  WaitUntil,
  Effect.gen(function* () {
    const ctx = yield* CloudflareExecutionContext.getRawContext()
    return (promise: Promise<any>) => ctx.waitUntil(promise)
  }),
)

export const CloudflareLive = Layer.mergeAll(
  WaitUntilGlobalLive,
  // @ts-ignore
  process.env.DISABLE_RATELIMIT || process.env.NODE_ENV === 'development' || process.env.TEST
    ? RatelimiterLocal
    : RatelimiterWorkerLive,
  KV.Default,
  R2.Default,
).pipe(Layer.provide([OtelLive, LoggerLive]))
