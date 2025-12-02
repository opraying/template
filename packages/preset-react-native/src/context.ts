import * as Reactivity from '@effect/experimental/Reactivity'
import * as FetchHttpClient from '@effect/platform/FetchHttpClient'
import * as SqlClient from '@effect/sql/SqlClient'
import type { Migrator } from '@xstack/db'
import * as Bip39 from '@xstack/event-log/Bip39Native'
import { CryptoLive } from '@xstack/event-log/CryptoNative'
import * as EventLog from '@xstack/event-log/EventLog'
import * as EventLogAudit from '@xstack/event-log/EventLogAudit'
import * as EventLogConfig from '@xstack/event-log/EventLogConfig'
import * as EventLogDaemon from '@xstack/event-log/EventLogDaemon'
import * as EventLogEncryption from '@xstack/event-log/EventLogEncryption'
import * as EventLogPlatformEffects from '@xstack/event-log/EventLogPlatformEffectsNative'
import { ExternalDatabaseStorage } from '@xstack/event-log/EventLogPlatformEffectsNative'
import * as EventLogRemoteSocket from '@xstack/event-log/EventLogRemoteSocket'
import * as EventLogStates from '@xstack/event-log/EventLogStates'
import { IdentityStorage } from '@xstack/event-log/IdentityStorage'
import * as IdentityStorageNative from '@xstack/event-log/IdentityStorageNative'
import * as Identity from '@xstack/event-log/IdentityWorker'
import { GlobalAccessToken, WorkerSession } from '@xstack/event-log/Session'
import * as SqlEventJournal from '@xstack/event-log/SqlEventJournal'
import * as GlobalLayer from '@xstack/atom-react/global'
// import type { Scheduler } from "@xstack/fx/worker/scheduler"
import { EventPubSubLive, SchedulerManager } from '@xstack/fx/worker/scheduler/manager'
import { I18nLive } from '@xstack/i18n/browser'
import { I18n } from '@xstack/i18n/i18n'
import { Navigate } from '@xstack/router'
import { ExpoRouterNavigate as NavigateLive } from '@xstack/router/expo-layer'
import * as OPSqlClient from '@xstack/sql-op-sqlite/SqlClient'
import type * as Kysely from '@xstack/sqlite/kysely'
import { Toaster } from '@xstack/toaster'
import { ExpoToaster as ToasterLive } from '@xstack/toaster/expo-layer'
import * as Config from 'effect/Config'
import * as ConfigProvider from 'effect/ConfigProvider'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import * as Logger from 'effect/Logger'
import * as LogLevel from 'effect/LogLevel'
import * as Option from 'effect/Option'
import * as Redacted from 'effect/Redacted'
import * as Stream from 'effect/Stream'
import * as String from 'effect/String'
import * as SubscriptionRef from 'effect/SubscriptionRef'
import * as Tracer from 'effect/Tracer'
import * as ExpoFileSystem from 'expo-file-system'
import { fetch as ExpoFetch } from 'expo/fetch'

export const LogStorageKey = 'x-log-level'

export const getCurrentLogLevel = () => {
  if (process.env.NODE_ENV === 'development') {
    const logLevel: LogLevel.Literal =
      // @ts-ignore
      globalThis.__x_log_level || (typeof localStorage !== 'undefined' && localStorage.getItem(LogStorageKey))

    const level = logLevel ? LogLevel.fromLiteral(logLevel) : LogLevel.All

    return level
  }

  return LogLevel.Info
}

const LoggerLive = Logger.withConsoleLog(Logger.stringLogger).pipe(
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
  const envRecord = {
    NAMESPACE: 'template',
    SYNC: {
      URL: 'http://localhost:8300/sync',
      STORAGE_LOCATION: ExpoFileSystem.Paths.document.uri ?? '/',
    },
  }
  const envMap = new Map(
    Object.entries(envRecord),
    // .filter(([key]) => key.startsWith("VITE_"))
    // .map(([key, value]) => [key.replace("VITE_", ""), value]),
  )
  // @ts-ignore
  const _map = globalThis.patchEnv?.(envMap) ?? envMap

  return Layer.setConfigProvider(ConfigProvider.fromJson(envRecord))
})

// const TracerLive = Layer.unwrapEffect(
//   Effect.gen(function* () {
//     const tracer = yield* Effect.withFiberRuntime<Tracer.Tracer>((_) => Effect.sync(() => _.currentTracer))

//     return Layer.succeed(Tracer.Tracer, tracer)
//   }),
// ).pipe(Layer.provide(TracingLive))

const GlobalLayer_ = GlobalLayer.add('BrowserBase', [
  // [TracerLive, Tracer.Tracer],
  [NavigateLive, Navigate],
  [I18nLive, I18n],
  [ToasterLive, Toaster],
])

export const BasicLive = pipe(
  Layer.mergeAll(GlobalLayer_, NavigateLive, I18nLive, ToasterLive),
  Layer.provide([PrettyLogger, Logger.minimumLogLevel(LogLevel.All), ConfigProviderLive]),
)

export const UseGlobalLive = (identifier: string) =>
  pipe(
    GlobalLayer.use(identifier, Tracer.Tracer, Navigate, I18n, Toaster),
    Layer.provide([PrettyLogger, Logger.minimumLogLevel(LogLevel.All), ConfigProviderLive]),
  )

export const make = <LA = never>(
  {
    MigratorLive,
    DBLive,
    EventLogRegistry,
    inputLayer = Layer.empty as Layer.Layer<LA>,
  }: {
    MigratorLive: Layer.Layer<Migrator.Migrator, never>
    DBLive: Layer.Layer<SqlClient.SqlClient | Kysely.Kysely, never, SqlClient.SqlClient>
    EventLogRegistry: Layer.Layer<EventLog.Registry, never, SqlClient.SqlClient | Kysely.Kysely>
    inputLayer?: Layer.Layer<LA, never, SqlClient.SqlClient | EventLog.EventLog>
    // scheduler
  },
  options: {
    envPatch?: (envMap: Map<string, string>) => Map<string, string>
  } = {},
) => {
  const PatchEnvLive = Layer.scopedDiscard(
    Effect.gen(function* () {
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          // @ts-ignore
          globalThis.patchEnv = null
        }),
      )

      // @ts-ignore
      globalThis.patchEnv = options.envPatch ?? (() => { })
    }),
  )

  const DBLive_ = DBLive.pipe(
    Layer.provideMerge(
      OPSqlClient.layerConfig({
        filename: Config.succeed('main.sqlite'),
        location: EventLogConfig.StorageLocation,
        transformQueryNames: Config.succeed(String.camelToSnake),
        transformResultNames: Config.succeed(String.snakeToCamel),
      }),
    ),
    Layer.orDie,
  )

  const SchedulerManagerLive = SchedulerManager.Live.pipe(Layer.provide(EventPubSubLive))

  const FetchLive = Layer.provideMerge(
    FetchHttpClient.layer,
    Layer.succeed(FetchHttpClient.Fetch, (input, init) => {
      // Convert URL or RequestInfo to string
      const url = input instanceof URL ? input.toString() : input.toString()

      // Convert RequestInit to FetchRequestInit
      const fetchInit = init
        ? {
          body: init.body,
          credentials: init.credentials,
          headers: init.headers,
          method: init.method,
          signal: init.signal,
        }
        : undefined

      return ExpoFetch(url, fetchInit as any) as unknown as Promise<Response>
    }),
  )

  const IdentityLive = Identity.Default.pipe(
    Layer.provide([Bip39.Bip39Live, FetchLive, CryptoLive, IdentityStorageNative.Live]),
  )

  const EventLogEncryptionLive = EventLogEncryption.layerSubtle.pipe(Layer.provide(CryptoLive))

  const SqlEventJournalLive = SqlEventJournal.layer({ sqlBatchSize: 64 })

  const EventLogLayer = EventLog.layer.pipe(
    Layer.provide([EventLogRegistry, SqlEventJournalLive]),
    Layer.provide([Reactivity.layer, DBLive_]),
  )

  const EventLogStatesLive = pipe(
    Layer.mergeAll(EventLogStates.EventLogStates.Default, Layer.discard(EventLogAudit.EventLogAudit.Default)),
    Layer.provide([EventLogLayer, IdentityLive, Reactivity.layer, DBLive_]),
  )

  const PlatformEffectsLive = EventLogPlatformEffects.Live.pipe(
    Layer.provide(
      Layer.effect(
        ExternalDatabaseStorage,
        Effect.gen(function* () {
          const identityStorage = yield* IdentityStorage

          const get = [identityStorage.storageSize]

          return { get }
        }),
      ),
    ),
    Layer.provide([IdentityStorageNative.Live, DBLive_]),
  )

  const EventLogLive = pipe(
    Layer.mergeAll(
      EventLogRemoteSocket.layerWebSocketBrowser(
        Effect.gen(function* () {
          const { namespace, syncUrl } = yield* EventLogConfig.EventLogConfig.pipe(Effect.orDie)
          const identity = yield* Identity.Identity
          const session = yield* WorkerSession

          return pipe(
            Stream.zipLatestAll(session.changes, identity.publicKeyStream),
            Stream.filter(([token, publicKey]) => Option.isSome(token) && !!publicKey),
            Stream.map(([token, publicKey]) =>
              pipe(
                token,
                Option.map((token) => btoa(`${namespace}:${publicKey}:${Redacted.value(token)}`)),
                Option.map((query) => `${syncUrl}?q=${query}`),
              ),
            ),
          )
        }).pipe(Effect.provide(WorkerSession.Default)),
      ),
      Layer.discard(EventLogDaemon.EventLogDaemon.Default.pipe(Layer.provide(PlatformEffectsLive))),
      // [FIXME]
      Test,
    ),
    Layer.provide([IdentityLive, EventLogEncryptionLive, EventLogStatesLive]),
    Layer.provideMerge(EventLogLayer),
    Layer.provide([Reactivity.layer, DBLive_]),
  )

  // const SchedulerLive = SchedulerMake.pipe(Layer.provide(DBLive_), Layer.orDie)

  const merge = Layer.provide(inputLayer, [
    // TracerLive,
    DBLive_,
    // SchedulerLive,
    IdentityLive,
    EventLogStatesLive,
    EventLogLive,
  ])

  const GlobalLayer_ = GlobalLayer.add('AppGlobal', [
    // [TracerLive, Tracer.Tracer],
    [DBLive_, SqlClient.SqlClient],
    [Reactivity.layer, Reactivity.Reactivity],
    [IdentityLive, Identity.Identity],
    [EventLogStatesLive, EventLogStates.EventLogStates],
    [EventLogLive, EventLog.EventLog],
  ])

  const Live = Layer.mergeAll(
    GlobalLayer_,
    Reactivity.layer,
    DBLive_,
    SchedulerManagerLive,
    IdentityLive,
    EventLogStatesLive,
    EventLogLive,
    MigratorLive,
    merge,
  ).pipe(Layer.provide(PatchEnvLive), Layer.provideMerge(BasicLive), Layer.tapErrorCause(Effect.logError), Layer.orDie)

  return {
    Live,
  }
}

const Test = Layer.scopedDiscard(
  Effect.gen(function* () {
    const identity = yield* Identity.Identity

    yield* SubscriptionRef.set(
      GlobalAccessToken,
      Option.some(Redacted.make('7w3jnwsw3j24xsvvxfvssk6pxuhcuwiut5u5hudc')),
    )

    yield* identity.importFromMnemonic(
      Redacted.make('motor royal future decade cousin modify phone roast empty village treat modify'),
    ).pipe(
      Effect.forkScoped)
  }),
)
