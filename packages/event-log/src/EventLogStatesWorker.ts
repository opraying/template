import * as Reactivity from '@effect/experimental/Reactivity'
import * as SqlClient from '@effect/sql/SqlClient'
import * as SqlSchema from '@effect/sql/SqlSchema'
import * as EventLog from '@xstack/event-log/EventLog'
import * as Identity from '@xstack/event-log/Identity'
import * as EventLogSchema from '@xstack/event-log/Schema'
import { EventEmitter } from '@xstack/event-log/Utils'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import * as Match from 'effect/Match'
import * as Option from 'effect/Option'
import * as Schema from 'effect/Schema'
import * as Stream from 'effect/Stream'

/**
 * @internal
 */
export const EventLogStateTable = 'event_log_states'

export const get = Effect.fn(function* (name: string) {
  const sql = yield* SqlClient.SqlClient

  return sql`SELECT json FROM ${sql(EventLogStateTable)} WHERE name = ${name}`.withoutTransform.pipe(
    Effect.map((rows) => Option.fromNullable(rows.at(0)?.json as string)),
    Effect.orElseSucceed(() => Option.none<string>()),
  )
})

export const set = Effect.fn(function* (name: string, value: string) {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    INSERT INTO ${sql(EventLogStateTable)} ${sql.insert({ name, json: value })}
    ON CONFLICT (name) DO UPDATE
    SET ${sql.update({ json: value })}
  `.withoutTransform.pipe(Effect.orDie)
})

export const stream = Effect.fn(function* (name: string) {
  const sql = yield* SqlClient.SqlClient
  const reactivity = yield* Reactivity.Reactivity

  return reactivity.stream(
    { [EventLogStateTable]: [name] },
    sql`SELECT json FROM ${sql(EventLogStateTable)} WHERE name = ${name}`.withoutTransform.pipe(
      Effect.map((rows) => Option.fromNullable(rows.at(0)?.json as string)),
      Effect.orElseSucceed(() => Option.none<string>()),
    ),
  )
})

export interface EventLogState<K extends string, A> {
  readonly key: K
  readonly get: Effect.Effect<Option.Option<A>, never, never>
  readonly stream: Stream.Stream<Option.Option<A>, never, never>
  readonly upsert: (input: A) => Effect.Effect<void, never, never>
  readonly delete: Effect.Effect<void, never, never>
}

export declare namespace EventLogState {
  type Value<T extends EventLogState<string, any>> = T extends EventLogState<string, infer A> ? A : never
}

const makeState =
  <T = never>() =>
  <K extends string, A, I>(name: K, schema: Schema.Schema<A, I>) => {
    const spanId = `EventLogState.${name}`
    const class_ = Effect.Service<EventLogState<K, A>>()(name, {
      effect: Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient
        const reactivity = yield* Reactivity.Reactivity
        const jsonStrSchema = Schema.parseJson(schema)
        const encode = Schema.encodeUnknown(jsonStrSchema)

        const reactivityKeys = {
          [EventLogStateTable]: [name],
        }

        const findOne = SqlSchema.findOne({
          Request: Schema.String,
          Result: jsonStrSchema,
          execute: (name) =>
            sql`SELECT json FROM ${sql(EventLogStateTable)} WHERE name = ${name}`.pipe(
              Effect.map((rows) => rows.map((_) => _.json)),
            ),
        })

        const get = findOne(name).pipe(
          Effect.orElseSucceed(() => Option.none<A>()),
          Effect.withSpan(`${spanId}.get`),
        )

        const stream = reactivity.stream(reactivityKeys, get).pipe(Stream.changes)

        const upsert = Effect.fn(`${spanId}.upsert`)(function* (input: A) {
          const data = yield* encode(input)
          yield* reactivity.mutation(
            reactivityKeys,
            sql`
              INSERT INTO ${sql(EventLogStateTable)} ${sql.insert({ name, json: data })}
              ON CONFLICT (name) DO UPDATE
              SET ${sql.update({ json: data })}
            `,
          )
        })

        const delete_ = reactivity
          .mutation(
            reactivityKeys,
            sql`DELETE FROM ${sql(EventLogStateTable)} WHERE name = ${name}`.pipe(Effect.ignore),
          )
          .pipe(Effect.withSpan(`${spanId}.delete`))

        const state = {
          key: name,
          get,
          stream,
          upsert,
          delete: delete_,
        }

        return state
      }).pipe(Effect.withLogSpan(spanId)),
      dependencies: [],
    })

    return class_ as unknown as Effect.Service.Class<
      T & EventLogState<K, A>,
      K,
      {
        readonly effect: Effect.Effect<EventLogState<K, A>, never, SqlClient.SqlClient | Reactivity.Reactivity>
      }
    >
  }

/**
 * 本地同步统计
 */
export class LocalSyncStats extends makeState<LocalSyncStats>()(
  'local_sync_stats',
  Schema.Struct({
    usedStorageSize: Schema.Number,
  }),
) {
  static defaultValues: EventLogState.Value<Effect.Effect.Success<typeof LocalSyncStats>> = {
    usedStorageSize: 0,
  }
}

const SyncSuccess = Schema.TaggedStruct('SyncSuccess', {
  date: Schema.Date,
})

const SyncFailure = Schema.TaggedStruct('SyncFailure', {
  date: Schema.Date,
  reason: Schema.optional(Schema.String),
  error: Schema.optional(Schema.String),
})

/**
 * 本地统计最新的事件
 */
export class LocalSyncEvent extends makeState<LocalSyncEvent>()(
  'local_sync_event',
  Schema.Union(SyncSuccess, SyncFailure),
) {
  success() {
    return this.upsert(SyncSuccess.make({ date: new Date() }))
  }

  failure({ reason, error }: { reason: string; error: string }) {
    return this.upsert(SyncFailure.make({ date: new Date(), reason, error }))
  }
}

/**
 * 远端同步开关
 */
export class RemoteSyncFlag extends makeState<RemoteSyncFlag>()(
  'remote_sync_flag',
  Schema.Struct({
    enabled: Schema.Boolean,
    reason: Schema.optional(Schema.String),
  }),
) {
  get enabled() {
    return this.stream.pipe(Stream.map(Option.match({ onNone: () => true, onSome: (flag) => flag.enabled })))
  }

  enable() {
    return this.upsert({ enabled: true })
  }

  disable(reason: string) {
    return this.upsert({ enabled: false, reason })
  }

  get pause() {
    return this.upsert({ enabled: false, reason: 'User paused sync' })
  }

  get resume() {
    return this.upsert({ enabled: true, reason: 'User resumed sync' })
  }
}

/**
 * 远端同步统计
 */
export class RemoteSyncStats extends makeState<RemoteSyncStats>()(
  'remote_sync_stats',
  EventLogSchema.RemotePublicKeySyncStats,
) {}

const SocketConnected = Schema.TaggedStruct('Connected', {
  timestamp: Schema.Date,
})

const SocketConnecting = Schema.TaggedStruct('Connecting', {
  timestamp: Schema.Date,
})

const SocketDisconnected = Schema.TaggedStruct('Disconnected', {
  timestamp: Schema.Date,
  reason: Schema.optional(Schema.String),
})

const SocketReconnecting = Schema.TaggedStruct('Reconnecting', {
  timestamp: Schema.Date,
  nextRetry: Schema.Date,
})

const SocketError = Schema.TaggedStruct('Error', {
  timestamp: Schema.Date,
  error: Schema.String,
  code: Schema.optional(Schema.Number),
})

const SocketStateSchema = Schema.Union(
  SocketConnected,
  SocketConnecting,
  SocketDisconnected,
  SocketReconnecting,
  SocketError,
)

/**
 * 本地系统同步状态
 */
export class SocketStatus extends makeState<SocketStatus>()('socket_status', SocketStateSchema) {
  get online() {
    return this.stream.pipe(
      Stream.map(
        Option.match({
          onNone: () => false,
          onSome: (state) => state._tag === 'Connected',
        }),
      ),
    )
  }

  get isConnecting() {
    return this.stream.pipe(
      Stream.map(
        Option.match({
          onNone: () => false,
          onSome: (state) => state._tag === 'Connecting',
        }),
      ),
    )
  }

  get isReconnecting() {
    return this.stream.pipe(
      Stream.map(
        Option.match({
          onNone: () => false,
          onSome: (state) => state._tag === 'Reconnecting',
        }),
      ),
    )
  }

  setConnected() {
    return this.upsert(
      SocketConnected.make({
        timestamp: new Date(),
      }),
    )
  }

  setConnecting() {
    return this.upsert(
      SocketConnecting.make({
        timestamp: new Date(),
      }),
    )
  }

  setDisconnected(reason?: string) {
    return this.upsert(
      SocketDisconnected.make({
        timestamp: new Date(),
        reason,
      }),
    )
  }

  setReconnecting(nextRetry: Date) {
    return this.upsert(
      SocketReconnecting.make({
        timestamp: new Date(),
        nextRetry,
      }),
    )
  }

  setError(error: string, code?: number) {
    return this.upsert(
      SocketError.make({
        timestamp: new Date(),
        error,
        code,
      }),
    )
  }
}
export declare namespace SocketStatus {
  type Value = EventLogState.Value<Effect.Effect.Success<typeof SocketStatus>>
}

export class DevicesStatus extends makeState<DevicesStatus>()(
  'devices_status',
  Schema.Struct({
    devices: Schema.Array(EventLogSchema.ConnectedDevice),
  }),
) {
  get connected() {
    return this.stream.pipe(
      Stream.map(
        Option.match({
          onNone: () => [] as ReadonlyArray<EventLogSchema.ConnectedDevice>,
          onSome: (_) => _.devices,
        }),
      ),
    )
  }
}

export const make = Effect.fn(
  function* (events: EventEmitter) {
    const identity = yield* Identity.Identity
    const localSyncStats = yield* LocalSyncStats
    const localSyncEvent = yield* LocalSyncEvent
    const socketStatus = yield* SocketStatus
    const remoteSyncStats = yield* RemoteSyncStats
    const remoteSyncFlag = yield* RemoteSyncFlag
    const devicesStatus = yield* DevicesStatus

    const localSyncStatsStream = Stream.zipLatestWith(
      localSyncStats.stream,
      localSyncEvent.stream,
      (syncStatsO, syncEventO) => {
        const syncStats = Option.getOrElse(syncStatsO, () => LocalSyncStats.defaultValues)
        const lastSync = syncEventO
        return { ...syncStats, lastSync }
      },
    ).pipe(Stream.changes)

    /**
     * Add some delay at the end to ensure the interface does not flash too quickly.
     *
     * starting = show sync indicator, end = hide indicator
     */
    const syncing = pipe(
      events.toStream<EventLogSchema.SyncEvents>('sync-event'),
      Stream.filter((event) => EventLogSchema.SyncEvents.is(event)),
      Stream.mapEffect((event) =>
        Match.value(event.payload).pipe(
          Match.tag('starting', () => Effect.succeed(true)),
          Match.tag('end', () => Effect.succeed(false)),
          Match.exhaustive,
        ),
      ),
      Stream.changes,
    )

    const publicKeysStream = Stream.zipLatest(identity.publicKeyStream, identity.allPublicKeysStream).pipe(
      Stream.map(([publicKey, allPublicKeys]) => ({
        publicKey,
        items: allPublicKeys,
      })),
      Stream.changes,
    )

    return {
      _tag: 'EventLogStates' as const,

      localSyncEvent,
      localSyncStats,
      remoteSyncStats,
      remoteSyncFlag,
      socketStatus,
      devicesStatus,
      localSyncStatsStream,

      syncing,
      publicKeysStream,

      events,
    }
  },
  Effect.provide(
    Layer.mergeAll(
      LocalSyncEvent.Default,
      LocalSyncStats.Default,
      RemoteSyncFlag.Default,
      RemoteSyncStats.Default,
      SocketStatus.Default,
      DevicesStatus.Default,
    ),
  ),
)

export class EventLogStates extends Effect.Service<EventLogStates>()('EventLogStates', {
  scoped: Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    yield* pipe(
      sql`
        CREATE TABLE IF NOT EXISTS ${sql(EventLogStateTable)} (
          name TEXT PRIMARY KEY,
          json TEXT NOT NULL
        )
      `.withoutTransform,
      Effect.withSpan('EventLogStates.initEventStateSchema'),
      Effect.annotateSpans({
        'event.journal.operation': 'init_event_states_schema',
        'event.journal.store': 'sql',
        'sql.dialect': 'sqlite',
        'sql.table': EventLogStateTable,
      }),
      Effect.orDie,
    )

    const events = new EventEmitter()
    const eventLog = yield* EventLog.EventLog

    yield* eventLog.events.toStream<EventLogSchema.SyncEvents>('sync-event').pipe(
      Stream.tap((_) => Effect.sync(() => events.emit('sync-event', _))),
      Stream.runDrain,
      Effect.forkScoped,
    )

    const methods = yield* make(events)

    return {
      ...methods,
      offer: events.emit,
    }
  }).pipe(Effect.withLogSpan('@event-log/states')),
  dependencies: [],
}) {}
