import * as HttpApiClient from '@effect/platform/HttpApiClient'
import { PurchaseApi } from '@xstack/purchase/http-api'
import * as WorkerService from '@xstack/cloudflare/worker-service'
import * as Effect from 'effect/Effect'

export class PurchaseApiClient extends Effect.Service<PurchaseApiClient>()('PurchaseApiClient', {
  effect: HttpApiClient.make(PurchaseApi).pipe(Effect.provide(WorkerService.make('infra-purchase', () => 'PURCHASE'))),
}) {}
