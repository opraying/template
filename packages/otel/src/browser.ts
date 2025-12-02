import * as Otlp from '@effect/opentelemetry/Otlp'
import { layerWebSocket } from '@effect/platform-browser/BrowserSocket'
import * as HttpClient from '@effect/platform/HttpClient'
import * as HttpClientResponse from '@effect/platform/HttpClientResponse'
import * as Socket from '@effect/platform/Socket'
import { ATTR_SERVICE_NAMESPACE } from '@opentelemetry/semantic-conventions/incubating'
import type { ExportError, GlobalSend, OtelMessage } from '@xstack/otel/browser-provider'
import { OTEL_CONFIG } from '@xstack/otel/config'
import * as Chunk from 'effect/Chunk'
import * as Context from 'effect/Context'
import * as Deferred from 'effect/Deferred'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as FiberRef from 'effect/FiberRef'
import * as Layer from 'effect/Layer'
import * as Option from 'effect/Option'
import * as Queue from 'effect/Queue'
import * as RuntimeFlags from 'effect/RuntimeFlags'

type ILogRecord = {
  /** LogRecord traceId */
  traceId?: string | Uint8Array
  /** LogRecord spanId */
  spanId?: string | Uint8Array
}

type ResourceLogsInput = Array<{
  scopeLogs: Array<{ logRecords: Array<ILogRecord> }>
}>

type ISpanLink = {
  traceId?: string | Uint8Array
  spanId?: string | Uint8Array
  attributes?: Array<any>
  droppedAttributesCount?: number
}

type ISpan = {
  traceId?: string | Uint8Array
  spanId?: string | Uint8Array
  links?: Array<ISpanLink>
  [key: string]: any
}

type ResourceSpansInput = Array<{
  scopeSpans: Array<{ spans: Array<ISpan> }>
}>

/**
 * Fixes OpenTelemetry logs by removing "noop" or invalid trace/span IDs.
 */
function removeInvalidOtelIds(logsInput: ResourceLogsInput): ResourceLogsInput {
  logsInput.forEach((resourceLog) => {
    resourceLog.scopeLogs.forEach((scopeLog) => {
      scopeLog.logRecords.forEach((logRecord) => {
        // Check if traceId is invalid ("noop" or potentially other invalid forms)
        const isTraceIdInvalid =
          logRecord.traceId === 'noop' ||
          (typeof logRecord.traceId === 'string' && logRecord.traceId.length > 0 && logRecord.traceId.length !== 32) ||
          (logRecord.traceId instanceof Uint8Array && logRecord.traceId.length !== 16)

        if (isTraceIdInvalid) {
          // Set to undefined or delete the property
          delete logRecord.traceId
        }

        // Check if spanId is invalid ("noop" or potentially other invalid forms)
        const isSpanIdInvalid =
          logRecord.spanId === 'noop' ||
          (typeof logRecord.spanId === 'string' && logRecord.spanId.length > 0 && logRecord.spanId.length !== 16) ||
          (logRecord.spanId instanceof Uint8Array && logRecord.spanId.length !== 8)

        if (isSpanIdInvalid) {
          // Set to undefined or delete the property
          delete logRecord.spanId
        }
      })
    })
  })

  return logsInput
}

/**
 * Fixes OpenTelemetry traces by removing invalid trace/span IDs from links.
 */
function removeInvalidOtelIdsFromTraces(tracesInput: ResourceSpansInput): ResourceSpansInput {
  tracesInput.forEach((resourceSpan) => {
    resourceSpan.scopeSpans.forEach((scopeSpan) => {
      scopeSpan.spans.forEach((span) => {
        if (span.links && Array.isArray(span.links)) {
          // Filter out links with invalid traceId or spanId
          span.links = span.links.filter((link) => {
            const isTraceIdValid =
              link.traceId !== 'noop' &&
              (typeof link.traceId === 'string' ? link.traceId.length === 32 : true) &&
              (link.traceId instanceof Uint8Array ? link.traceId.length === 16 : true)

            const isSpanIdValid =
              link.spanId !== 'noop' &&
              (typeof link.spanId === 'string' ? link.spanId.length === 16 : true) &&
              (link.spanId instanceof Uint8Array ? link.spanId.length === 8 : true)

            return isTraceIdValid && isSpanIdValid
          })
        }
      })
    })
  })

  return tracesInput
}

const decoder = new TextDecoder()
const encoder = new TextEncoder()

interface ExportMessage {
  id: number
  data: OtelMessage
}

const ExportQueue = Context.GenericTag<{
  queue: Queue.Queue<ExportMessage>
  offer: (_: OtelMessage) => Effect.Effect<void>
  complete: (id: string, _: Exit.Exit<void, ExportError>) => Effect.Effect<void>
}>('@otel/otel-export-queue')

const WSLive = layerWebSocket('/telemetry', { closeCodeIsError: () => false })

export const OtelLive = Layer.unwrapScoped(
  Effect.gen(function* () {
    const exporter = yield* ExportQueue
    const socket = yield* Socket.Socket
    const config = yield* OTEL_CONFIG.pipe(Effect.orDie)

    yield* socket
      .runRaw((message) =>
        Effect.gen(function* () {
          const response =
            message instanceof Uint8Array ? JSON.parse(String.fromCharCode(...message)) : JSON.parse(message)

          if (response.type === 'ack' && response.id) {
            if (response.error) {
              const err = new Error(response.error)
              // @ts-ignore
              err.code = -1

              yield* exporter.complete(response.id, Exit.fail(err))
            } else {
              yield* exporter.complete(response.id, Exit.void)
            }
          }
        }),
      )
      .pipe(Effect.forkScoped, Effect.provide(RuntimeFlags.disableRuntimeMetrics))

    ////
    ;(globalThis as any).externalReport = ((
      type: OtelMessage['type'],
      params: any,
      data: Uint8Array<ArrayBufferLike>,
    ) =>
      Effect.runFork(
        exporter.offer({ type, params, data }).pipe(Effect.provide(RuntimeFlags.disableRuntimeMetrics)),
      )) as GlobalSend
    ////

    yield* socket.writer.pipe(
      Effect.flatMap((send) =>
        Queue.take(exporter.queue).pipe(
          Effect.flatMap((message) => {
            let data = message.data.data

            if (message.data.type === 'logs') {
              const { resourceLogs }: { resourceLogs: ResourceLogsInput } = JSON.parse(
                decoder.decode(message.data.data),
              )
              const fixLogs = removeInvalidOtelIds(resourceLogs)
              data = encoder.encode(JSON.stringify({ resourceLogs: fixLogs }))
            }
            if (message.data.type === 'traces') {
              const { resourceSpans }: { resourceSpans: ResourceSpansInput } = JSON.parse(
                decoder.decode(message.data.data),
              )
              const fixTraces = removeInvalidOtelIdsFromTraces(resourceSpans)
              data = encoder.encode(JSON.stringify({ resourceSpans: fixTraces }))
            }

            const messageData = encoder.encode(
              JSON.stringify({
                id: message.id,
                type: message.data.type,
                params: message.data.params,
                data: Array.from(data),
              }),
            )

            return send(messageData)
          }),
          Effect.forever,
          Effect.interruptible,
          Effect.forkScoped,
          Effect.provide(RuntimeFlags.disableRuntimeMetrics),
        ),
      ),
    )

    yield* Effect.addFinalizer(() =>
      Effect.gen(function* () {
        const send = yield* socket.writer
        const messages = yield* Queue.takeAll(exporter.queue)

        yield* Effect.forEach(Chunk.toArray(messages), (message) => {
          const messageData = encoder.encode(
            JSON.stringify({
              id: message.id,
              type: message.data.type,
              params: message.data.params,
              data: Array.from(message.data.data),
            }),
          )

          return send(messageData).pipe(Effect.ignore)
        })

        ////
        ;(globalThis as any).externalReport = null
        ////
      }).pipe(Effect.provide(RuntimeFlags.disableRuntimeMetrics)),
    )

    return Otlp.layer({
      baseUrl: 'http://localhost',
      resource: {
        serviceName: config.name,
        attributes: {
          [ATTR_SERVICE_NAMESPACE]: config.namespace,
        },
        serviceVersion: config.version,
      },
    }).pipe(Layer.provide(make))
  }),
).pipe(
  Layer.provide(WSLive),
  Layer.provide(
    Layer.effect(
      ExportQueue,
      Effect.gen(function* () {
        let id = 0
        const queue = yield* Queue.unbounded<ExportMessage>()
        const ack = new Map<number, Deferred.Deferred<void, ExportError>>()

        const offer = Effect.fn(function* (message: OtelMessage) {
          id += 1
          const deferred = yield* Deferred.make<void, ExportError>()
          ack.set(id, deferred)
          yield* Queue.offer(queue, { id, data: message })

          return yield* Deferred.await(deferred)
        }, Effect.provide(RuntimeFlags.disableRuntimeMetrics))

        const complete = Effect.fn(function* (id: number, exit: Exit.Exit<void, ExportError>) {
          const deferred = ack.get(id)
          if (!deferred) return

          yield* Deferred.done(deferred, exit)
        }, Effect.provide(RuntimeFlags.disableRuntimeMetrics))

        return {
          queue,
          offer,
          complete,
        } as any
      }),
    ),
  ),
)

const fetch: HttpClient.HttpClient = HttpClient.make((request, url, _signal, fiber) => {
  const context = fiber.getFiberRef(FiberRef.currentContext)
  const exporter = Context.getOption(context, ExportQueue)
  const emptyResponse = HttpClientResponse.fromWeb(request, new Response())

  const send = Effect.fn(function* (body: BodyInit | undefined) {
    if (Option.isNone(exporter) || !body) {
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

    return yield* exporter.value.offer({ type, params, data: body as any }).pipe(
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
