import {
  ReactRouterBodyParseError,
  ReactRouterFormDataParseError,
  ReactRouterParamsParseError,
  ReactRouterSearchParamsParseError,
} from '@xstack/react-router/errors/server'
import * as Cookie from 'cookie'
import * as Context from 'effect/Context'
import * as Data from 'effect/Data'
import * as Effect from 'effect/Effect'
import type * as ManagedRuntime from 'effect/ManagedRuntime'
import * as Option from 'effect/Option'
import * as ParseResult from 'effect/ParseResult'
import * as Schema from 'effect/Schema'
import type { AppLoadContext, Params } from 'react-router'

export interface RequestAppLoadContext extends AppLoadContext {
  env: any
  caches: globalThis.CacheStorage
  waitUntil: (p: Promise<void>) => void
  passThroughOnException: () => void
  runtime: ManagedRuntime.ManagedRuntime<never, never>
}
export const RequestAppLoadContext = Context.GenericTag<RequestAppLoadContext>('@react-router:request-app-load-context')

export interface RequestContext {
  readonly request: Request
  readonly params: Params<string>
  readonly context: RequestAppLoadContext
  readonly stub: {
    readonly cookies: {
      readonly raw: string
      readonly records: Map<string, string | undefined>
      mutable: Map<string, [string, Cookie.SerializeOptions | undefined]>
    }
    readonly headers: Headers
  }
}

export const RequestContext = Context.GenericTag<RequestContext>('@react-router:request-context')

export const makeRequestContext = ({
  request,
  params,
  context,
  headers,
}: {
  request: Request
  params: Params<string>
  context: AppLoadContext
  headers: Headers
}) => {
  const cookieRow = request.headers.get('Cookie') || ''
  const cookies = {
    raw: cookieRow,
    records: new Map(Object.entries(Cookie.parse(cookieRow))),
    mutable: new Map(),
  }

  return RequestContext.of({
    request,
    params,
    context: context as unknown as RequestAppLoadContext,
    stub: {
      cookies,
      headers,
    },
  })
}

const withRequestContext = <E, A>(effect: (context: RequestContext) => Effect.Effect<A, E>) =>
  Effect.context<never>().pipe(
    Effect.map((ctx) => Context.get(ctx as Context.Context<RequestContext>, RequestContext)),
    Effect.flatMap(effect),
  )

export const request = withRequestContext((context) => Effect.succeed(context.request))

export const context = withRequestContext((context) => Effect.succeed(context.context))

export const getFormDataEntries = withRequestContext(
  (context): Effect.Effect<Record<string, any>, ReactRouterFormDataParseError, never> =>
    Effect.tryPromise({
      try: () => context.request.formData(),
      catch: (e: unknown) =>
        new ReactRouterFormDataParseError({
          cause: new ParseResult.ParseError({
            issue: new ParseResult.Forbidden(
              Schema.Unknown.ast,
              '',
              `Unable to parse the form data: ${(e as Error).message}`,
            ),
          }),
        }),
    }).pipe(
      Effect.map((formData) => Object.fromEntries(formData as any)),
      Effect.withSpan('ReactRouter.getFormDataEntries'),
    ),
)

export const getFormData = <A, I>(
  schema: Schema.Schema<A, I>,
): Effect.Effect<A, ReactRouterFormDataParseError, never> =>
  getFormDataEntries.pipe(
    Effect.flatMap((entries) => Schema.decodeUnknown(schema)(entries)),
    Effect.catchTags({ ParseError: (error) => new ReactRouterFormDataParseError({ cause: error }) }),
    Effect.withSpan('ReactRouter.decodeFormData'),
  )

export const getBody = <A, I>(schema: Schema.Schema<A, I>): Effect.Effect<A, ReactRouterBodyParseError, never> =>
  withRequestContext((context) =>
    Effect.tryPromise({
      try: () => context.request.json(),
      catch: (e: unknown) =>
        new ReactRouterBodyParseError({
          cause: new ParseResult.ParseError({
            issue: new ParseResult.Forbidden(
              schema.ast,
              '',
              `Unable to parse the request body as JSON: ${(e as Error).message}`,
            ),
          }),
        }),
    }).pipe(
      Effect.flatMap((json) => Schema.decodeUnknown(schema)(json)),
      Effect.catchTags({ ParseError: (error) => new ReactRouterBodyParseError({ cause: error }) }),
      Effect.withSpan('ReactRouter.decodeBody'),
    ),
  )

export const getSearchParams = <A, I>(
  schema: Schema.Schema<A, I>,
): Effect.Effect<A, ReactRouterSearchParamsParseError, never> =>
  withRequestContext((context) =>
    Effect.try({
      try: () => Object.fromEntries(new URL(context.request.url).searchParams.entries()),
      catch: (error: unknown) =>
        new ReactRouterSearchParamsParseError({
          cause: new ParseResult.ParseError({
            issue: new ParseResult.Forbidden(
              schema.ast,
              '',
              `Unable to parse the search params: ${(error as Error).message}`,
            ),
          }),
        }),
    }).pipe(
      Effect.flatMap((_) => Schema.decodeUnknown(schema)(_)),
      Effect.catchTags({ ParseError: (error) => new ReactRouterSearchParamsParseError({ cause: error }) }),
      Effect.withSpan('ReactRouter.decodeSearchParams'),
    ),
  )

export const getParams = <I, A>(schema: Schema.Schema<A, I>): Effect.Effect<A, ReactRouterParamsParseError, never> =>
  withRequestContext((context) =>
    Schema.decodeUnknown(schema)(context.params).pipe(
      Effect.mapError((error) => new ReactRouterParamsParseError({ cause: error })),
      Effect.withSpan('ReactRouter.decodeParams'),
    ),
  )

class Cookies_ {
  private get records() {
    return withRequestContext((context) => Effect.sync(() => context.stub.cookies.records)).pipe(
      Effect.cached,
      Effect.flatten,
    )
  }

  private get mutable() {
    return withRequestContext((context) => Effect.sync(() => context.stub.cookies.mutable)).pipe(
      Effect.cached,
      Effect.flatten,
    )
  }

  get fromHeader() {
    return withRequestContext((context) => Effect.sync(() => context.stub.cookies.raw)).pipe(
      Effect.cached,
      Effect.flatten,
      Effect.withSpan('ReactRouter.cookies.fromHeader'),
    )
  }

  get(key: string, fallback?: () => string): Effect.Effect<string | undefined> {
    return this.records.pipe(
      Effect.map((records) => records.get(key) || fallback?.()),
      Effect.withSpan('ReactRouter.cookies.get'),
    )
  }

  set(key: string, value: string, options?: Cookie.SerializeOptions | undefined): Effect.Effect<void> {
    return this.mutable.pipe(
      Effect.tap((records) => {
        records.set(key, [value, options])
      }),
      Effect.withSpan('ReactRouter.cookies.set'),
    )
  }

  delete(key: string): Effect.Effect<void> {
    return this.mutable.pipe(
      Effect.tap((records) => {
        records.set(key, ['', undefined])
      }),
      Effect.withSpan('ReactRouter.cookies.delete'),
    )
  }

  get serialize() {
    // serialize cookies to string
    return this.mutable.pipe(
      Effect.map((records) => {
        const result = Array.from(records.entries()).map(([key, [value, options]]) =>
          Cookie.serialize(key, value, options),
        )

        return result
      }),
    )
  }
}
export const Cookies = new Cookies_()

class Headers_ {
  private static get mutable() {
    return withRequestContext((context) => Effect.sync(() => context.stub.headers)).pipe(Effect.cached, Effect.flatten)
  }

  append: {
    (key: string, value: string): Effect.Effect<void>
    (...args: [string, string][]): Effect.Effect<void>
  } = (...args) =>
    Headers_.mutable.pipe(
      Effect.tap((headers) => {
        const [head] = args

        if (typeof head === 'string') {
          headers.append(head, args[1] as string)
        } else {
          args.forEach(([key, value]) => headers.append(key, value))
        }
      }),
      Effect.withSpan('ReactRouter.headers.append'),
    )

  delete(key: string): Effect.Effect<void> {
    return Headers_.mutable.pipe(
      Effect.tap((headers) => {
        headers.delete(key)
      }),
      Effect.withSpan('ReactRouter.headers.delete'),
    )
  }

  get(key: string): Effect.Effect<Option.Option<string>> {
    return Headers_.mutable.pipe(
      Effect.map((headers) => Option.fromNullable(headers.get(key))),
      Effect.withSpan('ReactRouter.headers.get'),
    )
  }

  set: {
    (key: string, value: string): Effect.Effect<void>
    (...args: [string, string][]): Effect.Effect<void>
  } = (...args) =>
    Headers_.mutable.pipe(
      Effect.tap((headers) => {
        const [head] = args

        if (typeof head === 'string') {
          headers.set(head, args[1] as string)
        } else {
          args.forEach(([key, value]) => headers.set(key, value))
        }
      }),
      Effect.withSpan('ReactRouter.headers.set'),
    )

  has(key: string): Effect.Effect<boolean> {
    return Headers_.mutable.pipe(
      Effect.map((headers) => headers.has(key)),
      Effect.withSpan('ReactRouter.headers.has'),
    )
  }

  get keys(): Effect.Effect<string[]> {
    return Headers_.mutable.pipe(
      Effect.map((headers) => Array.from(headers.keys())),
      Effect.withSpan('ReactRouter.headers.keys'),
    )
  }

  get values(): Effect.Effect<string[]> {
    return Headers_.mutable.pipe(
      Effect.map((headers) => Array.from(headers.values())),
      Effect.withSpan('ReactRouter.headers.values'),
    )
  }

  get entries(): Effect.Effect<[string, string][]> {
    return Headers_.mutable.pipe(
      Effect.map((headers) => Array.from(headers.entries())),
      Effect.withSpan('ReactRouter.headers.entries'),
    )
  }

  get serialize() {
    return Headers_.mutable
  }
}
export const Headers = new Headers_()

// ----- Response -----

export class ReactRouterRedirect extends Data.TaggedClass('ReactRouterRedirect')<{
  response: Response
  headers: HeadersInit
}> {
  get url() {
    return this.response.headers.get('Location')
  }
  toString() {
    return `ReactRouterRedirect: ${this.response.status} ${this.url}`
  }
  toJSON() {
    return {
      _tag: this._tag,
      url: this.url,
      status: this.response.status,
      headers: this.response.headers,
    }
  }
}

export const redirect = (url: string, status = 302): Effect.Effect<void> => {
  return Effect.suspend(() =>
    Headers.serialize.pipe(
      Effect.flatMap((headers) =>
        Effect.dieSync(() => {
          headers.set('Location', url)

          return new ReactRouterRedirect({
            response: new Response(null, {
              status,
              headers,
            }),
            headers: {},
          })
        }),
      ),
      Effect.zip(
        // 为了能在 OTEL 中看到这个 span
        Effect.succeed(0).pipe(Effect.withSpan('ReactRouter.redirect'), Effect.annotateSpans({ url, status })),
        {
          concurrent: true,
        },
      ),
      Effect.asVoid,
    ),
  )
}

export const redirectDocument = (url: string, status = 302): Effect.Effect<void> => {
  return Effect.suspend(() =>
    Headers.serialize.pipe(
      Effect.flatMap((headers) =>
        Effect.dieSync(() => {
          headers.set('Location', url)
          headers.set('X-Remix-Reload-Document', 'true')
          return new ReactRouterRedirect({
            response: new Response(null, {
              status,
              headers,
            }),
            headers: {},
          })
        }),
      ),
      Effect.zip(
        Effect.succeed(0).pipe(Effect.withSpan('ReactRouter.redirectDocument'), Effect.annotateSpans({ url, status })),
        {
          concurrent: true,
        },
      ),
      Effect.asVoid,
    ),
  )
}
export const replace = (url: string, status = 302): Effect.Effect<void> => {
  return Effect.suspend(() =>
    Headers.serialize.pipe(
      Effect.flatMap((headers) =>
        Effect.dieSync(() => {
          headers.set('Location', url)
          headers.set('X-Remix-Replace', 'true')

          return new ReactRouterRedirect({
            response: new Response(null, {
              status,
              headers,
            }),
            headers: {},
          })
        }),
      ),
      Effect.zip(
        Effect.succeed(0).pipe(Effect.withSpan('ReactRouter.replace'), Effect.annotateSpans({ url, status })),
        {
          concurrent: true,
        },
      ),
      Effect.asVoid,
    ),
  )
}
