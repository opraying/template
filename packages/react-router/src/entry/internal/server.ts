import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as Cause from 'effect/Cause'
import { identity } from 'effect/Function'
import type * as ManagedRuntime from 'effect/ManagedRuntime'
import type * as Tracer from 'effect/Tracer'
import { isbot } from 'isbot'
import type { ReactNode } from 'react'
import type { ActionFunctionArgs, AppLoadContext, EntryContext, LoaderFunctionArgs } from 'react-router'

export interface PlatformConfig {
  component: (options: { context: EntryContext; loadContext: AppLoadContext; request: Request }) => ReactNode
  render: (options: {
    children: ReactNode
    isBot: boolean
    request: Request
    responseHeaders: Headers
    responseStatusCode: number
    headers?: Record<string, string> | undefined
    timeout: number
  }) => Promise<Response>
}

export interface UserConfig {
  headers?: Record<string, string> | undefined
  timeout?: number | undefined
  wrapper?:
    | (({
        children,
        request,
        context,
        loadContext,
      }: {
        children: ReactNode
        request: Request
        context: EntryContext
        loadContext: AppLoadContext
      }) => Promise<ReactNode>)
    | undefined
}

export function makeServer({ component, render }: PlatformConfig) {
  return ({ timeout, wrapper, headers }: UserConfig = {}) =>
    async function handleRequest(
      request: Request,
      responseStatusCode: number,
      responseHeaders: Headers,
      context: EntryContext,
      loadContext: AppLoadContext & {
        runtime: ManagedRuntime.ManagedRuntime<never, never>
        globalHandleRequestTraceSpan?: Tracer.AnySpan | undefined
      },
    ) {
      const parentRequestHandleTraceSpace = loadContext.globalHandleRequestTraceSpan
      const renderId = context.staticHandlerContext._deepestRenderedBoundaryId ?? 'root'
      const requestTimeout = timeout || 10_000

      return loadContext.runtime
        .runPromise(
          Effect.gen(function* () {
            const content = component({ context, loadContext, request })
            const children = wrapper
              ? yield* Effect.promise(() =>
                  wrapper({
                    children: content,
                    request,
                    context,
                    loadContext,
                  }),
                ).pipe(Effect.withSpan('ReactRouter.wrapper'))
              : content

            const isBot = isbot(request.headers.get('user-agent'))

            const response: Response = yield* Effect.promise(() =>
              render({
                children,
                isBot,
                headers,
                request,
                responseHeaders,
                responseStatusCode,
                timeout: requestTimeout,
              }),
            )

            const internalError = response.headers.get('X-Error-Status')

            if (internalError) {
              return new Response(response.body, {
                status: parseInt(internalError),
                statusText: response.statusText,
                headers: response.headers,
              })
            }

            return response
          }).pipe(
            Effect.exit,
            Effect.withSpan(`ReactRouter.render-${renderId}`),
            parentRequestHandleTraceSpace ? Effect.withParentSpan(parentRequestHandleTraceSpace) : identity,
          ),
        )
        .then((exit) =>
          Exit.match(exit, {
            onFailure: (cause) => Promise.reject(Cause.squash(cause)),
            onSuccess: identity,
          }),
        )
    }
}

const ignoreErrors = [400, 401, 403, 404, 429, 499]

export function handleError(error: unknown, { request }: LoaderFunctionArgs | ActionFunctionArgs) {
  if (request.signal.aborted) return
  let status = error instanceof Response ? error.status : (error as any)?.status
  if (ignoreErrors.includes(status)) return

  if (error instanceof Error) {
    if ((error as { _tag?: string })?._tag === 'RatelimitError') return

    console.log(`Handle Error: ${request.url}`, error)
  }
}
