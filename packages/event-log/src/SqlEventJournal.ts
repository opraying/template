/**
 * SqlEventJournal module provides SQL-based implementation of the EventJournal.
 * Supports multiple SQL dialects including PostgreSQL, MySQL, MSSQL and SQLite.
 */

import * as SqlClient from '@effect/sql/SqlClient'
import type { SqlError } from '@effect/sql/SqlError'
import * as SqlSchema from '@effect/sql/SqlSchema'
import * as EventJournal from '@xstack/event-log/EventJournal'
import * as EventLogConfig from '@xstack/event-log/EventLogConfig'
import * as metrics from '@xstack/event-log/Metrics'
import * as Duration from 'effect/Duration'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import * as ParseResult from 'effect/ParseResult'
import * as PubSub from 'effect/PubSub'
import * as Schema from 'effect/Schema'
import * as Uuid from 'uuid'

/**
 * Creates a new SQL-based EventJournal implementation.
 * Handles schema creation and provides CRUD operations for events.
 *
 * @since 1.0.0
 * @category constructors
 */
export const make = (options?: {
  readonly entryTable?: string
  readonly remotesTable?: string
  readonly sqlBatchSize?: number
}): Effect.Effect<typeof EventJournal.EventJournal.Service, SqlError, SqlClient.SqlClient> =>
  Effect.gen(function* () {
    const { runtime } = yield* EventLogConfig.EventLogConfig.pipe(Effect.orDie)
    const sql = yield* SqlClient.SqlClient

    const entryTable = options?.entryTable ?? 'event_journal'
    const remotesTable = options?.remotesTable ?? 'event_remotes'
    const sqlBatchSize = options?.sqlBatchSize ?? 200

    const entryColumns = Object.keys(EventJournal.Entry.fields).length
    const remoteColumns = Object.keys(RemoteSql.fields).length

    const selectInClauseBatchSize = Math.max(1, sqlBatchSize)
    const insertEntriesBatchSize = Math.max(1, Math.floor(sqlBatchSize / entryColumns))
    const insertRemotesBatchSize = Math.max(1, Math.floor(sqlBatchSize / remoteColumns))

    const EntrySqlSqliteSchema = (
      runtime === 'react-native' ? RNEntrySqlSqlite : EntrySqlSqlite
    ) as typeof EntrySqlSqlite

    yield* sql`
      CREATE TABLE IF NOT EXISTS ${sql(entryTable)} (
        id BLOB PRIMARY KEY,
        event TEXT NOT NULL,
        primary_key TEXT NOT NULL,
        payload BLOB NOT NULL,
        timestamp BIGINT NOT NULL
      )`.withoutTransform.pipe(
      Effect.withSpan('SqlEventJournal.initSchema'),
      Effect.annotateSpans({
        'event.journal.operation': 'init_schema',
        'event.journal.store': 'sql',
        'sql.dialect': 'sqlite',
        'sql.table': entryTable,
      }),
    )

    yield* sql`
      CREATE TABLE IF NOT EXISTS ${sql(remotesTable)} (
        remote_id BLOB NOT NULL,
        entry_id BLOB NOT NULL,
        sequence INT NOT NULL,
        PRIMARY KEY (remote_id, entry_id)
      )`.withoutTransform.pipe(
      Effect.withSpan('SqlEventJournal.initRemoteSchema'),
      Effect.annotateSpans({
        'event.journal.operation': 'init_remote_schema',
        'event.journal.store': 'sql',
        'sql.dialect': 'sqlite',
        'sql.table': remotesTable,
      }),
    )

    const EntrySql = Schema.transform(EntrySqlSqliteSchema, EventJournal.Entry, {
      decode(fromA) {
        return {
          id: fromA.id,
          event: fromA.event,
          primaryKey: fromA.primary_key,
          payload: fromA.payload,
        }
      },
      encode(toI) {
        return {
          id: toI.id,
          event: toI.event,
          primary_key: toI.primaryKey,
          payload: toI.payload,
          timestamp: new Date(EventJournal.entryIdMillis(toI.id as EventJournal.EntryId)),
        }
      },
    })

    const EntrySqlArray = Schema.Array(EntrySql)
    const decodeEntrySqlArray = Schema.decodeUnknown(EntrySqlArray)

    const insertEntry = SqlSchema.void({
      Request: EntrySql,
      execute: (entry) =>
        sql`INSERT INTO ${sql(entryTable)} ${sql.insert(entry)} ON CONFLICT DO NOTHING`.withoutTransform.pipe(
          Effect.annotateSpans({
            'event.journal.operation': 'insert_entry',
            'event.journal.store': 'sql',
            'event.id': Uuid.stringify(entry.id),
            'event.type': entry.event,
          }),
          Effect.withSpan('SqlEventJournal.insertEntry'),
        ),
    })

    const insertEntries = SqlSchema.void({
      Request: Schema.Array(EntrySql),
      execute: Effect.fnUntraced(
        function* (entries) {
          for (let i = 0; i < entries.length; i += insertEntriesBatchSize) {
            const chunk = entries.slice(i, i + insertEntriesBatchSize)
            if (chunk.length > 0) {
              yield* sql`INSERT INTO ${sql(entryTable)} ${sql.insert(chunk)} ON CONFLICT DO NOTHING`.withoutTransform
            }
          }

          return []
        },
        (effect, entries) =>
          Effect.annotateSpans(effect, {
            'event.journal.operation': 'insert_entries',
            'event.journal.store': 'sql',
            count: entries.length,
          }),
        Effect.withSpan('SqlEventJournal.insertEntries'),
      ),
    })

    const insertRemotes = SqlSchema.void({
      Request: Schema.Array(RemoteSql),
      execute: Effect.fnUntraced(
        function* (remotes) {
          for (let i = 0; i < remotes.length; i += insertRemotesBatchSize) {
            const chunk = remotes.slice(i, i + insertRemotesBatchSize)
            if (chunk.length > 0) {
              yield* sql`INSERT INTO ${sql(remotesTable)} ${sql.insert(chunk)} ON CONFLICT DO NOTHING`.withoutTransform
            }
          }

          return []
        },
        (effect, remotes) =>
          Effect.annotateSpans(effect, {
            'event.journal.operation': 'insert_remotes',
            'event.journal.store': 'sql',
            count: remotes.length,
          }),
        Effect.withSpan('SqlEventJournal.insertRemotes'),
      ),
    })

    const pubsub = yield* PubSub.unbounded<EventJournal.Entry>()

    return EventJournal.EventJournal.of({
      entries: sql`SELECT * FROM ${sql(entryTable)} ORDER BY timestamp ASC`.withoutTransform.pipe(
        Effect.flatMap(decodeEntrySqlArray),
        Effect.mapError((cause) => new EventJournal.EventJournalError({ cause, method: 'entries' })),
        Effect.timed,
        Effect.tap(([duration, entries]) =>
          Effect.all(
            [
              metrics.eventQueryLatency(Effect.succeed(Duration.toMillis(duration))),
              metrics.journalEventCount(Effect.succeed(entries.length)),
            ],
            { concurrency: 'unbounded', discard: true },
          ),
        ),
        Effect.map(([_, result]) => result),
        Effect.annotateSpans({
          'event.journal.operation': 'get_all_entries',
          'event.journal.store': 'sql',
        }),
        Effect.withSpan('SqlEventJournal.getAllEntries'),
      ),

      write({ effect, event, payload, primaryKey }) {
        return Effect.gen(function* () {
          const entry = new EventJournal.Entry(
            {
              id: EventJournal.makeEntryId(),
              event,
              primaryKey,
              payload,
            },
            { disableValidation: true },
          )

          yield* insertEntry(entry)
          const value = yield* effect(entry)
          yield* pubsub.publish(entry)

          return value
        }).pipe(
          // sql.withTransaction,
          Effect.mapError(
            (cause) =>
              new EventJournal.EventJournalError({
                cause,
                method: 'write',
              }),
          ),
          Effect.timed,
          Effect.tapBoth({
            onFailure: () => metrics.eventWriteErrorCount(Effect.succeed(1)),
            onSuccess: ([duration]) =>
              Effect.all(
                [
                  metrics.eventWriteLatency(Effect.succeed(Duration.toMillis(duration))),
                  metrics.eventWriteCount(Effect.succeed(1)),
                  metrics.journalEventTypes(Effect.succeed(event)),
                ],
                { concurrency: 'unbounded', discard: true },
              ),
          }),
          Effect.map(([_, result]) => result),
          Effect.annotateSpans({
            'event.journal.operation': 'write_entry',
            'event.journal.store': 'sql',
            'event.type': event,
          }),
          Effect.withSpan('SqlEventJournal.writeEntry'),
        )
      },

      writeFromRemote: (options) =>
        pipe(
          Effect.gen(function* () {
            const entries: Array<EventJournal.Entry> = []
            const remotes: Array<typeof RemoteSql.Type> = []
            for (const remoteEntry of options.entries) {
              entries.push(remoteEntry.entry)
              remotes.push({
                remote_id: options.remoteId,
                entry_id: remoteEntry.entry.id,
                sequence: remoteEntry.remoteSequence,
              })
            }

            const existingIds = new Set<string>()
            const entryIds = entries.map((e) => e.id)

            for (let i = 0; i < entryIds.length; i += selectInClauseBatchSize) {
              const chunkOfIds = entryIds.slice(i, i + selectInClauseBatchSize)
              if (chunkOfIds.length > 0) {
                yield* sql<{ id: Uint8Array<ArrayBufferLike> }>`SELECT id FROM ${sql(entryTable)} WHERE ${sql.in(
                  'id',
                  chunkOfIds,
                )}`.withoutTransform.pipe(
                  Effect.withSpan('SqlEventJournal.checkExistingEntriesChunk'),
                  Effect.annotateSpans({
                    'event.journal.operation': 'check_existing_entries_chunk',
                    'event.journal.store': 'sql',
                    'entries.chunk.count': chunkOfIds.length.toString(),
                  }),
                  Effect.tap((rows) => {
                    for (const row of rows) {
                      existingIds.add(Uuid.stringify(row.id))
                    }
                  }),
                )
              }
            }

            if (entries.length > 0) {
              yield* insertEntries(entries)
            }
            if (remotes.length > 0) {
              yield* insertRemotes(remotes)
            }

            const uncommited = options.entries.filter((e) => !existingIds.has(e.entry.idString))
            const brackets = options.compact
              ? yield* options.compact(uncommited)
              : [[uncommited.map((_) => _.entry), uncommited] as const]

            for (const [compacted] of brackets) {
              for (let i = 0; i < compacted.length; i++) {
                const entry = compacted[i]
                const conflicts = yield* sql`
                  SELECT *
                  FROM ${sql(entryTable)}
                  WHERE event = ${entry.event} AND
                        primary_key = ${entry.primaryKey} AND
                        timestamp >= ${entry.createdAtMillis}
                  ORDER BY timestamp ASC
                `.withoutTransform.pipe(
                  Effect.flatMap(decodeEntrySqlArray),
                  Effect.withSpan('SqlEventJournal.findConflicts'),
                  Effect.annotateSpans({
                    'event.journal.operation': 'find_conflicts',
                    'event.journal.store': 'sql',
                    'event.id': entry.idString,
                    'event.type': entry.event,
                  }),
                  Effect.tapErrorCause(Effect.logError),
                )
                yield* options.effect({ entry, conflicts })
              }
            }
          }),
          Effect.mapError(
            (cause) =>
              new EventJournal.EventJournalError({
                cause,
                method: 'write',
              }),
          ),
          Effect.annotateSpans({
            'event.journal.operation': 'write_from_remote',
            'event.journal.store': 'sql',
          }),
          Effect.withSpan('SqlEventJournal.writeFromRemote'),
        ),

      withRemoteUncommited: (remoteId, write) =>
        pipe(
          Effect.gen(function* () {
            const entries = yield* sql`
             SELECT *
             FROM ${sql(entryTable)}
             WHERE id NOT IN (SELECT entry_id FROM ${sql(remotesTable)} WHERE remote_id = ${remoteId})
             ORDER BY timestamp ASC
           `.withoutTransform.pipe(
              Effect.withSpan('SqlEventJournal.getUncommittedEntries'),
              Effect.annotateSpans({
                'event.journal.operation': 'get_uncommitted_entries',
                'event.journal.store': 'sql',
              }),
              Effect.flatMap(decodeEntrySqlArray),
            )

            return yield* write(entries)
          }),
          Effect.mapError(
            (cause) =>
              new EventJournal.EventJournalError({
                cause,
                method: 'withRemoteUncommited',
              }),
          ),
        ),

      nextRemoteSequence: (remoteId) =>
        pipe(
          sql<{ max: number }>`
           SELECT MAX(sequence) AS max
           FROM ${sql(remotesTable)}
           WHERE remote_id = ${remoteId}
         `.withoutTransform.pipe(
            Effect.map((rows) => Number(rows[0]!.max) + 1),
            Effect.mapError(
              (cause) =>
                new EventJournal.EventJournalError({
                  cause,
                  method: 'nextRemoteSequence',
                }),
            ),
            Effect.annotateSpans({
              'event.journal.operation': 'get_next_remote_sequence',
              'event.journal.store': 'sql',
            }),
            Effect.withSpan('SqlEventJournal.getNextRemoteSequence'),
          ),
        ),

      changes: PubSub.subscribe(pubsub),

      destroy: Effect.gen(function* () {
        yield* sql`DROP TABLE ${sql(remotesTable)}`.withoutTransform.pipe(
          Effect.withSpan('SqlEventJournal.dropRemoteTable'),
          Effect.annotateSpans({
            'event.journal.operation': 'drop_table',
            'event.journal.store': 'sql',
            'sql.table': entryTable,
          }),
        )

        yield* sql`DROP TABLE ${sql(remotesTable)}`.withoutTransform.pipe(
          Effect.withSpan('SqlEventJournal.dropRemoteTable'),
          Effect.annotateSpans({
            'event.journal.operation': 'drop_table',
            'event.journal.store': 'sql',
            'sql.table': remotesTable,
          }),
        )
      }).pipe(Effect.mapError((cause) => new EventJournal.EventJournalError({ cause, method: 'destroy' }))),
    })
  })

/**
 * @since 1.0.0
 * @category layers
 */
export const layer = (options?: {
  readonly eventLogTable?: string
  readonly remotesTable?: string
  readonly sqlBatchSize?: number
}): Layer.Layer<EventJournal.EventJournal, SqlError, SqlClient.SqlClient> =>
  Layer.effect(EventJournal.EventJournal, make(options))

const uint8ArrayToArrayBuffer = (u: Uint8Array<ArrayBufferLike>) => {
  const r = new ArrayBuffer(u.length)
  const v = new Uint8Array(r)
  v.set(u)
  return r
}

const Uint8ArrayFromBufferOrSelf = Schema.transformOrFail(Schema.Any, Schema.Uint8ArrayFromSelf, {
  decode: (fromA) => {
    if (fromA instanceof Uint8Array) {
      return Effect.succeed(fromA)
    }

    if (fromA instanceof ArrayBuffer) {
      return Effect.succeed(new Uint8Array(fromA))
    }

    return Effect.fail(new ParseResult.Unexpected(fromA, 'Not a Uint8Array'))
  },
  encode: (toA) => {
    if (toA instanceof Uint8Array) {
      return Effect.succeed(uint8ArrayToArrayBuffer(toA))
    }
    return Effect.succeed(toA)
  },
})

const RNEntrySqlSqlite = Schema.Struct({
  id: Uint8ArrayFromBufferOrSelf,
  event: Schema.String,
  primary_key: Schema.String,
  payload: Uint8ArrayFromBufferOrSelf,
  timestamp: Schema.DateFromNumber,
})

const EntrySqlSqlite = Schema.Struct({
  id: Schema.Uint8ArrayFromSelf,
  event: Schema.String,
  primary_key: Schema.String,
  payload: Schema.Uint8ArrayFromSelf,
  timestamp: Schema.DateFromNumber,
})

const RemoteSql = Schema.Struct({
  remote_id: EventJournal.RemoteId,
  entry_id: EventJournal.EntryId,
  sequence: Schema.Number,
})
