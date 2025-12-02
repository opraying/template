import * as FetchHttpClient from '@effect/platform/FetchHttpClient'
import * as HttpClient from '@effect/platform/HttpClient'
import * as HttpClientError from '@effect/platform/HttpClientError'
import * as HttpClientRequest from '@effect/platform/HttpClientRequest'
import * as HttpClientResponse from '@effect/platform/HttpClientResponse'
import * as HttpServerRequest from '@effect/platform/HttpServerRequest'
import { CloudflareBindings } from '@xstack/cloudflare/bindings'
import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as FiberRef from 'effect/FiberRef'
import { flow, type LazyArg, pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import * as Option from 'effect/Option'
import * as Schedule from 'effect/Schedule'
import * as Stream from 'effect/Stream'

const ReactRouterAppLoadTagKey = '@react-router:request-context'

const fetch: HttpClient.HttpClient = HttpClient.make((request, url, signal, fiber) => {
  const context = fiber.getFiberRef(FiberRef.currentContext)
  const fetch: typeof globalThis.fetch = context.unsafeMap.get(FetchHttpClient.Fetch.key) ?? globalThis.fetch

  const getOptions = () => {
    // Start with headers explicitly set on the HttpClientRequest instance
    const outgoingHeaders = new globalThis.Headers(request.headers)

    // Define the whitelist of headers allowed to be forwarded from the broader context
    // (e.g., incoming HTTP request). Case-insensitive check is used later.
    const contextHeaderWhitelist = new Set([
      'cookie',
      'authorization',
      'accept',
      'accept-language',
      'user-agent',
      'x-forwarded-for',
      'x-real-ip',
      'x-request-id',
      'b3',
      'traceparent',
    ])

    // Extract headers potentially inherited from the broader Effect context.
    // This could be from an incoming HTTP request, React router context, etc.
    let contextHeaders: HeadersInit | undefined
    if (context.unsafeMap.has(FetchHttpClient.RequestInit.key)) {
      contextHeaders = (context.unsafeMap.get(FetchHttpClient.RequestInit.key) as globalThis.RequestInit).headers
    } else if (context.unsafeMap.has(ReactRouterAppLoadTagKey)) {
      contextHeaders = (context.unsafeMap.get(ReactRouterAppLoadTagKey) as { request: globalThis.Request }).request
        .headers
    } else if (context.unsafeMap.has(HttpServerRequest.HttpServerRequest.key)) {
      contextHeaders = (
        context.unsafeMap.get(HttpServerRequest.HttpServerRequest.key) as HttpServerRequest.HttpServerRequest
      ).headers
    }

    // Merge whitelisted headers from the context into the outgoing headers.
    // This only adds headers from the context if they are in the whitelist AND
    // were not already set explicitly on the HttpClientRequest or by OTel injection.
    // Precedence: Explicit Request Headers > OTel Headers > Whitelisted Context Headers.
    if (contextHeaders) {
      const processContextHeaders = (headersToProcess: HeadersInit) => {
        // Helper to iterate over different HeadersInit types
        const iterableHeaders: Iterable<[string, string]> =
          headersToProcess instanceof Headers
            ? headersToProcess.entries()
            : Array.isArray(headersToProcess)
              ? headersToProcess
              : typeof headersToProcess === 'object' && headersToProcess !== null
                ? Object.entries(headersToProcess)
                : [] // Handle null or non-object cases gracefully

        for (const [key, value] of iterableHeaders) {
          // Check against the whitelist (case-insensitive)
          if (contextHeaderWhitelist.has(key.toLowerCase())) {
            // Only add the header if it's not already present in outgoingHeaders
            if (!outgoingHeaders.has(key)) {
              outgoingHeaders.set(key, value)
            }
          }
        }
      }
      processContextHeaders(contextHeaders)
    }

    // Set a default Content-Type if none was provided explicitly or inherited.
    // Avoid setting Content-Type for FormData, as fetch handles this automatically
    // with the correct boundary.
    if (!outgoingHeaders.has('Content-Type') && request.body._tag !== 'FormData') {
      outgoingHeaders.set('Content-Type', 'application/json')
    }

    return {
      headers: outgoingHeaders,
      signal,
      duplex: request.body._tag === 'Stream' ? 'half' : undefined,
    }
  }

  const send = (body: BodyInit | undefined) =>
    Effect.map(
      Effect.tryPromise({
        try: () =>
          fetch(url, {
            method: request.method,
            body,
            ...getOptions(),
          } as any),
        catch: (cause) =>
          new HttpClientError.RequestError({
            request,
            reason: 'Transport',
            cause,
          }),
      }),
      (response) => HttpClientResponse.fromWeb(request, response),
    )

  switch (request.body._tag) {
    case 'Raw':
    case 'Uint8Array':
      return send(request.body.body as any)
    case 'FormData':
      return send(request.body.formData)
    case 'Stream':
      return Effect.flatMap(Stream.toReadableStreamEffect(request.body.stream), send)
  }

  return send(undefined)
})

/** @internal */
const layer = HttpClient.layerMergedContext(Effect.succeed(fetch))

export const make = <E1>(
  name: string,
  bindingName: LazyArg<string>,
  options?:
    | {
        transformClient?: ((httpClient: HttpClient.HttpClient) => HttpClient.HttpClient) | undefined
        transformResponse?:
          | (<R1 = never>(
              res: HttpClientResponse.HttpClientResponse,
            ) => Effect.Effect<HttpClientResponse.HttpClientResponse, E1, R1>)
          | undefined
      }
    | undefined,
) =>
  layer.pipe(
    Layer.provide(
      Layer.effect(
        FetchHttpClient.Fetch,
        pipe(
          CloudflareBindings.use((bindings) =>
            pipe(
              bindings.getFetcher(bindingName()),
              Effect.flatMap(
                Option.match({
                  onNone: () => Effect.dieMessage(`Fetch not found: ${bindingName()}`),
                  onSome: Effect.succeed,
                }),
              ),
            ),
          ),
          Effect.map((fetcher) => fetcher.fetch.bind(fetcher)),
        ),
      ),
    ),
    Layer.map((_) => {
      let update = (fn: (_: HttpClient.HttpClient) => HttpClient.HttpClient) =>
        Context.merge(_, Context.make(HttpClient.HttpClient, fn(Context.get(_, HttpClient.HttpClient))))

      if (options?.transformClient) {
        return update(options.transformClient)
      }

      return update(
        flow(
          HttpClient.mapRequest(HttpClientRequest.prependUrl('http://localhost')),
          HttpClient.transformResponse((_) =>
            options?.transformResponse ? (Effect.flatMap(_, options.transformResponse) as typeof _) : _,
          ),
          HttpClient.retryTransient({
            schedule: Schedule.linear('100 millis'),
            times: 5,
          }),
        ),
      )
    }),
  )
