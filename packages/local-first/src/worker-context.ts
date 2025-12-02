import * as Reactivity from '@effect/experimental/Reactivity'
import * as FetchHttpClient from '@effect/platform/FetchHttpClient'
import type * as SqlClient from '@effect/sql/SqlClient'
import { BasicLive } from '@xstack/preset-web/browser-worker'
import type { Migrator } from '@xstack/db'
import * as Bip39 from '@xstack/event-log/Bip39'
import { CryptoLive } from '@xstack/event-log/CryptoWeb'
import * as EventLog from '@xstack/event-log/EventLog'
import * as EventLogAudit from '@xstack/event-log/EventLogAudit'
import * as EventLogConfig from '@xstack/event-log/EventLogConfig'
import * as EventLogDaemon from '@xstack/event-log/EventLogDaemon'
import * as EventLogEncryption from '@xstack/event-log/EventLogEncryption'
import * as EventLogPlatformEffects from '@xstack/event-log/EventLogPlatformEffects'
import * as EventLogRemoteSocket from '@xstack/event-log/EventLogRemoteSocket'
import * as EventLogStates from '@xstack/event-log/EventLogStatesWorker'
import * as IdentityStorage from '@xstack/event-log/IdentityStorage'
import * as Identity from '@xstack/event-log/IdentityWorker'
import { WorkerSession } from '@xstack/event-log/Session'
import * as SqlEventJournal from '@xstack/event-log/SqlEventJournal'
import { EventPubSubLive, SchedulerManager } from '@xstack/fx/worker/scheduler/manager'
import { OtelLive } from '@xstack/otel/browser-worker'
import type * as Kysely from '@xstack/sqlite/kysely'
import { SqliteLive } from '@xstack/sqlite/worker'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import * as Option from 'effect/Option'
import * as Redacted from 'effect/Redacted'
import * as Stream from 'effect/Stream'

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
    inputLayer?: Layer.Layer<LA, never, SqlClient.SqlClient | SchedulerManager | EventLog.EventLog>
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
      globalThis.patchEnv = options.envPatch ?? (() => {})
    }),
  )
  const DBLive_ = DBLive.pipe(Layer.provide(SqliteLive), Layer.provide(Reactivity.layer), Layer.orDie)

  const SchedulerManagerLive = SchedulerManager.Live.pipe(Layer.provide(EventPubSubLive))

  const FetchLive = FetchHttpClient.layer

  const IdentityLive = Identity.Default.pipe(
    Layer.provide([Bip39.Bip39.Default, FetchLive, CryptoLive, IdentityStorage.Live]),
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

  const PlatformEffectsLive = EventLogPlatformEffects.Live.pipe(Layer.provide(DBLive_))

  const EventLogLive = pipe(
    Layer.mergeAll(
      EventLogRemoteSocket.layerWebSocketBrowser(
        Effect.gen(function* () {
          const { namespace, syncUrl } = yield* EventLogConfig.EventLogConfig.pipe(Effect.orDie)
          const identity = yield* Identity.Identity
          const session = yield* WorkerSession

          return pipe(
            Stream.zipLatestAll(session.changes, identity.publicKeyStream),
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
    ),
    Layer.provide([IdentityLive, EventLogEncryptionLive, EventLogStatesLive]),
    Layer.provideMerge(EventLogLayer),
    Layer.provide([Reactivity.layer, DBLive_]),
  )

  const merge = Layer.provide(inputLayer, [
    OtelLive,
    Reactivity.layer,
    DBLive_,
    SchedulerManagerLive,
    IdentityLive,
    EventLogLive,
    EventLogStatesLive,
  ])

  const Live = Layer.mergeAll(
    Reactivity.layer,
    DBLive_,
    SchedulerManagerLive,
    IdentityLive,
    EventLogLive,
    EventLogStatesLive,
    MigratorLive,
    merge,
  ).pipe(
    Layer.provide(OtelLive),
    Layer.provide(PatchEnvLive),
    Layer.provideMerge(BasicLive),
    Layer.tapErrorCause(Effect.logError),
    Layer.orDie,
  )

  return { Live }
}
