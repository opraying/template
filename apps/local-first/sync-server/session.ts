import * as FetchHttpClient from '@effect/platform/FetchHttpClient'
import * as HttpClient from '@effect/platform/HttpClient'
import * as HttpClientRequest from '@effect/platform/HttpClientRequest'
import { UserSession } from '@xstack/event-log-server/server/schema'
import type { SubscriptionInfo } from '@xstack/purchase/schema'
import type * as Brand from 'effect/Brand'
import * as Cause from 'effect/Cause'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import * as Option from 'effect/Option'
import * as Redacted from 'effect/Redacted'
import * as Schema from 'effect/Schema'
import { namespaceSessionApi } from './constants'
import { PurchaseApiClient } from './purchase-client'

export const sessionFromToken = (namespace: string, token: Redacted.Redacted<string>) =>
  Effect.gen(function* () {
    const sessionApi = namespaceSessionApi[namespace]

    if (!sessionApi) {
      return yield* Effect.dieMessage(`Namespace ${namespace} not found`)
    }

    const url = process.env.NODE_ENV === 'development' ? sessionApi.dev : sessionApi.prod

    const serverClient = (yield* HttpClient.HttpClient.pipe(Effect.provide(FetchHttpClient.layer))).pipe(
      HttpClient.mapRequest((request) =>
        request.pipe(
          HttpClientRequest.prependUrl(url),
          HttpClientRequest.setHeader('cookie', `x-session=${Redacted.value(token)}`),
          HttpClientRequest.acceptJson,
        ),
      ),
      HttpClient.filterStatusOk,
    )

    const purchaseClient = yield* PurchaseApiClient.pipe(Effect.provide(PurchaseApiClient.Default))

    const _getTier = Effect.fn(function* ({
      namespace,
      email,
    }: {
      namespace: string
      email: string & Brand.Brand<'CustomerEmail'>
    }) {
      const subscription = yield* purchaseClient.subscriptions
        .info({
          path: {
            namespace,
            customerId: email,
          },
        })
        .pipe(
          Effect.asSome,
          Effect.orElseSucceed(() => Option.none<SubscriptionInfo>()),
        )

      return pipe(
        subscription,
        Option.map((s) => (s.isActive ? 'Pro' : 'Basic')),
        Option.getOrElse(() => 'Basic'),
      )
    }, Effect.withSpan('getTier'))

    const decode = Schema.decode(UserSession)
    const session = yield* serverClient.get('').pipe(
      Effect.flatMap((_) => _.json),
      Effect.flatMap((res: any) => decode({ ...res, session: Redacted.value(token) })),
      Effect.catchAll(() => new Cause.NoSuchElementException()),
    )

    return session
  })
