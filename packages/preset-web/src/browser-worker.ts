/// <reference lib="webworker" />
import { GlobalLogLevel } from '@xstack/fx/worker/runner'
import * as ConfigProvider from 'effect/ConfigProvider'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Logger from 'effect/Logger'
import * as LogLevel from 'effect/LogLevel'
import * as SubscriptionRef from 'effect/SubscriptionRef'

declare global {
  var logLevel: LogLevel.LogLevel
}

const getCurrentLogLevel = () => Effect.runSync(SubscriptionRef.get(GlobalLogLevel))

const LoggerLive = Logger.prettyLoggerDefault.pipe(
  Logger.filterLogLevel((level) => LogLevel.lessThanEqual(getCurrentLogLevel(), level)),
)

let devLogBuffers: any[] = []

const DevLogger = <M, O>(logger: Logger.Logger<M, O>): Logger.Logger<M, void> =>
  Logger.make<M, void>((opts) => {
    if (!LogLevel.lessThanEqual(getCurrentLogLevel(), opts.logLevel)) {
      return
    }
    const log = logger.log(opts)
    const externalReport =
      typeof globalThis !== 'undefined' && typeof (globalThis as any).externalReport === 'function'
        ? ((globalThis as any).externalReport as (...args: any) => void)
        : undefined

    if (externalReport) {
      const encoder = new TextEncoder()
      const encode = (log: any) => encoder.encode(JSON.stringify(log))
      if (devLogBuffers.length > 0) {
        devLogBuffers.forEach((item) => {
          externalReport('dev-logs', {}, encode(item))
        })
        devLogBuffers = []
      }
      externalReport('dev-logs', {}, encode(log))
    } else {
      devLogBuffers.push(log)
    }
  })

export const PrettyLogger = Logger.replace(Logger.defaultLogger, LoggerLive).pipe(
  Layer.provide(Logger.add(DevLogger(Logger.structuredLogger))),
)

export const ConfigProviderLive = Layer.suspend(() => {
  const envMap = new Map(
    Object.entries(import.meta.env)
      .filter(([key]) => key.startsWith('VITE_'))
      .map(([key, value]) => [key.replace('VITE_', ''), value]),
  )
  // @ts-ignore
  const map = globalThis.patchEnv?.(envMap) ?? envMap

  return Layer.setConfigProvider(ConfigProvider.fromMap(map))
})

export const BasicLive = Layer.mergeAll(PrettyLogger).pipe(
  Layer.provide([Logger.minimumLogLevel(LogLevel.All), ConfigProviderLive]),
)
