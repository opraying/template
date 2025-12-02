import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import type { Fetcher } from '@cloudflare/workers-types'

export interface ExecutionContext {
  readonly waitUntil: (promise: Promise<any>) => void
  readonly passThroughOnException?: () => void
  readonly props?: any
}

interface CloudflareContext {
  /**
   * Extends the lifetime of the Worker, allowing work to continue after a response is returned.
   * Accepts a Promise that the Workers runtime will continue executing.
   */
  readonly waitUntil: (promise: Promise<any>) => Effect.Effect<void, never, never>

  /**
   * Allows a Worker to fail open and pass a request through to an origin server
   * when the Worker throws an unhandled exception.
   */
  readonly passThroughOnException: () => Effect.Effect<void, never, never>

  /**
   * Get the raw ExecutionContext object for direct access if needed.
   */
  readonly getRawContext: () => Effect.Effect<ExecutionContext, never, never>
}

const make = (ctx: ExecutionContext): CloudflareContext => {
  return {
    waitUntil: (promise: Promise<any>): Effect.Effect<void, never, never> => Effect.sync(() => ctx.waitUntil(promise)),
    passThroughOnException: (): Effect.Effect<void, never, never> => Effect.sync(() => ctx.passThroughOnException?.()),
    getRawContext: (): Effect.Effect<ExecutionContext, never, never> => Effect.succeed(ctx),
  }
}

export class CloudflareExecutionContext extends Context.Tag('@cloudflare:execution-context')<
  CloudflareExecutionContext,
  CloudflareContext
>() {
  static fromContext(
    ctx: ExecutionContext,
    env: Record<string, any>,
  ): Layer.Layer<CloudflareExecutionContext, never, never> {
    let waitUntil = (promise: Promise<void>) => ctx.waitUntil(promise)

    // @ts-ignore
    if (process.env.NODE_ENV === 'development') {
      if (env && env['DEV_WAIT_UNTIL_PROXY']) {
        const proxy: Fetcher = env['DEV_WAIT_UNTIL_PROXY']

        const notify = (id: string, status: string, error?: string | undefined) => {
          return ctx.waitUntil(proxy.fetch(`http://localhost?id=${id}&status=${status}&error=${error}`).catch(() => {}))
        }

        waitUntil = (promise: Promise<void>) => {
          const id = crypto.randomUUID()
          notify(id, 'pending')

          ctx.waitUntil(
            new Promise((resolve, reject) => {
              promise
                .then((_) => {
                  notify(id, 'resolve')
                  resolve(_)

                  return _
                })
                .catch((err) => {
                  notify(id, 'reject', JSON.stringify(err))
                  reject(err)
                })
            }),
          )
        }
      }
    }
    return Layer.succeed(
      CloudflareExecutionContext,
      make({
        waitUntil,
        passThroughOnException: () => ctx.passThroughOnException?.(),
        props: ctx.props,
      }),
    )
  }

  static use<A>(fn: (ctx: CloudflareContext) => Effect.Effect<A, never, never>): Effect.Effect<A, never, never> {
    return pipe(
      Effect.context<never>(),
      Effect.flatMap((ctx) => fn(Context.unsafeGet(ctx, CloudflareExecutionContext))),
    )
  }

  static getRawContext(): Effect.Effect<ExecutionContext, never, never> {
    return CloudflareExecutionContext.use((ctx) => ctx.getRawContext())
  }
}
