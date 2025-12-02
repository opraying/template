import * as GlobalLayer from '@xstack/atom-react/global'
import { I18n } from '@xstack/i18n/i18n'
import { I18nLive } from '@xstack/i18n/browser'
import { OtelLive } from '@xstack/otel/browser'
import { Navigate } from '@xstack/router'
import { AppearanceLive, Appearance } from '@xstack/lib/appearance'
import { ReactRouterNavigate as NavigateLive } from '@xstack/router/react-router-layer'
import { Toaster } from '@xstack/toaster'
import { WebToaster as ToasterLive } from '@xstack/toaster/web-layer'
import * as ConfigProvider from 'effect/ConfigProvider'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import * as Logger from 'effect/Logger'
import * as LogLevel from 'effect/LogLevel'
import * as Tracer from 'effect/Tracer'

export const LogStorageKey = 'x-log-level'

export const getCurrentLogLevel = () => {
  if (import.meta.env.DEV) {
    const logLevel: LogLevel.Literal =
      // @ts-ignore
      globalThis.__x_log_level || (typeof localStorage !== 'undefined' && localStorage.getItem(LogStorageKey))

    const level = logLevel ? LogLevel.fromLiteral(logLevel) : LogLevel.All

    return level
  }

  return LogLevel.Warning
}

const LoggerLive = Logger.prettyLoggerDefault.pipe(
  Logger.filterLogLevel((level) => LogLevel.lessThanEqual(getCurrentLogLevel(), level)),
)

let devLogBuffer: any[] = []

const DevLogger = <M, O>(self: Logger.Logger<M, O>): Logger.Logger<M, void> =>
  Logger.make<M, void>((opts) => {
    if (!LogLevel.lessThanEqual(getCurrentLogLevel(), opts.logLevel)) {
      return
    }
    const log = self.log(opts)
    const externalReport =
      typeof globalThis !== 'undefined' && typeof (globalThis as any).externalReport === 'function'
        ? ((globalThis as any).externalReport as (...args: any) => void)
        : undefined

    if (externalReport) {
      const encoder = new TextEncoder()
      const encode = (log: any) => encoder.encode(JSON.stringify(log))
      if (devLogBuffer.length > 0) {
        devLogBuffer.forEach((item) => {
          externalReport('dev-logs', {}, encode(item))
        })
        devLogBuffer = []
      }
      externalReport('dev-logs', {}, encode(log))
    } else {
      devLogBuffer.push(log)
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

const TracerLive = Layer.unwrapEffect(
  Effect.gen(function* () {
    const tracer = yield* Effect.withFiberRuntime<Tracer.Tracer>((_) => Effect.succeed(_.currentTracer))
    return Layer.succeed(Tracer.Tracer, tracer)
  }),
).pipe(Layer.provide(OtelLive))

const GlobalLayer_ = GlobalLayer.add('BrowserBase', [
  [TracerLive, Tracer.Tracer],
  [NavigateLive, Navigate],
  [AppearanceLive, Appearance],
  [ToasterLive, Toaster],
  [I18nLive, I18n],
])

export const BasicLive = pipe(
  Layer.mergeAll(GlobalLayer_, NavigateLive, AppearanceLive, ToasterLive, I18nLive),
  Layer.provideMerge(TracerLive),
  Layer.provide(PrettyLogger),
  Layer.provide([Logger.minimumLogLevel(LogLevel.All), ConfigProviderLive]),
)

export const UseGlobalLive = (identifier: string) =>
  pipe(
    GlobalLayer.use(identifier, Tracer.Tracer, Navigate, I18n, Toaster),
    Layer.provide(PrettyLogger),
    Layer.provide([Logger.minimumLogLevel(LogLevel.All), ConfigProviderLive]),
  )
