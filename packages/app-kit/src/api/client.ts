import type * as HttpApi from '@effect/platform/HttpApi'
import type * as HttpApiClient from '@effect/platform/HttpApiClient'
import * as Effect from 'effect/Effect'

const clientSymbol = Symbol.for('x/react-router/api-client')
const local: Record<string, Effect.Effect<HttpApiClient.Client<any, never, never>>> = {}

const client_ = {
  getClient: <T extends HttpApi.HttpApi.Any>(key: string) =>
    Effect.flatten(
      Effect.cached(
        Effect.suspend(() => {
          const client = local[key]

          if (!Effect.isEffect(client)) {
            return Effect.dieMessage(`client ${key} is not an effect`)
          }

          return client
        }),
      ),
    ) as unknown as Effect.Effect<ExactHttpApiClient<T>>,

  setClient:
    <T extends Effect.Effect<HttpApiClient.Client<any, never, never>>>(key: string) =>
    (client: T) => {
      if (!client || !Effect.isEffect(client)) {
        return Effect.dieMessage(`client ${key} is not an effect`)
      }

      if (local[key]) {
        console.warn('client already set')
        return client
      }

      local[key] = client

      return client
    },
}

///
;(globalThis as any)[clientSymbol] = client_
///

export const client = (globalThis as any)[clientSymbol] as typeof client_

type ExactHttpApiClient<T extends HttpApi.HttpApi.Any> =
  T extends HttpApi.HttpApi<infer _i, infer G, infer E, infer R> ? HttpApiClient.Client<G, E, R> : never
