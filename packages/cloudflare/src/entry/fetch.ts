import type { ExecutionContext } from '@cloudflare/workers-types'
import type * as HttpApi from '@effect/platform/HttpApi'
import * as HttpApiBuilder from '@effect/platform/HttpApiBuilder'
import * as HttpApp from '@effect/platform/HttpApp'
import type * as HttpRouter from '@effect/platform/HttpRouter'
import * as HttpServer from '@effect/platform/HttpServer'
import * as HttpServerError from '@effect/platform/HttpServerError'
import * as HttpServerResponse from '@effect/platform/HttpServerResponse'
import { CloudflareBindings } from '@xstack/cloudflare/bindings'
import * as CacheStorage from '@xstack/cloudflare/cache-storage'
import { makeConfigProvider } from '@xstack/cloudflare/config-provider'
import { CloudflareExecutionContext } from '@xstack/cloudflare/execution-context'
import { ScalarLayer } from '@xstack/server/api/scalar'
import { withGlobalLogLevel } from '@xstack/server/logger'
import * as Cause from 'effect/Cause'
import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import { pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import * as ManagedRuntime from 'effect/ManagedRuntime'

const isResponse = (value: any): value is Response => {
  return value && typeof value.status !== 'undefined'
}

export class CloudflareFetchHandle extends Context.Tag('@cloudflare:fetch-handle')<
  CloudflareFetchHandle,
  {
    readonly layer: Layer.Layer<HttpApi.Api, never, Layer.Layer.Context<typeof HttpServer.layerContext>>
    readonly handle?: ((request: Request) => Effect.Effect<Response | void, never, never>) | undefined
    readonly middleware?:
      | ((
          httpApp: HttpApp.Default,
        ) =>
          | HttpApp.Default<never, HttpApi.Api | HttpApiBuilder.Router | HttpRouter.HttpRouter.DefaultServices>
          | undefined)
      | undefined
  }
>() {
  static async runRaw(
    { request, env, context }: { request: Request; env: any; context: ExecutionContext },
    layer: Layer.Layer<never, never, never>,
    handle: Effect.Effect<Response, never, never>,
  ) {
    const Live = pipe(
      layer,
      Layer.provideMerge(
        Layer.mergeAll(
          CloudflareBindings.fromEnv(env),
          CloudflareExecutionContext.fromContext(context, env),
          CacheStorage.fromGlobalCaches,
          Layer.setConfigProvider(makeConfigProvider(env)),
        ),
      ),
      Layer.provide(withGlobalLogLevel(env)),
      Layer.tapErrorCause(Effect.logError),
      Layer.orDie,
    )

    const runtime = ManagedRuntime.make(Live)

    const program = Effect.gen(function* () {
      const fiber = runtime.runFork(handle, { immediate: true })

      request.signal?.addEventListener('abort', () => fiber.unsafeInterruptAsFork(HttpServerError.clientAbortFiberId), {
        once: true,
      })

      return yield* fiber.await.pipe(
        Effect.flatMap(
          Exit.match({
            onSuccess: Effect.succeed,
            onFailure: Effect.failCause,
          }),
        ),
      )
    })

    request.signal.addEventListener('abort', () => {
      context.waitUntil(pipe(runtime.disposeEffect, Effect.runPromise))
    })

    const response = await runtime.runPromise(program).catch((error) => {
      console.error(error)
      return new Response('Internal Server Error', { status: 500 })
    })

    if (response.status === 101) {
      if (!request.signal.aborted) {
        context.waitUntil(runtime.dispose())
      }
      return response
    }

    const { readable, writable } =
      // @ts-ignore
      typeof IdentityTransformStream !== 'undefined' ? new IdentityTransformStream() : new TransformStream()

    if (response.body) {
      context.waitUntil(
        response
          .body!.pipeTo(writable, {
            signal: request.signal,
            preventAbort: true,
            preventCancel: true,
            preventClose: false,
          })
          .finally(() => {
            if (!request.signal.aborted) {
              return runtime.dispose()
            }
          })
          .catch(() => {}),
      )
    } else {
      const writer = writable.getWriter()
      writer.close()

      if (!request.signal.aborted) {
        context.waitUntil(runtime.dispose())
      }
    }

    return new Response(readable, response)
  }

  static async run(
    { request, env, context }: { request: Request; env: any; context: ExecutionContext },
    layer: Layer.Layer<CloudflareFetchHandle, never, never>,
  ) {
    const DocsLive =
      // @ts-ignore
      process.env.NODE_ENV === 'production'
        ? Layer.empty
        : Layer.mergeAll(
            HttpApiBuilder.middlewareOpenApi({ path: '/api/openapi.json' }),
            ScalarLayer({ path: '/api/scalar' }),
          )

    const Live = pipe(
      DocsLive,
      Layer.provideMerge(Layer.unwrapEffect(Effect.map(CloudflareFetchHandle, (_) => _.layer))),
      Layer.provideMerge(
        Layer.mergeAll(
          layer,
          HttpServer.layerContext,
          CloudflareBindings.fromEnv(env),
          CloudflareExecutionContext.fromContext(context, env),
          CacheStorage.fromGlobalCaches,
          Layer.setConfigProvider(makeConfigProvider(env)),
        ),
      ),
      Layer.provide(withGlobalLogLevel(env)),
    )

    const runtime = ManagedRuntime.make(
      Layer.mergeAll(Live, HttpApiBuilder.Router.Live, HttpApiBuilder.Middleware.layer).pipe(
        Layer.tapErrorCause(Effect.logError),
        Layer.orDie,
      ),
      undefined,
    )

    const program = Effect.gen(function* () {
      const fetchHandle = yield* CloudflareFetchHandle

      if (fetchHandle.handle) {
        const res = yield* fetchHandle.handle(request)
        if (isResponse(res)) {
          return res
        }
      }

      const [app, rt] = yield* Effect.all([HttpApiBuilder.httpApp, runtime.runtimeEffect], { concurrency: 'unbounded' })

      const webHandle = HttpApp.toWebHandlerRuntime(rt)(
        pipe(
          fetchHandle.middleware ? (fetchHandle.middleware(app as any) as HttpServerResponse.HttpServerResponse) : app,
          Effect.catchIf(
            (errors) => (errors as HttpServerError.RouteNotFound)?._tag === 'RouteNotFound',
            () => HttpServerResponse.empty({ status: 404 }),
          ),
          Effect.catchAllCause((cause) => {
            if (Cause.isInterruptedOnly(cause)) {
              return HttpServerResponse.empty({ status: 499 })
            }
            return Effect.failCause(cause)
          }),
        ),
      )

      return yield* Effect.tryPromise(() => webHandle(request))
    })

    request.signal.addEventListener('abort', () => {
      context.waitUntil(pipe(runtime.disposeEffect, Effect.runPromise))
    })

    const { readable, writable } =
      // @ts-ignore
      typeof IdentityTransformStream !== 'undefined' ? new IdentityTransformStream() : new TransformStream()

    const response = await runtime.runPromise(program).catch((error) => {
      console.error(error)
      return new Response('Internal Server Error', { status: 500 })
    })

    if (response.body) {
      context.waitUntil(
        response
          .body!.pipeTo(writable, {
            signal: request.signal,
            preventAbort: true,
            preventCancel: true,
            preventClose: false,
          })
          .finally(() => {
            if (!request.signal.aborted) {
              return runtime.dispose()
            }
          })
          .catch(() => {}),
      )
    } else {
      const writer = writable.getWriter()
      writer.close()

      if (!request.signal.aborted) {
        context.waitUntil(runtime.dispose())
      }
    }

    return new Response(readable, response)
  }

  static make = <A>(
    layer: Layer.Layer<A | HttpApi.Api, never, Layer.Layer.Context<typeof HttpServer.layerContext>>,
    options?:
      | {
          readonly handle?: ((request: Request) => Effect.Effect<Response | void, never, never>) | undefined
          readonly middleware?:
            | ((
                httpApp: HttpApp.Default,
              ) => HttpApp.Default<never, HttpApi.Api | HttpApiBuilder.Router | HttpRouter.HttpRouter.DefaultServices>)
            | undefined
        }
      | undefined,
  ) =>
    Layer.succeed(CloudflareFetchHandle, {
      layer,
      handle: options?.handle,
      middleware: options?.middleware,
    })
}
