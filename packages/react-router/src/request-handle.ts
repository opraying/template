import * as ErrorEncoder from '@xstack/errors/encoder'
import type { RatelimitError } from '@xstack/errors/server'
import {
  type FormatInternalError,
  isReactRouterServerError,
  type ReactRouterInternalError,
  type ReactRouterServerError,
} from '@xstack/react-router/errors/common'
import { transformReactRouterError } from '@xstack/react-router/errors/server'
import { Cookies, makeRequestContext, type ReactRouterRedirect, RequestContext } from '@xstack/react-router/request'
import { type ReactRouterData, ReactRouterResult } from '@xstack/react-router/response'
import type { RatelimiterResponse, RatelimitOptions, RatelimitUserOptions } from '@xstack/server/ratelimit/make'
import { Ratelimiter } from '@xstack/server/ratelimit/make'
import * as Cause from 'effect/Cause'
import type * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import type * as Exit from 'effect/Exit'
import { identity, pipe } from 'effect/Function'
import type * as MangedRuntime from 'effect/ManagedRuntime'
import * as Schema from 'effect/Schema'
import type * as Tracer from 'effect/Tracer'
import { type ActionFunctionArgs, data, type LoaderFunctionArgs } from 'react-router'

type RequestLoadContext<E, R> = {
  env: Record<string, any>
  waitUntil: (promise: Promise<void>) => void
  passThroughOnException: () => void
  runtime: MangedRuntime.ManagedRuntime<R, E>
}

export interface RequestHandlerConfig {
  /**
   * The name of the span
   *
   * @example "ReactRouter.effect"
   */
  name: string
  /**
   * Trace span options
   */
  spanOptions?:
    | {
        attributes?: Record<string, unknown> | undefined
        links?: ReadonlyArray<Tracer.SpanLink> | undefined
        parent?: Tracer.AnySpan | undefined
        root?: boolean | undefined
        context?: Context.Context<never> | undefined
      }
    | undefined
  /**
   * The ratelimit configuration
   */
  ratelimit?: (() => RatelimitUserOptions) | undefined
  /**
   * Skip the ratelimit check
   */
  skipRatelimit?: boolean | undefined
  /**
   * Skip the tracing
   */
  skipTracing?: boolean | undefined
}

const shouldSkipRatelimit = (request: Request) => {
  // "Uptime-Kuma/0.0.0"
  const userAgent = request.headers.get('User-Agent') || ''

  const skipList: string[] = []

  return skipList.some((_) => userAgent.indexOf(_) !== -1)
}

const shouldSkipTracing = (request: Request) => {
  const userAgent = request.headers.get('User-Agent') || ''

  const skipList: string[] = ['Uptime-Kuma']

  return skipList.some((_) => userAgent.indexOf(_) !== -1)
}

type RequestHandlerType = 'loader' | 'action'

const createRequestHandler =
  (type: RequestHandlerType, config?: RequestHandlerConfig) =>
  <A, E, R, E1>(
    args: LoaderFunctionArgs | ActionFunctionArgs,
    body: Effect.Effect<A, E, R>,
    transform: (_: ReactRouterResult<A, E>) => Effect.Effect<ReactRouterResult<A, E>>,
  ) => {
    const spanName = `ReactRouter.${config?.name ? `${type}.${config.name}` : type}`
    const url = new URL(args.request.url)
    const headers = new Headers()
    let main = body

    if (config?.ratelimit && !(config.skipRatelimit || shouldSkipRatelimit(args.request))) {
      const ip = args.request.headers.get('X-Forwarded-For') || args.request.headers.get('x-real-ip') || undefined

      main = pipe(
        Effect.sync(() => config.ratelimit!()),
        Effect.flatMap((ratelimitUserOptions) => {
          if (ratelimitUserOptions.identifier && Effect.isEffect(ratelimitUserOptions.identifier)) {
            return ratelimitUserOptions.identifier.pipe(
              Effect.zip(Effect.succeed(ratelimitUserOptions)),
              Effect.withSpan('ReactRouter.ratelimit.get-identifier'),
            )
          }

          return Effect.succeed([ip || 'global', ratelimitUserOptions] as const)
        }),
        Effect.flatMap(([userIdentifier, ratelimitUserOptions]) => {
          const limitOptions: RatelimitOptions = {
            identifier: userIdentifier,
            algorithm: ratelimitUserOptions.algorithm,
            cost: ratelimitUserOptions.cost,
            prefix: ratelimitUserOptions.prefix ?? url.pathname,
          }

          return Ratelimiter.limit(limitOptions) as unknown as Effect.Effect<RatelimiterResponse, RatelimitError, never>
        }),
        Effect.catchTag('RatelimitError', (error) => {
          // when the ratelimit service is down, let the request pass
          if (error.reason === 'UnknownError') {
            return Effect.void
          }

          return Effect.fail(error as E)
        }),
        Effect.flatMap(() => body),
      )
    }

    const skipTracing = config?.skipTracing || shouldSkipTracing(args.request)

    const commitRequest = Cookies.serialize.pipe(
      Effect.tap((cookies) => {
        cookies.forEach((cookie) => {
          headers.append('Set-Cookie', cookie)
        })
      }),
    )

    const parentRequestHandleTraceSpace: Tracer.AnySpan | undefined = args.context.globalHandleRequestTraceSpan

    const program = pipe(
      main,
      Effect.flatMap((_) => transform(ReactRouterResult.Success({ result: _, headers }))),
      Effect.tapBoth({
        onFailure() {
          return commitRequest
        },
        onSuccess(_e) {
          return commitRequest
        },
      }),
      Effect.provideService(
        RequestContext,
        makeRequestContext({
          ...args,
          headers,
        }),
      ),
      // Error Refinement, 从预期的错误中恢复
      Effect.catchAllCause((cause_) => {
        const cause = cause_ as Cause.Cause<ReactRouterInternalError>

        if (cause._tag === 'Die') {
          if (cause.defect && isReactRouterRedirect(cause.defect)) {
            return Effect.succeed(cause.defect as A)
          }
        }

        if (cause._tag === 'Fail') {
          return Effect.succeed(
            ErrorEncoder.encode(isReactRouterServerError(cause.error) ? transformReactRouterError(cause) : cause) as A,
          )
        }

        return Effect.failCause(cause)
      }),
      Effect.map((result) => {
        const tagResult = result as ReactRouterResult<A, E> | ReactRouterRedirect | ReactRouterServerError

        if (tagResult._tag === 'ReactRouterRedirect') {
          return tagResult
        }

        if (tagResult._tag === 'ReactRouterResultSuccess' || tagResult._tag === 'ReactRouterResultFailure') {
          return tagResult
        }

        // User/React router error, like Effect.fail(LoginFailed), Effect.fail(FormError)
        return ReactRouterResult.Failure({
          error: tagResult,
          headers,
        })
      }),
      Effect.tap(
        Effect.fn(function* (result) {
          if (result._tag === 'ReactRouterRedirect') {
            yield* Effect.logDebug(`Redirect to ${result.url}`)
            return
          }

          if (result._tag === 'ReactRouterResultFailure') {
            const error = result.error as ReactRouterServerError

            const currentSpan = yield* Effect.currentSpan.pipe(Effect.asSome)
            if (
              currentSpan._tag === 'Some' &&
              currentSpan.value.parent._tag === 'Some' &&
              (currentSpan.value.parent.value as Tracer.Span).name === spanName
            ) {
              const span = currentSpan.value.parent.value as any

              span.attributes.set('status.interrupted', true)

              span.attributes.set('error', true)
              span.attributes.set('exception.type', error._tag)
              span.attributes.set('exception.message', error.message)
            }

            if (error._tag === 'RatelimitError' && error.reason === 'UnknownError') {
              yield* Effect.logError(error)
              return
            }

            if (error._tag === 'InternalServerError') {
              yield* Effect.logError(error)
              return
            }
          }
        }),
      ),
      Effect.withSpan(spanName, config?.spanOptions ?? {}),
      Effect.withLogSpan(spanName),
      (parentRequestHandleTraceSpace
        ? Effect.withParentSpan(parentRequestHandleTraceSpace)
        : identity) as typeof identity,
      Effect.tapDefect((cause) => {
        if (Cause.isInterrupted(cause)) {
          return Effect.void
        }

        return Effect.logError(cause)
      }),
      Effect.withTracerEnabled(!skipTracing),
    ) as Effect.Effect<ReactRouterRedirect | ReactRouterResult<A, E1>, never>

    return Effect.exit(program)
  }

const isReactRouterRedirect = (value: any): value is ReactRouterRedirect => {
  return value._tag === 'ReactRouterRedirect'
}

const assignHeaders = (headers: HeadersInit | Record<string, string | number>, res: Response) => {
  Object.entries(headers).forEach(([key, value]) => {
    res.headers.append(key, value)
  })
}

const serverJSONError = <A, E>(error: any, headers?: HeadersInit | undefined, status: number = 500) => {
  const data_: ReactRouterData<A, E> = {
    success: false,
    error,
  }

  return data(data_, {
    status: error.code ?? error.status ?? status,
    statusText: error.statusText ?? error.message,
    headers: headers as any,
  }) as unknown as ReactRouterData<A, E>
}

const toResponse = <A, E>(
  exit: Exit.Exit<ReactRouterRedirect | ReactRouterResult<A, E>, any>,
): ReactRouterData<A, E> => {
  // Uncaught error, Map error to Response
  if (exit._tag === 'Failure') {
    const cause = exit.cause

    // must throw to ensure that it is not captured by useLoaderData or useActionData in React router frontend
    if (Cause.isInterruptedOnly(cause)) {
      throw serverJSONError(ErrorEncoder.encode(cause), undefined, 499)
    }

    return serverJSONError(ErrorEncoder.encode(cause))
  }

  const result = exit.value

  if (result._tag === 'ReactRouterRedirect') {
    throw result.response
  }

  // Business logic error, such as UnauthorizedError, BadRequestError, etc.
  if (result._tag === 'ReactRouterResultFailure') {
    const error = ErrorEncoder.encode(result.error as any) as any
    const data_: ReactRouterData<A, E> = {
      success: false,
      error,
    }

    return data(data_, {
      status: error.status ?? 500,
      headers: result.headers,
    }) as unknown as typeof data_
  }

  // ReactRouterResultSuccess
  if (result.result instanceof Response) {
    assignHeaders(result.headers, result.result)
    return result.result as unknown as ReactRouterData<A, E>
  }

  const data_: ReactRouterData<A, E> = {
    success: true,
    result: result.result,
  }

  return data(data_, {
    headers: result.headers,
  }) as unknown as typeof data_
}

const make =
  (type: RequestHandlerType) =>
  <A, E, R>(body: Effect.Effect<A, E, R>, config?: RequestHandlerConfig | undefined) => {
    const handler = createRequestHandler(type, config)

    const run = (
      args: LoaderFunctionArgs,
    ): Effect.Effect<Exit.Exit<ReactRouterRedirect | ReactRouterResult<A, FormatInternalError<E>>>> =>
      handler<A, E, R, FormatInternalError<E>>(args, body, Effect.succeed)

    const json_ = (args: LoaderFunctionArgs): Promise<ReactRouterData<A, FormatInternalError<E>>> => {
      const context = args.context as unknown as RequestLoadContext<E, R>

      return context.runtime.runPromise(run(args), { signal: args.request.signal }).then(toResponse)
    }

    Object.defineProperty(json_, 'effect', {
      enumerable: false,
      configurable: false,
      get: () => (args: LoaderFunctionArgs) => run(args).pipe(Effect.map(toResponse)),
    })

    const runSchema = <A2>(schema: Schema.Schema<A, A2>, args: LoaderFunctionArgs) => {
      const encode = Schema.encodeUnknown(schema)

      const run = handler<A, E, R, FormatInternalError<E>>(args, body, (result) => {
        if (result._tag === 'ReactRouterResultFailure') {
          return Effect.succeed(result) as Effect.Effect<ReactRouterResult<A, E>>
        }

        return pipe(
          encode(result.result),
          Effect.map(
            (res) =>
              ReactRouterResult.Success({
                result: res,
                headers: result.headers,
              }) as ReactRouterResult<A, E>,
          ),
        ) as Effect.Effect<ReactRouterResult<A, E>>
      })

      return run as Effect.Effect<Exit.Exit<ReactRouterResult<A2, FormatInternalError<E>>>>
    }

    const schema = <A2>(schema: Schema.Schema<A, A2>) => {
      const fn = (args: LoaderFunctionArgs): Promise<ReactRouterData<A2, FormatInternalError<E>>> => {
        const context = args.context as unknown as RequestLoadContext<E, R>

        return context.runtime
          .runPromise(runSchema(schema, args), {
            signal: args.request.signal,
          })
          .then(toResponse)
      }

      Object.defineProperty(fn, 'effect', {
        enumerable: false,
        configurable: false,
        get: () => (args: LoaderFunctionArgs) => runSchema(schema, args).pipe(Effect.map(toResponse)),
      })

      return fn
    }

    json_.schema = schema

    return json_
  }

export const loader = make('loader')

export const action = make('action')
