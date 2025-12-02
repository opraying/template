import type * as Vitest from '@effect/vitest'
import { detectLanguage } from '@xstack/i18n/server'
import type { FormatInternalError } from '@xstack/react-router/errors/common'
import { RequestAppLoadContext } from '@xstack/react-router/request'
import type { ReactRouterData, TypedResponse } from '@xstack/react-router/response'
import { expect as serverExpect, Testing } from '@xstack/server-testing/test'
import * as Test from '@xstack/testing/test'
import { Cause, Duration, Effect, Layer, LogLevel, ManagedRuntime, pipe } from 'effect'
import type { i18n as I18nInstance } from 'i18next'
import { createInstance as createI18n } from 'i18next'
import {
  type LoaderFunctionArgs,
  type Params,
  UNSAFE_ErrorResponseImpl,
  UNSAFE_SingleFetchRedirectSymbol,
} from 'react-router'
import * as TurboStream from 'turbo-stream'
import * as V from 'vitest'

export { layer, mock, withLayer, withOverrideLayer } from '@xstack/testing/test'

export interface LoadContextParams {
  env: Record<string, any>
  caches: globalThis.CacheStorage
  waitUntil: (promise: Promise<any>) => void
  passThroughOnException: () => void
}

export interface HandleAppLoadContext {
  env: Record<string, any>
  waitUntil: (promise: Promise<any>) => void
  passThroughOnException: () => void
  runtime: ManagedRuntime.ManagedRuntime<never, never>
}

export type ServerContextMake = <A>(
  layer: Layer.Layer<A>,
  options?: {
    getLoadContext?: (params: LoadContextParams) => Record<string, any>
  },
) => {
  getLoadContext: (params: LoadContextParams) => HandleAppLoadContext
}

export const expect = {
  ...serverExpect,
  dataSuccess: Effect.tap<Response, void>((res) =>
    pipe(
      decode(res.clone()),
      Effect.tap((json: ReactRouterData<any, any>) => {
        V.expect(json).toBeDefined()

        V.expect(json.success, json.success ? undefined : json.error.message).toBeTruthy()
      }),
    ),
  ),
  dataFailure: Effect.tap<Response, void>((res) =>
    pipe(
      decode(res.clone()),
      Effect.tap((json: ReactRouterData<any, any>) => {
        V.expect(json).toBeDefined()
        V.expect(json.success).toBeFalsy()
      }),
    ),
  ),

  redirect: (location: string, status?: number | undefined) =>
    Effect.tap<TypedResponse<ReactRouterData<any, any>>, void>((res) => {
      V.expect(res.ok).toBeTruthy()
      V.expect(res.status).toBe(status ?? 202)
      V.expect(res.headers.get('Location')).toBe(location)
      V.expect(res.headers.get('X-Remix-Response')).toBe('yes')
      V.expect(res.headers.get('Content-Type')).toBe('text/x-script')
    }),
  redirectDocument: (location: string, status?: number | undefined) =>
    Effect.tap<TypedResponse<ReactRouterData<any, any>>, void>((res) => {
      V.expect(res.ok).toBeTruthy()
      V.expect(res.status).toBe(status ?? 202)
      V.expect(res.headers.get('Location')).toBe(location)
      V.expect(res.headers.get('X-Remix-Response')).toBe('yes')
      V.expect(res.headers.get('X-Remix-Reload-Document')).toBe('true')
      V.expect(res.headers.get('Content-Type')).toBe('text/x-script')
    }),
  replace: (location: string, status?: number | undefined) =>
    Effect.tap<TypedResponse<ReactRouterData<any, any>>, void>((res) => {
      V.expect(res.ok).toBeTruthy()
      V.expect(res.status).toBe(status ?? 202)
      V.expect(res.headers.get('Location')).toBe(location)
      V.expect(res.headers.get('X-Remix-Response')).toBe('yes')
      V.expect(res.headers.get('X-Remix-Replace')).toBe('true')
      V.expect(res.headers.get('Content-Type')).toBe('text/x-script')
    }),
}

// ----- Test -----

export const test =
  <R, E, const ExcludeTestServices extends boolean = false>(
    layer_: Layer.Layer<R | Testing, E>,
    options: {
      readonly memoMap?: Layer.MemoMap
      readonly timeout?: Duration.DurationInput
      readonly excludeTestServices?: ExcludeTestServices
      readonly logLevel?: LogLevel.Literal
    } & Vitest.TestOptions = {},
  ) =>
  (
    ...args:
      | [name: string, f: (it: Vitest.Vitest.MethodsNonLive<R, ExcludeTestServices>) => void]
      | [f: (it: Vitest.Vitest.MethodsNonLive<R, ExcludeTestServices>) => void]
  ) => {
    return Test.layer(layer_, {
      ...options,
      hooks: {
        beforeEach: Effect.gen(function* () {
          const r = yield* Testing

          yield* r.beforeEach
        }),
        afterEach: Effect.gen(function* () {
          const r = yield* Testing

          yield* r.afterEach
        }),
        mapEffect: (effect, runtime) => Effect.flatMap(Testing, (_) => _.mapEffect(effect, runtime)),
      },
    })(...args)
  }

// ---- Request -----

declare global {
  var i18nDetectRequestHook: (cb: (request: Request) => string) => string

  var initI18n: () => Promise<I18nInstance> | I18nInstance
}

type Action<A, E> = (args: LoaderFunctionArgs) => Promise<ReactRouterData<A, FormatInternalError<E>>>

function request<A, E>(
  loader: Action<A, E>,
  pathname?: string | undefined,
  options?: {
    params?: Params<string> | undefined
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
    body?: BodyInit | undefined
    headers?: HeadersInit | undefined
  },
): Effect.Effect<TypedResponse<ReactRouterData<A, FormatInternalError<E>>>, never, never>
function request<A, E>(
  loader: Action<A, E>,
  options?: {
    pathname?: string | undefined
    params?: Params<string> | undefined
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | undefined
    body?: BodyInit | undefined
    headers?: HeadersInit | undefined
  },
): Effect.Effect<TypedResponse<ReactRouterData<A, FormatInternalError<E>>>, never, never>
function request<A, E>(loader: Action<A, E>, pathname_?: any | undefined, options_?: any | undefined) {
  const options = ((typeof pathname_ === 'string' ? options_ : pathname_) || {}) as Record<string, any>
  const pathname: string = (typeof pathname_ === 'string' ? pathname_ : options.pathname) || '/'

  const request = new Request(`http://localhost${pathname}`, {
    method: options.method ?? 'GET',
    headers: new Headers({
      // 'Content-Type': 'application/json',
      ...options.headers,
    }),
    // oxlint-disable
    body: options.body ?? null,
  })

  const handle = Effect.gen(function* () {
    const appLoadContext = yield* RequestAppLoadContext

    globalThis.i18nDetectRequestHook = (detect) => detect(request)

    yield* Effect.promise(async () => await testInitI18n(appLoadContext.env))

    const maybeEffectLoader = loader as unknown as {
      effect?: (args: any) => Effect.Effect<ReactRouterData<A, FormatInternalError<E>>>
    }

    if (maybeEffectLoader?.effect) {
      const handle = maybeEffectLoader.effect({
        request,
        params: options.params ?? {},
        context: appLoadContext,
      })

      return yield* handle.pipe(resToData(request))
    }

    return yield* Effect.dieMessage('No effect loader')
  })

  return handle as Effect.Effect<Response, never, never>
}

export { request }

function isResponse(value: any): value is Response {
  return (
    value != null &&
    typeof value.status === 'number' &&
    typeof value.statusText === 'string' &&
    typeof value.headers === 'object' &&
    typeof value.body !== 'undefined'
  )
}

const redirectStatusCodes = new Set([301, 302, 303, 307, 308])

function isRedirectStatusCode(statusCode: number): boolean {
  return redirectStatusCodes.has(statusCode)
}

function isRedirectResponse(result: any): result is Response {
  return isResponse(result) && isRedirectStatusCode(result.status) && result.headers.has('Location')
}
class DataWithResponseInit<D> {
  type: string = 'DataWithResponseInit'
  data: D
  init: ResponseInit | null

  constructor(data: D, init?: ResponseInit) {
    this.data = data
    this.init = init || null
  }
}

function isDataWithResponseInit(value: any): value is DataWithResponseInit<unknown> {
  return (
    typeof value === 'object' &&
    value != null &&
    'type' in value &&
    'data' in value &&
    'init' in value &&
    value.type === 'DataWithResponseInit'
  )
}

type SingleFetchRedirectResult = {
  redirect: string
  status: number
  revalidate: boolean
  reload: boolean
  replace: boolean
}

// We can't use a 3xx status or else the `fetch()` would follow the redirect.
// We need to communicate the redirect back as data so we can act on it in the
// client side router.  We use a 202 to avoid any automatic caching we might
// get from a 200 since a "temporary" redirect should not be cached.  This lets
// the user control cache behavior via Cache-Control
const SINGLE_FETCH_REDIRECT_STATUS = 202

// Some status codes are not permitted to have bodies, so we want to just
// treat those as "no data" instead of throwing an exception:
//   https://datatracker.ietf.org/doc/html/rfc9110#name-informational-1xx
//   https://datatracker.ietf.org/doc/html/rfc9110#name-204-no-content
//   https://datatracker.ietf.org/doc/html/rfc9110#name-205-reset-content
//
// Note: 304 is not included here because the browser should fill those responses
// with the cached body content.
const NO_BODY_STATUS_CODES = new Set([100, 101, 204, 205])
// Add 304 for server side - that is not included in the client side logic
// because the browser should fill those responses with the cached data
// https://datatracker.ietf.org/doc/html/rfc9110#name-304-not-modified
const SERVER_NO_BODY_STATUS_CODES = new Set([...NO_BODY_STATUS_CODES, 304])

// This and SingleFetchResults are only used over the wire, and are converted to
// DecodedSingleFetchResults in `fetchAndDecode`.  This way turbo-stream/RSC
// can use the same `unwrapSingleFetchResult` implementation.
type SingleFetchResult = { data: unknown } | { error: unknown } | SingleFetchRedirectResult

type SingleFetchResults =
  | { [key: string]: SingleFetchResult }
  | { [UNSAFE_SingleFetchRedirectSymbol]: SingleFetchRedirectResult }

// ServerMode {
//   Development = "development",
//   Production = "production",
//   Test = "test",
// }
function generateSingleFetchResponse(
  request: Request,
  {
    result,
    headers,
    status,
  }: {
    result: SingleFetchResult | SingleFetchResults
    headers: Headers
    status: number
  },
) {
  // Mark all successful responses with a header so we can identify in-flight
  // network errors that are missing this header
  const resultHeaders = new Headers(headers)
  resultHeaders.set('X-Remix-Response', 'yes')

  // Skip response body for unsupported status codes
  if (SERVER_NO_BODY_STATUS_CODES.has(status)) {
    return new Response(null, { status, headers: resultHeaders })
  }

  // We use a less-descriptive `text/x-script` here instead of something like
  // `text/x-turbo` to enable compression when deployed via Cloudflare.  See:
  //  - https://github.com/remix-run/remix/issues/9884
  //  - https://developers.cloudflare.com/speed/optimization/content/brotli/content-compression/
  resultHeaders.set('Content-Type', 'text/x-script')

  return new Response(encodeViaTurboStream(result, request.signal, 5_000), {
    status: status || 200,
    headers: resultHeaders,
  })
}

/**
 * @private
 */
function stripBasename(pathname: string, basename: string): string | null {
  if (basename === '/') return pathname

  if (!pathname.toLowerCase().startsWith(basename.toLowerCase())) {
    return null
  }

  // We want to leave trailing slash behavior in the user's control, so if they
  // specify a basename with a trailing slash, we should support it
  const startIndex = basename.endsWith('/') ? basename.length - 1 : basename.length
  const nextChar = pathname.charAt(startIndex)
  if (nextChar && nextChar !== '/') {
    // pathname does not start with basename/
    return null
  }

  return pathname.slice(startIndex) || '/'
}

function getSingleFetchRedirect(
  status: number,
  headers: Headers,
  basename: string | undefined,
): SingleFetchRedirectResult {
  let redirect = headers.get('Location')!

  if (basename) {
    redirect = stripBasename(redirect, basename) || redirect
  }

  return {
    redirect,
    status,
    revalidate:
      // Technically X-Remix-Revalidate isn't needed here - that was an implementation
      // detail of ?_data requests as our way to tell the front end to revalidate when
      // we didn't have a response body to include that information in.
      // With single fetch, we tell the front end via this revalidate boolean field.
      // However, we're respecting it for now because it may be something folks have
      // used in their own responses
      // TODO(v3): Consider removing or making this official public API
      headers.has('X-Remix-Revalidate') || headers.has('Set-Cookie'),
    reload: headers.has('X-Remix-Reload-Document'),
    replace: headers.has('X-Remix-Replace'),
  }
}

// Note: If you change this function please change the corresponding
// decodeViaTurboStream function in server-runtime
function encodeViaTurboStream(data: any, requestSignal: AbortSignal, streamTimeout: number | undefined) {
  const controller = new AbortController()
  // How long are we willing to wait for all of the promises in `data` to resolve
  // before timing out?  We default this to 50ms shorter than the default value
  // of 5000ms we had in `ABORT_DELAY` in Remix v2 that folks may still be using
  // in RR v7 so that once we reject we have time to flush the rejections down
  // through React's rendering stream before we call `abort()` on that.  If the
  // user provides their own it's up to them to decouple the aborting of the
  // stream from the aborting of React's `renderToPipeableStream`
  const timeoutId = setTimeout(
    () => controller.abort(new Error('Server Timeout')),
    typeof streamTimeout === 'number' ? streamTimeout : 4950,
  )
  requestSignal.addEventListener('abort', () => clearTimeout(timeoutId))

  return TurboStream.encode(data, {
    signal: controller.signal,
    plugins: [
      (value) => {
        // Even though we sanitized errors on context.errors prior to responding,
        // we still need to handle this for any deferred data that rejects with an
        // Error - as those will not be sanitized yet
        if (value instanceof Error) {
          const { name, message, stack } = value
          return ['SanitizedError', name, message, stack]
        }

        if (value instanceof UNSAFE_ErrorResponseImpl) {
          const { data, status, statusText } = value
          return ['ErrorResponse', data, status, statusText]
        }

        if (value && typeof value === 'object' && UNSAFE_SingleFetchRedirectSymbol in value) {
          return ['SingleFetchRedirect', value[UNSAFE_SingleFetchRedirectSymbol]]
        }
      },
    ],
    postPlugins: [
      (value) => {
        if (!value) return
        if (typeof value !== 'object') return

        return ['SingleFetchClassInstance', Object.fromEntries(Object.entries(value))]
      },
      () => ['SingleFetchFallback'],
    ],
  })
}

// Note: If you change this function please change the corresponding
// encodeViaTurboStream function in server-runtime
function decodeViaTurboStream(body: ReadableStream<Uint8Array>, global: Window | typeof globalThis) {
  return TurboStream.decode(body, {
    plugins: [
      (type: string, ...rest: unknown[]) => {
        // Decode Errors back into Error instances using the right type and with
        // the right (potentially undefined) stacktrace
        if (type === 'SanitizedError') {
          const [name, message, stack] = rest as [string, string, string | undefined]
          let Constructor = Error
          // @ts-ignore
          if (name && name in global && typeof global[name] === 'function') {
            // @ts-ignore
            Constructor = global[name]
          }
          const error = new Constructor(message)
          error.stack = stack ?? ''
          return { value: error }
        }

        if (type === 'ErrorResponse') {
          const [data, status, statusText] = rest as [unknown, number, string | undefined]
          return {
            value: new UNSAFE_ErrorResponseImpl(status, statusText, data),
          }
        }

        if (type === 'SingleFetchRedirect') {
          return { value: { [UNSAFE_SingleFetchRedirectSymbol]: rest[0] } }
        }

        if (type === 'SingleFetchClassInstance') {
          return { value: rest[0] }
        }

        if (type === 'SingleFetchFallback') {
          return { value: undefined }
        }
      },
    ],
  })
}

const resToData =
  <A, E, R>(request: Request) =>
  (effect: Effect.Effect<A, E, R>) => {
    return pipe(
      effect,
      Effect.catchAllDefect((e) => {
        if (isDataWithResponseInit(e)) {
          return Effect.succeed(e as any)
        }

        if (e instanceof Response) {
          return Effect.succeed(e)
        }

        if (Cause.isCause(e)) {
          return Effect.failCause(e) as unknown as Effect.Effect<A, never, R>
        }

        return Effect.fail(e) as unknown as Effect.Effect<A, never, R>
      }),
      Effect.map((result: Response | DataWithResponseInit<A>) => {
        if (isRedirectResponse(result)) {
          return generateSingleFetchResponse(request, {
            result: {
              [UNSAFE_SingleFetchRedirectSymbol]: getSingleFetchRedirect(result.status, result.headers, '/'),
            },
            headers: result.headers,
            status: SINGLE_FETCH_REDIRECT_STATUS,
          })
        }

        if (isResponse(result)) {
          return result
        }

        if (isDataWithResponseInit(result)) {
          const abort1 = AbortSignal.timeout(5_000)

          const body = encodeViaTurboStream(result.data, abort1, 5_000)
          const res = new Response(body, {
            status: result.init?.status ?? 200,
            headers: result.init?.headers ? new Headers(result.init.headers) : {},
          })

          return res
        }

        return new Response(null, { status: 500 })
      }),
    )
  }

export const decode = <A, E>(response: TypedResponse<ReactRouterData<A, E>>) => {
  const body = response.clone().body!
  return Effect.promise(() => decodeViaTurboStream(body, global)).pipe(
    Effect.map((result: any) => result.value as ReactRouterData<A, E>),
  )
}

let i18n: I18nInstance
const testInitI18n: (env: Record<string, any>) => I18nInstance | Promise<I18nInstance> = () => {
  if (typeof globalThis.initI18n === 'function') {
    return globalThis.initI18n()
  }

  const initOptions = {
    initAsync: true,
  }

  const lng = globalThis.i18nDetectRequestHook((request: Request) => detectLanguage(request, initOptions))

  if (i18n) {
    i18n.changeLanguage(lng)
    return i18n
  }

  const instance = createI18n({
    ...initOptions,
    lng,
  })

  return instance.init(initOptions).then(() => {
    i18n = instance
    return i18n
  })
}
