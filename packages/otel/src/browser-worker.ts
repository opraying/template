/// <reference lib="webworker" />
import * as Otlp from '@effect/opentelemetry/Otlp'
import * as HttpClient from '@effect/platform/HttpClient'
import * as HttpClientResponse from '@effect/platform/HttpClientResponse'
import { ATTR_PROCESS_RUNTIME_NAME, ATTR_SERVICE_NAMESPACE } from '@opentelemetry/semantic-conventions/incubating'
import type { GlobalSend, OtelMessage } from '@xstack/otel/browser-provider'
import { OTEL_CONFIG } from '@xstack/otel/config'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as RuntimeFlags from 'effect/RuntimeFlags'

const offer = (_: any) => Effect.sync(() => self.postMessage([98, _]))

export const OtelLive = Layer.unwrapScoped(
  Effect.gen(function* () {
    const config = yield* OTEL_CONFIG.pipe(Effect.orDie)

    ////
    ;(globalThis as any).externalReport = ((
      type: OtelMessage['type'],
      params: any,
      data: Uint8Array<ArrayBufferLike>,
    ) => {
      const messageData = {
        type: type,
        params: params,
        data: data,
      }

      Effect.runFork(offer(messageData).pipe(Effect.provide(RuntimeFlags.disableRuntimeMetrics)))
    }) as GlobalSend
    ////

    return Otlp.layer({
      baseUrl: 'http://localhost',
      resource: {
        serviceName: config.name,
        attributes: {
          [ATTR_SERVICE_NAMESPACE]: config.namespace,
          [ATTR_PROCESS_RUNTIME_NAME]: 'webworker',
        },
        serviceVersion: config.version,
      },
    }).pipe(Layer.provide(make))
  }),
)

const fetch: HttpClient.HttpClient = HttpClient.make((request, url) => {
  const emptyResponse = HttpClientResponse.fromWeb(request, new Response())

  const send = Effect.fn(function* (body: BodyInit | undefined) {
    if (!body) {
      return emptyResponse
    }

    const { pathname } = url
    const type: OtelMessage['type'] =
      pathname.indexOf('/traces') > -1
        ? 'traces'
        : pathname.indexOf('/metrics') > -1
          ? 'metrics'
          : pathname.indexOf('/dev-logs') > -1
            ? 'dev-logs'
            : 'logs'

    const params = {
      headers: request.headers,
      method: request.method,
    }

    return yield* offer({ type, params, data: body as any }).pipe(
      Effect.map(() => emptyResponse),
      Effect.catchAll(() =>
        Effect.succeed(HttpClientResponse.fromWeb(request, new Response('failed export', { status: 500 }))),
      ),
      Effect.provide(RuntimeFlags.disableRuntimeMetrics),
    )
  })

  switch (request.body._tag) {
    case 'Raw':
    case 'Uint8Array':
      return send(request.body.body as any)
    case 'FormData':
      return send(request.body.formData)
    case 'Stream':
      return Effect.dieMessage("Stream don't support")
  }

  return send(undefined)
})

export const make = HttpClient.layerMergedContext(Effect.succeed(fetch))
