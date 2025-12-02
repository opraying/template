/// <reference types="@cloudflare/workers-types" />
import type * as ManagedRuntime from 'effect/ManagedRuntime'
import * as Effect from 'effect/Effect'
import * as Predicate from 'effect/Predicate'
import * as Tracer from 'effect/Tracer'
import { type AppLoadContext, createRequestHandler } from 'react-router'

type Env = {
  ASSETS: Fetcher
}

function isRoutingRuleMatch(pathname: string, routingRule: string) {
  // sanity checks
  if (!pathname) {
    return false
  }
  if (!routingRule) {
    return false
  }
  const ruleRegExp = transformRoutingRuleToRegExp(routingRule)
  return pathname.match(ruleRegExp) !== null
}

function transformRoutingRuleToRegExp(rule: string) {
  let transformedRule: string

  if (rule === '/' || rule === '/*') {
    transformedRule = rule
  } else if (rule.endsWith('/*')) {
    // make `/*` an optional group so we can match both /foo/* and /foo
    // /foo/* => /foo(/*)?
    transformedRule = `${rule.substring(0, rule.length - 2)}(/*)?`
  } else if (rule.endsWith('/')) {
    // make `/` an optional group so we can match both /foo/ and /foo
    // /foo/ => /foo(/)?
    transformedRule = `${rule.substring(0, rule.length - 1)}(/)?`
  } else if (rule.endsWith('*')) {
    transformedRule = rule
  } else {
    transformedRule = `${rule}(/)?`
  }

  // /foo* => /foo.* => ^/foo.*$
  // /*.* => /*\.* => /.*\..* => ^/.*\..*$
  transformedRule = `^${transformedRule.replaceAll(/\./g, '\\.').replaceAll(/\*/g, '.*')}$`

  // ^/foo.*$ => /^\/foo.*$/
  return new RegExp(transformedRule)
}

const extractTraceId = (traceParent: string) => {
  const splitId = traceParent.split('-')

  const version = splitId[0]
  const traceId = splitId[1]
  const parentId = splitId[2]
  const flags = splitId[3]

  return {
    flags,
    parentId,
    traceId,
    version,
  }
}

const withParentRequestTrace =
  <A, E, R>(request: Request) =>
  (effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> => {
    const traceParent = request.headers.get('traceparent')

    let requestSpan: Tracer.ExternalSpan | undefined

    if (traceParent) {
      const { parentId, traceId } = extractTraceId(traceParent)
      if (!traceId || !parentId) {
        return effect
      }

      requestSpan = Tracer.externalSpan({
        spanId: parentId,
        traceId,
        sampled: true,
      })

      return Effect.withParentSpan(effect, requestSpan)
    }

    return effect
  }

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
  globalHandleRequestTraceSpan?: Tracer.AnySpan | undefined
}

export const make = ({
  reactRouterBuild,
  contextBuilder,
  routingRules,
}: {
  reactRouterBuild: any
  contextBuilder: { getLoadContext: (params: LoadContextParams) => HandleAppLoadContext }
  routingRules: { include: string[]; exclude: string[] }
}) => {
  const handler = createRequestHandler(reactRouterBuild, 'production')

  return async (request: Request, env: Env, context: EventContext<Env, any, Record<string, unknown>>) => {
    const { pathname } = new URL(request.url)

    for (const exclude of routingRules.exclude) {
      if (isRoutingRuleMatch(pathname, exclude)) {
        return new Response(null, { status: 404 })
      }
    }

    for (const include of routingRules.include) {
      if (isRoutingRuleMatch(pathname, include)) {
        const waitUntil = (promise: Promise<any>) => context.waitUntil(promise)

        const passThroughOnException = () => context.passThroughOnException()

        const { getLoadContext } = contextBuilder

        const appLoadContext = getLoadContext({
          env,
          caches: globalThis.caches,
          waitUntil,
          passThroughOnException,
        })

        request.signal.addEventListener('abort', () => {
          context.waitUntil(appLoadContext.runtime.dispose())
        })

        const disableTrace = [/^\/__manifest/].some((reg) => reg.test(pathname))

        return Effect.gen(function* () {
          yield* Effect.promise(() => {
            Object.assign(globalThis, {
              i18nDetectRequestHook: (detect: any) => detect(request),
            })

            // @ts-ignore
            let promise: Promise<void> | void = globalThis.initI18n()

            return Predicate.isPromiseLike(promise) ? promise : Promise.resolve(promise)
          }).pipe(Effect.withSpan('ReactRouter.initI18n'))

          const { readable, writable } = new IdentityTransformStream()

          const response: Response = yield* Effect.currentSpan.pipe(
            Effect.tap((traceSpan) => {
              if (!disableTrace) {
                appLoadContext.globalHandleRequestTraceSpan = traceSpan
              }
            }),
            Effect.zipRight(Effect.promise(() => handler(request as any, appLoadContext as unknown as AppLoadContext))),
            Effect.orElseSucceed(() => new Response('Internal Server Error', { status: 500 })),
            Effect.withSpan('ReactRouter.handleRequest'),
          )

          if (response.body) {
            context.waitUntil(
              response
                .body!.pipeTo(writable, {
                  signal: request.signal as any,
                  preventAbort: true,
                  preventCancel: true,
                  preventClose: false,
                })
                .finally(() => {
                  if (!request.signal.aborted) {
                    return appLoadContext.runtime.dispose()
                  }
                })
                .catch(() => {}),
            )
          } else {
            const writer = writable.getWriter()
            writer.close()

            if (!request.signal.aborted) {
              context.waitUntil(appLoadContext.runtime.dispose())
            }
          }

          const internalErrorStatus = response.headers.get('X-Error-Status')

          if (internalErrorStatus) {
            response.headers.delete('X-Error-Status')
          }

          const status = request.signal.aborted
            ? 499
            : internalErrorStatus
              ? parseInt(internalErrorStatus, 10)
              : response.status

          return new Response(readable, {
            status,
            statusText: response.statusText,
            headers: response.headers,
          })
        }).pipe(
          Effect.tap((response) =>
            Effect.annotateCurrentSpan({
              'http.response.status_code': response.status,
              'http.status_code': response.status,
            }),
          ),
          Effect.withSpan('ReactRouter.handle', {
            attributes: {
              'http.request.method': request.method,
              'http.method': request.method,
              'url.full': request.url,
              'http.url': request.url,
            },
          }),
          withParentRequestTrace(request),
          Effect.withTracerEnabled(!disableTrace),
          appLoadContext.runtime.runPromise,
        )
      }
    }

    return env.ASSETS.fetch(request as any)
  }
}
