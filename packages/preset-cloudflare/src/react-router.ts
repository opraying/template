import { CloudflareBindings } from '@xstack/cloudflare/bindings'
import * as CacheStorage from '@xstack/cloudflare/cache-storage'
import { makeConfigProvider } from '@xstack/cloudflare/config-provider'
import * as Cloudflare from '@xstack/cloudflare/context'
import * as Emailer from '@xstack/cloudflare/emailer-fetch'
import { CloudflareExecutionContext } from '@xstack/cloudflare/execution-context'
import { I18nLive } from '@xstack/i18n/i18n.server'
import { withGlobalLogLevel } from '@xstack/server/logger'
import { pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import * as ManagedRuntime from 'effect/ManagedRuntime'

interface LoadContextParams {
  env: Record<string, any>
  caches: globalThis.CacheStorage
  waitUntil: (promise: Promise<any>) => void
  passThroughOnException: () => void
}

interface HandleAppLoadContext {
  env: Record<string, any>
  waitUntil: (promise: Promise<any>) => void
  passThroughOnException: () => void
  runtime: ManagedRuntime.ManagedRuntime<never, never>
}

export type make = <A>(
  layer: Layer.Layer<A>,
  options?: {
    getLoadContext?: (params: LoadContextParams) => Record<string, any>
  },
) => {
  getLoadContext: (params: LoadContextParams) => HandleAppLoadContext
}

export function make<A>(
  layer: Layer.Layer<A, never>,
  options: {
    getLoadContext?: (params: LoadContextParams) => Record<string, any>
  } = {},
): ReturnType<make> {
  return {
    getLoadContext: (params: LoadContextParams) => {
      const runtime = ManagedRuntime.make(
        Layer.provideMerge(
          layer,
          pipe(
            Layer.mergeAll(
              CloudflareBindings.fromEnv(params.env),
              CloudflareExecutionContext.fromContext(
                {
                  waitUntil: params.waitUntil,
                  passThroughOnException: params.passThroughOnException,
                  props: {},
                },
                params.env,
              ),
              CacheStorage.fromCaches(params.caches as any),
              Layer.setConfigProvider(makeConfigProvider(params.env)),
            ),
            Layer.provide(withGlobalLogLevel(params.env)),
          ),
        ),
      )

      return {
        ...options.getLoadContext?.(params),
        ...params,
        runtime,
      }
    },
  }
}

export const CloudflareLive = Layer.provideMerge(
  Layer.mergeAll(Emailer.EmailerFetchLive, I18nLive),
  Cloudflare.CloudflareLive,
)
