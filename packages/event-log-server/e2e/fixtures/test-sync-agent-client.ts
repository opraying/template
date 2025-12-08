import * as Reactivity from '@effect/experimental/Reactivity'
import * as FetchHttpClient from '@effect/platform/FetchHttpClient'
import * as Socket from '@effect/platform/Socket'
import * as NodeSqliteClient from '@effect/sql-sqlite-node/SqliteClient'
import { CryptoLive } from '@xstack/event-log/CryptoWeb'
import * as EventJournal from '@xstack/event-log/EventJournal'
import * as EventLogEncryption from '@xstack/event-log/EventLogEncryption'
import * as EventLogRemote from '@xstack/event-log/EventLogRemote'
import * as Identity from '@xstack/event-log/Identity'
import * as IdentityStorage from '@xstack/event-log/IdentityStorage'
import { Default as IdentityLayer } from '@xstack/event-log/IdentityWorker'
import * as MsgPack from '@xstack/event-log/MsgPack'
import * as Config from 'effect/Config'
import * as ConfigProvider from 'effect/ConfigProvider'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as Layer from 'effect/Layer'
import * as Logger from 'effect/Logger'
import * as LogLevel from 'effect/LogLevel'
import * as Redacted from 'effect/Redacted'
import * as Schema from 'effect/Schema'
import * as Scope from 'effect/Scope'
import * as String from 'effect/String'

const PayloadSchema = Schema.Struct({ name: Schema.String })
const PayloadMsgPackSchema = MsgPack.schema(PayloadSchema)

const SqliteLive = NodeSqliteClient.layerConfig({
  filename: Config.succeed('client-agent.sqlite'),
  disableWAL: Config.succeed(true),
  transformQueryNames: Config.succeed(String.camelToSnake),
  transformResultNames: Config.succeed(String.snakeToCamel),
})

const IdentityLive = IdentityLayer.pipe(Layer.provide([CryptoLive, IdentityStorage.Live, FetchHttpClient.layer]))

const EventLogEncryptionLive = EventLogEncryption.layerSubtle.pipe(Layer.provide(CryptoLive))

const SyncClientLive = Layer.mergeAll(
  Reactivity.layer,
  SqliteLive,
  IdentityLive,
  EventLogEncryptionLive,
  EventLogRemote.RemoteEventSources.Default,
).pipe(
  Layer.tapErrorCause(Effect.logError),
  Layer.provide(
    Layer.setConfigProvider(
      ConfigProvider.fromJson({
        NAMESPACE: 'template',
        SYNC: {
          URL: 'http://localhost',
        },
      }),
    ),
  ),
  Layer.orDie,
)

const Live = SyncClientLive.pipe(Layer.provide(SqliteLive), Layer.orDie)

// 向 Sync Agent Client 发送测试事件

const program = Effect.gen(function* () {
  const identity = yield* Identity.Identity
  const encryption = yield* EventLogEncryption.EventLogEncryption

  yield* identity.importFromMnemonic(
    Redacted.make('they sea craft payment ticket bind vague believe visit lady knife fox'),
  )

  const timestamp = Date.now()
  const mockEvent = 'first-event'
  const mockData = [PayloadSchema.make({ name: 'Ray' }), PayloadSchema.make({ name: 'Bob' })]
  const entryId = EventJournal.makeEntryId({ msecs: timestamp })
  const entries = mockData.map((item) =>
    EventJournal.Entry.make({
      id: entryId,
      event: mockEvent,
      payload: Schema.encodeSync(PayloadMsgPackSchema)(item),
      primaryKey: item.name,
    }),
  )
  const encryptedData = yield* encryption.encrypt(identity, entries)
  const encryptedRemoteEntry = encryptedData.encryptedEntries.map((item, index) =>
    EventLogEncryption.EncryptedRemoteEntry.make({
      sequence: index,
      entryId: entryId,
      iv: encryptedData.iv,
      encryptedDEK: encryptedData.encryptedDEK,
      encryptedEntry: item,
    }),
  )
  const encodedChanges = EventLogRemote.splitChangesResponse(encryptedRemoteEntry)

  const LiveSocket = Socket.layerWebSocket('http://localhost:9886/sync').pipe(
    Layer.provide(Socket.layerWebSocketConstructorGlobal),
  )
  // ws connect to sync agent
  const scope = yield* Scope.make()
  const socket = yield* Socket.Socket.pipe(Effect.provide(LiveSocket), Effect.provideService(Scope.Scope, scope))

  // ws connect to sync agent
  const write = yield* socket.writer.pipe(Effect.scoped)

  for (const change of encodedChanges) {
    yield* write(change).pipe(Effect.ignoreLogged)
  }

  yield* Effect.log('broadcast change to sync agent')

  yield* Scope.close(scope, Exit.void)

  // only dev, broadcast changes to nodejs

  // yield* Effect.promise(() => fetch("http://localhost:9995/sync", { method: "post", body: encodedChanges[0] })).pipe(
  //   Effect.ignore,
  // )
  yield* Effect.sleep(1000)
}).pipe(
  Effect.provide(Live),
  Effect.provide(EventLogRemote.RemoteEventSources.Default),
  Effect.scoped,
  Effect.tapErrorCause(Effect.logError),
  Logger.withMinimumLogLevel(LogLevel.All),
)

// NodeRuntime.runMain(program)
