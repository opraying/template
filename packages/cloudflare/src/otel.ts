import * as Otlp from '@effect/opentelemetry/Otlp'
import * as FetchHttpClient from '@effect/platform/FetchHttpClient'
import { ATTR_PROCESS_RUNTIME_NAME, ATTR_SERVICE_NAMESPACE } from '@opentelemetry/semantic-conventions/incubating'
import { OTEL_CONFIG, type OtelConfig } from '@xstack/otel/config'
import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'
import * as Layer from 'effect/Layer'
import * as Redacted from 'effect/Redacted'
import * as Clock from 'effect/Clock'
import * as DefaultServices from 'effect/DefaultServices'
import * as Context from 'effect/Context'
import { identity } from 'effect/Function'
import { CloudflareExecutionContext } from '@xstack/cloudflare/execution-context'

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

export const OtelLive = Layer.unwrapScoped(
  Effect.gen(function* () {
    const config = yield* OTEL_CONFIG.pipe(Effect.orDie)
    const { waitUntil } = yield* CloudflareExecutionContext.getRawContext()

    const destination = createDestinations(config)

    if (!destination) {
      return Layer.empty
    }

    return Otlp.layer({
      baseUrl: destination.baseUrl,
      resource: {
        serviceName: config.name ?? 'unknown',
        attributes: {
          [ATTR_SERVICE_NAMESPACE]: config.namespace,
          [ATTR_PROCESS_RUNTIME_NAME]: 'workerd',
        },
        serviceVersion: config.version,
      },
      headers: destination.headers,
    }).pipe(
      Layer.provide(FetchHttpClient.layer),
      Layer.provide(
        Layer.succeed(FetchHttpClient.Fetch, (input, init) => {
          let init_ = init

          if (input instanceof URL && input.pathname.endsWith('/logs')) {
            const data = decoder.decode(init!.body as any)
            const { resourceLogs }: { resourceLogs: ResourceLogsInput } = JSON.parse(data)
            const fixLogs = removeInvalidOtelIds(resourceLogs)
            const newBody = new TextEncoder().encode(JSON.stringify({ resourceLogs: fixLogs }))
            const headers = (init_?.headers ?? {}) as Record<string, string>
            headers['content-length'] = String(newBody.byteLength)
            init_ = {
              ...init_,
              headers,
              body: newBody,
            }
          }

          if (input instanceof URL && input.pathname.endsWith('/traces')) {
            const data = decoder.decode(init!.body as any)
            const { resourceSpans }: { resourceSpans: ResourceSpansInput } = JSON.parse(data)
            const fixTraces = removeInvalidOtelIdsFromTraces(resourceSpans)
            const newBody = new TextEncoder().encode(JSON.stringify({ resourceSpans: fixTraces }))
            const headers = (init_?.headers ?? {}) as Record<string, string>
            headers['content-length'] = String(newBody.byteLength)
            init_ = {
              ...init_,
              headers,
              body: newBody,
            }
          }

          return new Promise((resolve, reject) => {
            return waitUntil(globalThis.fetch(input, init_).then(resolve, reject))
          })
        }),
      ),
    )
  }),
)
type OtelProvider = 'axiom' | 'local'

function createDestinations(config: OtelConfig) {
  const provider = resolveProvider(Option.getOrUndefined(config.provider))
  const baseUrl = computeBaseUrl(provider)
  const headers = computeDefaultHeaders(
    provider,
    Option.match(config.apiKey, { onNone: () => '', onSome: Redacted.value }),
  )

  return { provider, baseUrl, headers }
}

function resolveProvider(provider: string | undefined): OtelProvider {
  switch (provider) {
    case 'axiom':
    case 'local':
      return provider
    default:
      return 'local'
  }
}

function computeBaseUrl(provider: OtelProvider, configuredUrl?: string | undefined): string {
  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, '')
  }

  switch (provider) {
    case 'axiom':
      return 'https://api.axiom.co'
    case 'local':
    default:
      return 'http://127.0.0.1:4318'
  }
}

function computeDefaultHeaders(provider: OtelProvider, apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {}

  if (provider === 'axiom') {
    headers.Authorization = `Bearer ${apiKey}`
    headers['X-Axiom-Dataset'] = 'xstack'
  }

  return headers
}
