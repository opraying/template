import {
  ATTR_DB_NAMESPACE,
  ATTR_DB_OPERATION_NAME,
  ATTR_DB_SYSTEM,
} from '@opentelemetry/semantic-conventions/incubating'
import * as Context from 'effect/Context'
import * as Data from 'effect/Data'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import * as Option from 'effect/Option'

const DB_SYSTEM = 'Cache API'
const DB_NAME = 'cache'

export const sanitiseURL = (url: string | URL): string => {
  const u = typeof url === 'string' ? new URL(url) : url
  return `${u.protocol}//${u.host}${u.pathname}${u.search}`
}

export const CACHE_ATTRS = {
  KEY: 'cache.key',
  HAS_RESULT: 'cache.has_result',
  CACHE_HIT: 'cache.hit',
  HTTP_URL: 'http.url',
  MATCH: {
    IGNORE_METHOD: 'cache.match.ignore_method',
    CACHE_NAME: 'cache.match.cache_name',
  },
  PUT: {
    CACHE_NAME: 'cache.put.cache_name',
  },
  DELETE: {
    IGNORE_METHOD: 'cache.delete.ignore_method',
  },
} as const

export class CacheCallError extends Data.TaggedError('CacheCallError')<{
  message: string
  cause?: Error | undefined
}> {}

export interface CacheService {
  readonly open: (cacheName: string) => Effect.Effect<
    {
      delete: (
        request: Request | URL,
        options?: CacheQueryOptions | undefined,
      ) => Effect.Effect<boolean, CacheCallError, never>
      match: (request: Request | URL) => Effect.Effect<Option.Option<Response>, CacheCallError, never>
      put: (request: Request | URL, response: Response) => Effect.Effect<void, CacheCallError, never>
    },
    CacheCallError,
    never
  >
  readonly delete: (
    request: Request | URL,
    options?: CacheQueryOptions | undefined,
  ) => Effect.Effect<boolean, CacheCallError, never>
  readonly match: (request: Request | URL) => Effect.Effect<Option.Option<Response>, CacheCallError, never>
  readonly put: (request: Request | URL, response: Response) => Effect.Effect<void, CacheCallError, never>

  readonly caches: globalThis.CacheStorage
}

const make = (cacheStorage: () => globalThis.CacheStorage): CacheService => {
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

  const cacheWrap = (cache: Cache) => {
    const put = (request: Request | URL, response: Response) =>
      pipe(
        Effect.tryPromise({
          try: () => cache.put(request, response),
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
          try: () => cache.match(request),
          catch: catcher,
        }),
        Effect.map((result) => (result ? Option.some(result) : Option.none())),
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
          try: () => cache.delete(request, options),
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

  const defaultCache = open('default')

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
    caches: ins,
  } satisfies CacheService
}

// TODO: 修改 API 不需要在 R 上依赖
export class CacheStorage extends Context.Tag('@cacheStorage')<CacheStorage, CacheService>() {
  static Default = Layer.succeed(
    this,
    make(() => globalThis.caches),
  )
}
