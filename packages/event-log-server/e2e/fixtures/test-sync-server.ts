import * as Reactivity from '@effect/experimental/Reactivity'
import * as FetchHttpClient from '@effect/platform/FetchHttpClient'
import * as NodeSqliteClient from '@effect/sql-sqlite-node/SqliteClient'
import { CryptoLive } from '@xstack/event-log/CryptoWeb'
import * as EventLog from '@xstack/event-log/EventLog'
import * as EventLogAudit from '@xstack/event-log/EventLogAudit'
import * as EventLogConfig from '@xstack/event-log/EventLogConfig'
import * as EventLogDaemon from '@xstack/event-log/EventLogDaemon'
import * as EventLogEncryption from '@xstack/event-log/EventLogEncryption'
import * as EventLogPlatformEffects from '@xstack/event-log/EventLogPlatformEffects'
import * as EventLogRemoteSocket from '@xstack/event-log/EventLogRemoteSocket'
import * as EventLogStates from '@xstack/event-log/EventLogStates'
import * as Events from '@xstack/event-log/Events'
import * as Identity from '@xstack/event-log/Identity'
import * as IdentityStorage from '@xstack/event-log/IdentityStorage'
import { Default as IdentityLayer } from '@xstack/event-log/IdentityWorker'
import { WorkerSession } from '@xstack/event-log/Session'
import * as SqlEventJournal from '@xstack/event-log/SqlEventJournal'
import { Config, ConfigProvider, Effect, Layer, Option, pipe, Redacted, Stream, String } from 'effect'
import { resolve } from 'node:path'
import { ClientEvents } from './test-events'

const cwd = import.meta.dirname

const SqliteLive = NodeSqliteClient.layerConfig({
  filename: Config.succeed(resolve(cwd, '.miniflare-cache/client.sqlite')),
  // filename: Config.succeed(":memory:"),
  disableWAL: Config.succeed(true),
  transformQueryNames: Config.succeed(String.camelToSnake),
  transformResultNames: Config.succeed(String.snakeToCamel),
})

const DBLive = SqliteLive.pipe(Layer.provide(Reactivity.layer), Layer.orDie)

const IdentityLive = IdentityLayer.pipe(Layer.provide([CryptoLive, IdentityStorage.Memory, FetchHttpClient.layer]))

const EventLogEncryptionLive = EventLogEncryption.layerSubtle.pipe(Layer.provide(CryptoLive))

const SqlEventJournalLive = SqlEventJournal.layer({ sqlBatchSize: 64 })

const EventLogLayer = EventLog.layer.pipe(
  Layer.provide([Events.register(ClientEvents), SqlEventJournalLive]),
  Layer.provide([Reactivity.layer, DBLive]),
)

const EventLogStatesLive = pipe(
  Layer.mergeAll(EventLogStates.EventLogStates.Default, EventLogAudit.EventLogAudit.Default),
  Layer.provide([EventLogLayer, IdentityLive, Reactivity.layer, DBLive]),
)

const PlatformEffectsLive = EventLogPlatformEffects.Noop

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
              Option.map((query) => `${syncUrl.replace(/^https?/, 'ws')}?q=${query}`),
            ),
          ),
        )
      }).pipe(Effect.provide(WorkerSession.Default)),
    ),
    EventLogDaemon.EventLogDaemon.Default.pipe(Layer.provide(PlatformEffectsLive)),
  ),
  Layer.provide([IdentityLive, EventLogEncryptionLive, EventLogStatesLive]),
  Layer.provideMerge(EventLogLayer),
  Layer.provide([Reactivity.layer, DBLive]),
)

// oxlint-disable-next-line no-unused-vars
const Live = Layer.mergeAll(Reactivity.layer, DBLive, IdentityLive, EventLogLive, EventLogStatesLive).pipe(
  Layer.tapErrorCause(Effect.logError),
  Layer.provide(
    Layer.setConfigProvider(
      ConfigProvider.fromJson({
        NAMESPACE: 'template',
        SYNC: {
          URL: 'http://127.0.0.1:5999/sync',
        },
      }),
    ),
  ),
)

// oxlint-disable-next-line no-unused-vars
const TestMnemonic = Redacted.make('they sea craft payment ticket bind vague believe visit lady knife fox')
// oxlint-disable-next-line no-unused-vars
const TestToken = Redacted.make('7w3jnwsw3j24xsvvxfvssk6pxuhcuwiut5u5hudc')

// oxlint-disable-next-line no-unused-vars
const program = Effect.gen(function* () {
  // const miniflare = yield* Miniflare
  // const _url = miniflare.url

  // const sql = yield* SqlClient.SqlClient
  // const identity = yield* Identity.Identity
  // const _eventLog = yield* EventLog.EventLog

  // const tables = yield* sql<{ name: string }>`SELECT name FROM sqlite_master WHERE type='table'`
  // yield* Effect.forEach(tables, (table) => sql`DELETE FROM ${sql(table.name)}`, { discard: true })

  // yield* SubscriptionRef.set(GlobalAccessToken, Option.some(TestToken))

  // yield* identity.importFromMnemonic(TestMnemonic)

  // yield* ClientEvents.trigger('SetName', { name: 'Ray' })
  // yield* ClientEvents.trigger("SetName", { name: "A" })
  // yield* ClientEvents.trigger("SetName", { name: "B" })

  return yield* Effect.never
})
