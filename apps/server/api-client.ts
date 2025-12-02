import * as HttpApiClient from '@effect/platform/HttpApiClient'
import { MyHttpApi } from '@server/api'
import * as WorkerService from '@xstack/cloudflare/worker-service'
import * as Effect from 'effect/Effect'

export class Api extends Effect.Service<Api>()('ServerApi', {
  effect: HttpApiClient.make(MyHttpApi).pipe(Effect.provide(WorkerService.make('template-server', () => 'SERVER'))),
}) {}
