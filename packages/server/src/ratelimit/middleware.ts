import type * as HttpApi from '@effect/platform/HttpApi'
import * as HttpRouter from '@effect/platform/HttpRouter'
import * as HttpServerRequest from '@effect/platform/HttpServerRequest'
import { Middleware, native, RatelimitApiConfig } from '@xstack/server/ratelimit'
import { Ratelimiter } from '@xstack/server/ratelimit/make'
import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'

interface RatelimitMiddlewareOptions {
  algorithm: RatelimitApiConfig['algorithm']
}

const RatelimitMiddlewareLive = (
  httpApi: HttpApi.HttpApi.Any,
  options: RatelimitMiddlewareOptions = {
    algorithm: native(),
  },
) =>
  Layer.effect(
    Middleware,
    Effect.gen(function* () {
      const api = httpApi as HttpApi.HttpApi.AnyWithProps
      let apiEndpointConfig: Map<string, RatelimitApiConfig>

      const getApiEndpointConfig = (path: string) =>
        Effect.sync(() => {
          if (apiEndpointConfig) {
            return apiEndpointConfig.get(path)!
          }

          apiEndpointConfig = new Map<string, RatelimitApiConfig>()

          Object.entries(api.groups).map(([_k, apiGroup]) => {
            if (apiGroup.endpoints) {
              const endpoints = Object.values(apiGroup.endpoints)
              endpoints.forEach((item) => {
                const config = Context.getOrElse(item.annotations, RatelimitApiConfig, () => ({
                  algorithm: options.algorithm,
                }))
                apiEndpointConfig.set(item.path, config)
              })
            }
          })

          return apiEndpointConfig.get(path)!
        })

      const ratelimiter = yield* Ratelimiter

      // @effect-diagnostics-next-line returnEffectInGen:off
      return Effect.gen(function* () {
        const routeContext = yield* HttpRouter.RouteContext
        const routePath = routeContext.route.path

        const endpointConfig = yield* getApiEndpointConfig(routePath)

        const serverRequest = yield* HttpServerRequest.HttpServerRequest
        const ip = serverRequest.headers['x-forwarded-for'] || serverRequest.headers['x-real-ip'] || 'global'
        /**
         * TODO: ip or user-id or session-id
         */
        const identifier = endpointConfig.identifier
          ? Effect.isEffect(endpointConfig.identifier)
            ? yield* endpointConfig.identifier
            : endpointConfig.identifier
          : ip

        // localhost, 127.0.0.1
        if (ip === '127.0.0.1' || ip === 'localhost') {
          return
        }

        const limitPayload = {
          ...endpointConfig,
          prefix: endpointConfig.prefix ?? routePath,
          cost: endpointConfig.cost ?? 1,
          identifier,
        }

        yield* ratelimiter.limit(limitPayload)
      })
    }),
  )

export { RatelimitMiddlewareLive as api }
