import * as HttpBody from '@effect/platform/HttpBody'
import * as HttpClient from '@effect/platform/HttpClient'
import * as WorkerService from '@xstack/cloudflare/worker-service'
import {
  isRatelimitResponse,
  Ratelimit,
  Ratelimiter,
  type RatelimitRequestJson,
  type RatelimitResponse,
} from '@xstack/server/ratelimit/make'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'

const RatelimiterHttpClientLive = WorkerService.make('infra-ratelimiter', () => 'RATELIMITER')

export const RatelimiterWorkerLive = Ratelimiter.Default.pipe(
  Layer.provide(
    Layer.effect(
      Ratelimit,
      Effect.gen(function* () {
        const client = yield* HttpClient.HttpClient

        return {
          limit: (data: RatelimitRequestJson) =>
            pipe(
              client.post('/limit', {
                acceptJson: true,
                body: HttpBody.unsafeJson(data),
              }),
              Effect.flatMap((res) => res.json),
              Effect.filterOrElse(isRatelimitResponse, () => Effect.succeed({ success: false } as RatelimitResponse)),
              Effect.orElseSucceed(() => ({ success: false }) as RatelimitResponse),
            ),
        }
      }),
    ),
  ),
  Layer.provide(RatelimiterHttpClientLive),
)
