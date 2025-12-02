import * as SqlClient from '@effect/sql/SqlClient'
import type { SqlError } from '@effect/sql/SqlError'
import type { EntryId } from '@xstack/event-log/EventJournal'
import * as EventJournal from '@xstack/event-log/EventJournal'
import * as EventLogEncryption from '@xstack/event-log/EventLogEncryption'
import * as EventLogServer from '@xstack/event-log/EventLogServer'
import * as Chunk from 'effect/Chunk'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import * as Mailbox from 'effect/Mailbox'
import * as PubSub from 'effect/PubSub'
import * as Schema from 'effect/Schema'
import type * as Scope from 'effect/Scope'

/**
 * @since 1.0.0
 * @category constructors
 */
export const makeStorage = (options?: {
  readonly entryTablePrefix?: string
  readonly remoteIdTable?: string
  readonly sqlBatchSize?: number
}): Effect.Effect<typeof EventLogServer.Storage.Service, SqlError, SqlClient.SqlClient | Scope.Scope> =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    const table = options?.entryTablePrefix ?? 'effect_events'
    const remoteIdTable = options?.remoteIdTable ?? 'effect_remote_id'
    const sqlBatchSize = options?.sqlBatchSize ?? 200
    const columnsPerEntryInsert = Object.keys(EncryptedRemoteEntrySql.fields).length
    const rowsPerInsertBatch = Math.max(1, Math.floor(sqlBatchSize / columnsPerEntryInsert))

    yield* sql`
      CREATE TABLE IF NOT EXISTS ${sql(remoteIdTable)} (
        remote_id BLOB PRIMARY KEY
      )`.withoutTransform

    yield* sql`
      CREATE TABLE IF NOT EXISTS ${sql(table)} (
        sequence INTEGER PRIMARY KEY AUTOINCREMENT,
        iv BLOB NOT NULL,
        entry_id BLOB UNIQUE NOT NULL,
        encrypted_entry BLOB NOT NULL,
        encrypted_dek BLOB NOT NULL
      )`.withoutTransform

    const remoteId = yield* sql<{
      remote_id: Uint8Array<ArrayBufferLike>
    }>`SELECT remote_id FROM ${sql(remoteIdTable)}`.pipe(
      Effect.flatMap((results) => {
        if (results.length > 0) {
          return Effect.succeed(EventJournal.RemoteId.make(results[0].remote_id))
        }
        const newRemoteId = EventJournal.makeRemoteId()
        return Effect.as(
          sql`INSERT INTO ${sql(remoteIdTable)} (remote_id) VALUES (${newRemoteId})`,
          EventJournal.RemoteId.make(newRemoteId),
        )
      }),
    )

    const pubsub = yield* Effect.acquireRelease(
      PubSub.unbounded<EventLogEncryption.EncryptedRemoteEntry>(),
      PubSub.shutdown,
    )

    return EventLogServer.Storage.of({
      getId: Effect.succeed(remoteId),
      write: (entries) =>
        Effect.gen(function* () {
          if (entries.length === 0) return []
          const forInsert: Array<{
            readonly ids: Array<EntryId>
            readonly entries: Array<{
              iv: Uint8Array<ArrayBufferLike>
              entry_id: Uint8Array<ArrayBufferLike>
              encrypted_entry: Uint8Array<ArrayBufferLike>
              encrypted_dek: Uint8Array<ArrayBufferLike>
            }>
          }> = [
            {
              ids: [],
              entries: [],
            },
          ]
          let currentBatch = forInsert[0]
          for (const entry of entries) {
            currentBatch.ids.push(entry.entryId)
            currentBatch.entries.push({
              iv: entry.iv,
              entry_id: entry.entryId,
              encrypted_entry: entry.encryptedEntry,
              encrypted_dek: entry.encryptedDEK,
            })
            if (currentBatch.entries.length === rowsPerInsertBatch) {
              currentBatch = { ids: [], entries: [] }
              forInsert.push(currentBatch)
            }
          }
          const allEntries: Array<EventLogEncryption.EncryptedRemoteEntry> = []
          for (const batch of forInsert) {
            const encryptedEntries = yield* pipe(
              sql`INSERT INTO ${sql(table)} ${sql.insert(batch.entries)} ON CONFLICT DO NOTHING`.withoutTransform,
              Effect.zipRight(
                sql`SELECT * FROM ${sql(table)} WHERE ${sql.in('entry_id', batch.ids)} ORDER BY sequence ASC`,
              ),
              Effect.flatMap(decodeEntries),
            )
            yield* pubsub.offerAll(encryptedEntries)
            allEntries.push(...encryptedEntries)
          }
          return allEntries
        }).pipe(Effect.orDie, Effect.scoped),
      entries: (startSequence) =>
        pipe(
          sql`SELECT * FROM ${sql(table)} WHERE sequence >= ${startSequence} ORDER BY sequence ASC`.pipe(
            Effect.flatMap(decodeEntries),
          ),
          Effect.orDie,
          Effect.scoped,
        ),
      changes: (startSequence) =>
        Effect.gen(function* () {
          const mailbox = yield* Mailbox.make<EventLogEncryption.EncryptedRemoteEntry>()
          const queue = yield* pubsub.subscribe
          const initial = yield* sql`SELECT * FROM ${sql(
            table,
          )} WHERE sequence >= ${startSequence} ORDER BY sequence ASC`.pipe(Effect.flatMap(decodeEntries))
          yield* mailbox.offerAll(initial)
          yield* queue.takeBetween(1, Number.MAX_SAFE_INTEGER).pipe(
            Effect.tap((chunk) => mailbox.offerAll(Chunk.filter(chunk, (_) => _.sequence >= startSequence))),
            Effect.forever,
            Effect.forkScoped,
            Effect.interruptible,
          )
          return mailbox
        }).pipe(Effect.orDie),
    })
  })

const EncryptedRemoteEntrySql = Schema.Struct({
  sequence: Schema.Number,
  iv: Schema.Uint8ArrayFromSelf,
  entry_id: Schema.Uint8ArrayFromSelf,
  encrypted_entry: Schema.Uint8ArrayFromSelf,
  encrypted_dek: Schema.Uint8ArrayFromSelf,
})

const EncryptedRemoteEntryFromSql = Schema.transform(EncryptedRemoteEntrySql, EventLogEncryption.EncryptedRemoteEntry, {
  decode(fromA) {
    return {
      sequence: fromA.sequence,
      iv: fromA.iv,
      entryId: fromA.entry_id,
      encryptedEntry: fromA.encrypted_entry,
      encryptedDEK: fromA.encrypted_dek,
    }
  },
  encode(toI) {
    return {
      sequence: toI.sequence,
      iv: toI.iv,
      entry_id: toI.entryId,
      encrypted_entry: toI.encryptedEntry,
      encrypted_dek: toI.encryptedDEK,
    }
  },
})
const decodeEntries = Schema.decodeUnknown(Schema.Array(EncryptedRemoteEntryFromSql))

/**
 * @since 1.0.0
 * @category layers
 */
export const layerStorage = (options?: {
  readonly entryTablePrefix?: string
  readonly remoteIdTable?: string
  readonly sqlBatchSize?: number
}): Layer.Layer<EventLogServer.Storage, SqlError, SqlClient.SqlClient | Scope.Scope> =>
  Layer.effect(EventLogServer.Storage, makeStorage(options))

/**
 * @since 1.0.0
 * @category layers
 */
export const layerStorageScoped = (options?: {
  readonly entryTablePrefix?: string
  readonly remoteIdTable?: string
  readonly sqlBatchSize?: number
}): Layer.Layer<EventLogServer.Storage, SqlError, SqlClient.SqlClient> =>
  Layer.scoped(EventLogServer.Storage, makeStorage(options))
