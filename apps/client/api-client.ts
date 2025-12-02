import * as FetchHttpClient from '@effect/platform/FetchHttpClient'
import * as HttpApiClient from '@effect/platform/HttpApiClient'
import { MyHttpApi } from '@server/api'
import * as ApiClient from '@xstack/app-kit/api/client'
import * as Effect from 'effect/Effect'

export class Api extends Effect.Service<Api>()('Api', {
  effect: HttpApiClient.make(MyHttpApi).pipe(
    Effect.provide(FetchHttpClient.layer),
    ApiClient.client.setClient('default'),
  ),
}) {}
