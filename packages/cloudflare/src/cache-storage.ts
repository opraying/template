import type {
  Cache as CFCache,
  CacheStorage as CFCacheStorage,
  Response as CFResponse,
} from '@cloudflare/workers-types'
import {
  ATTR_DB_NAMESPACE,
  ATTR_DB_OPERATION_NAME,
  ATTR_DB_SYSTEM,
} from '@opentelemetry/semantic-conventions/incubating'
import { CACHE_ATTRS, CacheCallError, type CacheService, CacheStorage, sanitiseURL } from '@xstack/server/cache-storage'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import * as Option from 'effect/Option'

const DB_SYSTEM = 'Cloudflare Cache API'
const DB_NAME = 'cache'

const make = (cacheStorage: () => CFCacheStorage): CacheService => {
  const ins = cacheStorage()
  const catcher = (cause: any) => new CacheCallError({ message: 'cache call error', cause })

  const addSpanAttributes = (operation: string, request?: Request | URL, result?: any, options?: CacheQueryOptions) => {
    const baseAttributes = {
      [ATTR_DB_OPERATION_NAME]: operation,
      [ATTR_DB_SYSTEM]: DB_SYSTEM,
      [ATTR_DB_NAMESPACE]: DB_NAME,
      binding_type: 'Cache',
      [CACHE_ATTRS.HAS_RESULT]: !!result,
    } as Record<string, any>

    if (request) {
      baseAttributes[CACHE_ATTRS.HTTP_URL] = sanitiseURL(request instanceof URL ? request : request.url)
    }

    if (operation === 'match') {
      baseAttributes[CACHE_ATTRS.CACHE_HIT] = !!result
    }

    if (operation === 'delete' && options) {
      baseAttributes[CACHE_ATTRS.DELETE.IGNORE_METHOD] = options.ignoreMethod
    }

    return baseAttributes
  }

  const cacheWrap = (cache: CFCache) => {
    const put = (request: Request | URL, response: Response) =>
      pipe(
        Effect.tryPromise({
          try: () => cache.put(request as any, response as any),
          catch: catcher,
        }),
        Effect.tap(() => Effect.annotateCurrentSpan(addSpanAttributes('put', request))),
        Effect.withSpan(`Cache.put`, {
          attributes: addSpanAttributes('put', request),
        }),
      )

    const match = (request: Request | URL) =>
      pipe(
        Effect.tryPromise({
          try: () => cache.match(request as any),
          catch: catcher,
        }),
        Effect.map((result: CFResponse | undefined) =>
          result ? Option.some(result as unknown as Response) : Option.none(),
        ),
        Effect.tap((result) =>
          Effect.annotateCurrentSpan(
            addSpanAttributes('match', request, Option.isSome(result) ? result.value : undefined),
          ),
        ),
        Effect.withSpan(`Cache.match`, {
          attributes: addSpanAttributes('match', request),
        }),
      )

    const delete_ = (request: Request | URL, options?: CacheQueryOptions) =>
      pipe(
        Effect.tryPromise({
          try: () => cache.delete(request as any, options),
          catch: catcher,
        }),
        Effect.tap((result) => Effect.annotateCurrentSpan(addSpanAttributes('delete', request, result, options))),
        Effect.withSpan(`Cache.delete`, {
          attributes: addSpanAttributes('delete', request, undefined, options),
        }),
      )

    return {
      delete: delete_,
      match,
      put,
    }
  }

  const open = (cacheName: string) =>
    pipe(
      Effect.tryPromise({
        try: () => ins.open(cacheName),
        catch: catcher,
      }),
      Effect.map(cacheWrap),
      Effect.withSpan(`Cache.open`, {
        attributes: {
          [ATTR_DB_OPERATION_NAME]: 'open',
          [ATTR_DB_SYSTEM]: DB_SYSTEM,
          [ATTR_DB_NAMESPACE]: DB_NAME,
          binding_type: 'Cache',
          cache_name: cacheName,
        },
      }),
    )

  const defaultCache = Effect.sync(() => cacheWrap(ins.default))

  const delete_ = (request: Request | URL, options?: CacheQueryOptions) =>
    Effect.flatMap(defaultCache, (cache) => cache.delete(request, options))

  const match = (request: Request | URL) => Effect.flatMap(defaultCache, (cache) => cache.match(request))

  const put = (request: Request | URL, response: Response) =>
    Effect.flatMap(defaultCache, (cache) => cache.put(request, response))

  return {
    open,
    delete: delete_,
    match,
    put,
    caches: ins as any,
  } satisfies CacheService
}

export const Default = Layer.succeed(
  CacheStorage,
  make(() => globalThis.caches as unknown as CFCacheStorage),
)

export const fromCaches = (caches: CFCacheStorage) =>
  Layer.succeed(
    CacheStorage,
    make(() => caches),
  )

export const fromGlobalCaches = Layer.succeed(
  CacheStorage,
  make(() => globalThis.caches as any),
)
