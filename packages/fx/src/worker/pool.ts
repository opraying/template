import * as EffectWorker from '@effect/platform/Worker'
import * as BrowserWorker from '@effect/platform-browser/BrowserWorker'
import * as WorkerRunnerSchema from '@xstack/fx/worker/schema'
import * as OtelGlobals from '@xstack/otel/session/globals'
import { findCookieByName } from '@xstack/react-router/cookie'
import * as Context from 'effect/Context'
import type { DurationInput } from 'effect/Duration'
import * as Effect from 'effect/Effect'
import * as LogLevel from 'effect/LogLevel'
import * as RuntimeFlags from 'effect/RuntimeFlags'
import type * as Schema from 'effect/Schema'

export const getWorkerType = () => {
  // @ts-ignore
  const isDesktop: boolean = globalThis.isDesktop || (typeof window !== 'undefined' && '__TAURI__' in window)

  return isDesktop ? 'desktop-worker' : 'web'
}

export interface CoreWorkerPool<I extends Schema.TaggedRequest.All> extends EffectWorker.SerializedWorkerPool<I> {}
export const CoreWorkerPool = Context.GenericTag<CoreWorkerPool<any>>('@client:core-worker-pool')

export type PoolOptions =
  | {
      size: number
      concurrency?: number
      workerFactory: (id: number) => Worker
    }
  | {
      maxSize: number
      minSize: number
      concurrency?: number
      targetUtilization?: number
      timeToLive: DurationInput
      workerFactory: (id: number) => Worker
    }

export const LogStorageKey = 'x-log-level'

export const getCurrentLogLevel = () => {
  if (import.meta.env.DEV) {
    const logLevel: LogLevel.Literal =
      // @ts-ignore
      globalThis.__x_log_level || (typeof localStorage !== 'undefined' && localStorage.getItem(LogStorageKey))

    const level = logLevel ? LogLevel.fromLiteral(logLevel) : LogLevel.All

    return level
  }

  return LogLevel.Info
}

export const make = (options: PoolOptions) =>
  Effect.gen(function* () {
    let devMetricsHandle = (_data: any) => {}

    const { workerFactory, ...rest } = options
    const makeWorker = BrowserWorker.layer((id) => {
      const worker = workerFactory(id)

      worker.addEventListener('message', (event) => {
        const eventData = event.data

        if (Array.isArray(eventData)) {
          const [port, data] = eventData

          if (port === 98) {
            try {
              if (data.type === 'dev-metrics') {
                try {
                  devMetricsHandle(data.data)
                } catch {}

                return
              }
              ;(globalThis as any).externalReport(data.type, data.params, data.data)
            } catch {}

            return
          }

          return
        }
      })

      return worker
    })

    const pool = yield* EffectWorker.makePoolSerialized<WorkerRunnerSchema.WorkerMessage>({
      ...rest,
      initialMessage: () => {
        const token = findCookieByName('x-session', document.cookie)

        return new WorkerRunnerSchema.InitialMessage({
          sessionId: OtelGlobals.rumSessionId,
          logLevel: getCurrentLogLevel()._tag,
          token,
        })
      },
    }).pipe(Effect.provide(makeWorker), Effect.provide(RuntimeFlags.disableRuntimeMetrics))

    yield* Effect.addFinalizer(() => {
      //@ts-ignore
      globalThis.__x_worker_metrics = null
      //@ts-ignore
      globalThis.__x_log_change = null

      return pool.executeEffect(new WorkerRunnerSchema.RunnerInterrupt()).pipe(Effect.ignore)
    })

    if (import.meta.env.DEV) {
      //@ts-ignore
      globalThis.__x_worker_metrics = (cb) => {
        devMetricsHandle = cb
      }
    }

    OtelGlobals.eventTarget.addEventListener('session-changed', ({ payload }) => {
      Effect.runFork(
        pool.executeEffect(
          new WorkerRunnerSchema.WorkerConfigChange({
            sessionId: payload.sessionId,
          }),
        ),
      )
    })

    //@ts-ignore
    globalThis.__x_log_change = (level: LogLevel['_tag']) => {
      Effect.runFork(
        pool.executeEffect(
          new WorkerRunnerSchema.WorkerConfigChange({
            logLevel: level,
          }),
        ),
      )
    }

    //@ts-ignore
    globalThis.__x_token_change = (forceToken?: string | undefined) => {
      const token = forceToken ?? findCookieByName('x-session', document.cookie)

      Effect.runFork(
        pool.executeEffect(
          new WorkerRunnerSchema.WorkerConfigChange({
            token,
          }),
        ),
      )
    }

    return pool
  })
