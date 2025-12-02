import { HttpClient } from '@effect/platform'
import { describe, expect, it } from '@effect/vitest'
import * as CloudflareBindings from '@xstack/cloudflare/bindings'
import * as WorkerService from '@xstack/cloudflare/worker-service'
import { Effect, Layer, Logger, LogLevel } from 'effect'

describe('WorkerService', () => {
  it.effect('case 1', () => {
    return Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient

      const res = yield* client.get('/hi')
      const text = yield* res.text
      const status = res.status

      expect(status).toBe(200)
      expect(text).toBe('OK')
    }).pipe(
      Effect.provide(
        WorkerService.make('infra-purchase', () => 'PURCHASE').pipe(
          Layer.provide(
            CloudflareBindings.CloudflareBindings.fromEnv({
              PURCHASE: {
                fetch: async () => {
                  return new Response('OK', { status: 200 })
                },
              },
            }),
          ),
          Layer.provide([Logger.add(Logger.prettyLoggerDefault), Logger.minimumLogLevel(LogLevel.All)]),
        ),
      ),
    )
  })
})
