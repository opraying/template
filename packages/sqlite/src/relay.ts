import { SqlError } from '@effect/sql/SqlError'
import type * as Statement from '@effect/sql/Statement'
import * as WaSqlite from '@effect-x/wa-sqlite'
import SQLiteESMFactory from '@effect-x/wa-sqlite/dist/wa-sqlite.mjs'
// @ts-ignore
import { AccessHandlePoolVFS } from '@effect-x/wa-sqlite/src/examples/AccessHandlePoolVFS.js'
import type { SchemaBroadcastChannel } from '@xstack/sqlite/internal/broadcast-channel'
import type { SqliteClientFactory } from '@xstack/sqlite/internal/worker'
import {
  SqliteBroadcastUpdates,
  SqliteExportExecute,
  SqliteImportExecute,
  type SqliteParams,
  SqliteQueryExecute,
  SqliteQueryStream,
  type SqliteRowMode,
  SqliteStorageSize,
  type SqliteUpdateEvent,
  SqliteUpdateHookEvent,
  SqliteWorkerReadyEvent,
  type WorkerError,
} from '@xstack/sqlite/schema'
import * as Cause from 'effect/Cause'
import * as Data from 'effect/Data'
import * as Duration from 'effect/Duration'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import * as Runtime from 'effect/Runtime'
import * as Schedule from 'effect/Schedule'
import * as Stream from 'effect/Stream'

export type OnUpdate = (event: SqliteUpdateEvent) => Effect.Effect<void>

const handleError = <A, E = never, R = never>(effect: Effect.Effect<A, E | SqlError | WorkerError, R>) =>
  Effect.catchAllCause(effect, (e) =>
    Cause.isCause(e)
      ? Effect.failCause(e)
      : Effect.failCause(Cause.fail(new SqlError({ cause: new Error('relay message error') }))),
  )

// Send messages to other tabs through the broadcast channel

export class RelayStatusError extends Data.TaggedError('@xstack/sqlite/relay-status-error')<{
  readonly state: 'alive' | 'unknown'
  readonly cause?: Error | undefined
}> {}

export const runRelayClient = Effect.fn(function* ({
  channel,
  onUpdate,
}: {
  channel: SchemaBroadcastChannel
  onUpdate: OnUpdate
}) {
  channel.handle(SqliteBroadcastUpdates, ({ event }) => Effect.as(onUpdate(event), 'ok'))

  const run = (sql: string, params: ReadonlyArray<unknown>, rowMode: SqliteRowMode = 'object') =>
    channel
      .postMessage(
        new SqliteQueryExecute({ sql, params: params as SqliteParams, rowMode }, { disableValidation: true }),
      )
      .pipe(handleError)

  const runStream = (sql: string, params: ReadonlyArray<unknown>) => {
    const run = (index: number) =>
      Effect.runPromise(
        channel.postMessage(
          new SqliteQueryStream({ sql, params: params as SqliteParams, index }, { disableValidation: true }),
        ),
      )

    let i = 0
    async function* stream() {
      while (true) {
        const result = await run(i)
        if (!result) break
        yield result
        i++
      }
    }

    return Stream.fromAsyncIterable(stream(), (err) => new SqlError({ cause: err }))
  }

  const export_ = channel.postMessage(new SqliteExportExecute()).pipe(handleError)

  const import_ = (data: Uint8Array<ArrayBufferLike>) =>
    channel.postMessage(new SqliteImportExecute({ data }, { disableValidation: true })).pipe(handleError)

  const getUsedSize = channel.postMessage(new SqliteStorageSize()).pipe(handleError)

  const clientFactory = {
    run,
    runStream,
    export: export_,
    import: import_,
    getUsedSize,
  } as unknown as SqliteClientFactory

  return clientFactory
}, Effect.withSpan('relay-client.init'))

// Receive messages from the broadcast channel and relay the message to SQLite API call

export const handleRelayServer = Effect.fn(function* ({
  channel,
  sqlite3,
  db,
  onUpdate,
  hasReady,
}: {
  channel: SchemaBroadcastChannel
  sqlite3: SQLiteAPI
  db: number
  onUpdate: OnUpdate
  hasReady: () => boolean
}) {
  const run: (
    sql: string,
    params: ReadonlyArray<unknown>,
    rowMode?: SqliteRowMode,
  ) => Effect.Effect<any[], SqlError, never> = (sql, params, rowMode = 'object') =>
    Effect.try({
      try: () => {
        const results: Array<any> = []
        for (const stmt of sqlite3.statements(db, sql)) {
          let columns: Array<string> | undefined
          sqlite3.bind_collection(stmt, params as any)
          while (sqlite3.step(stmt) === WaSqlite.SQLITE_ROW) {
            columns = columns ?? sqlite3.column_names(stmt)
            const row = sqlite3.row(stmt)
            if (rowMode === 'object') {
              const obj: Record<string, any> = {}
              for (let i = 0; i < columns.length; i++) {
                obj[columns[i]] = row[i]
              }
              results.push(obj)
            } else {
              results.push(row)
            }
          }
        }
        return results
      },
      catch: (cause) => new SqlError({ cause, message: 'Failed to execute statement' }),
    })

  const runStream: (
    sql: string,
    params: ReadonlyArray<unknown>,
  ) => Stream.Stream<Record<string, any>, SqlError, never> = (sql, params) => {
    function* stream() {
      for (const stmt of sqlite3.statements(db, sql)) {
        let columns: Array<string> | undefined
        sqlite3.bind_collection(stmt, params as any)
        while (sqlite3.step(stmt) === WaSqlite.SQLITE_ROW) {
          columns = columns ?? sqlite3.column_names(stmt)
          const row = sqlite3.row(stmt)
          const obj: Record<string, any> = {}
          for (let i = 0; i < columns.length; i++) {
            obj[columns[i]] = row[i]
          }
          yield obj
        }
      }
    }

    return Stream.suspend(() => Stream.fromIteratorSucceed(stream()[Symbol.iterator]())).pipe(
      Stream.mapError((cause) => new SqlError({ cause, message: 'Failed to execute statement' })),
    )
  }

  const queryStream: (
    sql: string,
    params: ReadonlyArray<unknown>,
    initialIndex: number,
  ) => Effect.Effect<Record<string, any> | undefined, SqlError, never> = (sql, params, initialIndex) => {
    return Effect.try({
      try: () => {
        let currentIndex = 0
        let result: Record<string, any> | undefined

        for (const stmt of sqlite3.statements(db, sql)) {
          try {
            sqlite3.bind_collection(stmt, params as any)
            const columns = sqlite3.column_names(stmt)

            while (sqlite3.step(stmt) === WaSqlite.SQLITE_ROW) {
              if (currentIndex === initialIndex) {
                const row = sqlite3.row(stmt)
                result = columns.reduce(
                  (obj, col, i) => {
                    obj[col] = row[i]
                    return obj
                  },
                  {} as Record<string, any>,
                )
                break
              }
              currentIndex++
            }

            if (result) break
          } finally {
            sqlite3.finalize(stmt)
          }
        }

        return result
      },
      catch: (cause) =>
        new SqlError({
          cause,
          message: `Failed to execute stream statement at index ${initialIndex}`,
        }),
    })
  }

  const export_: Effect.Effect<Uint8Array<ArrayBufferLike>, SqlError, never> = Effect.try({
    try: () => sqlite3.serialize(db, 'main'),
    catch: (cause) => new SqlError({ cause, message: 'Failed to export database' }),
  })

  const import_: (data: Uint8Array<ArrayBufferLike>) => Effect.Effect<number, SqlError, never> = (
    data: Uint8Array<ArrayBufferLike>,
  ) =>
    Effect.try({
      try: () => sqlite3.deserialize(db, 'main', data, data.length, data.length, 1 | 2),
      catch: (cause) => new SqlError({ cause, message: 'Failed to import database' }),
    })

  // @ts-ignore
  const getUsedSize = Effect.sync(() => sqlite3._getUsedSize() as number)

  channel.handle(SqliteQueryExecute, ({ sql, params, rowMode }) => {
    return Effect.withTracerEnabled(run(sql, params, rowMode), false)
  })
  channel.handle(SqliteQueryStream, ({ sql, params, index }) =>
    Effect.withTracerEnabled(queryStream(sql, params, index), false),
  )
  channel.handle(SqliteImportExecute, ({ data }) => Effect.withTracerEnabled(import_(data), false))
  channel.handle(SqliteExportExecute, () => Effect.withTracerEnabled(export_, false))
  channel.handle(SqliteStorageSize, () => Effect.withTracerEnabled(getUsedSize, false))

  channel.handle(SqliteWorkerReadyEvent, () =>
    pipe(
      Effect.sync(() => ({ state: hasReady() ? 'alive' : 'unknown' }) as const),
      Effect.withTracerEnabled(false),
    ),
  )

  const runtime = yield* Effect.runtime<never>()
  const runExit = Runtime.runPromiseExit(runtime)
  const ignoreTables = [
    // sqlite internal tables
    'sqlite_master',
    'sqlite_sequence',
    // migration tables
    'sql_migrations',
    // event journal tables
    'event_remotes',
    'event_journal',
  ]
  sqlite3.update_hook(db, (op, db, table, rowid) => {
    if (!table) return

    if (ignoreTables.includes(table)) return

    const event = SqliteUpdateHookEvent.make(
      {
        op,
        db: db ?? 'main',
        table,
        rowid: String(Number(rowid)),
      },
      {
        disableValidation: true,
      },
    )

    // Broadcast Message to another tab
    runExit(
      Effect.all(
        [
          onUpdate(event),
          Effect.ignore(
            channel.postMessage(new SqliteBroadcastUpdates({ event }, { disableValidation: true }), { discard: true }),
          ),
        ],
        {
          concurrency: 'unbounded',
          discard: true,
        },
      ).pipe(Effect.catchAllCause(Effect.logError)),
    )
  })

  const clientFactory = {
    run,
    runStream,
    export: export_,
    import: import_,
    getUsedSize,
  } satisfies SqliteClientFactory as unknown as SqliteClientFactory

  return clientFactory
}, Effect.withSpan('relay-server.init'))

export const initSqlite = (options: { dbName: string }) =>
  Effect.gen(function* () {
    const factory = yield* pipe(
      Effect.tryPromise(() => SQLiteESMFactory()),
      Effect.retry({
        times: 10,
        schedule: Schedule.jittered(Schedule.exponential(200, 2)),
      }),
      Effect.withSpan('sqlite.factory'),
    )
    const sqlite3 = WaSqlite.Factory(factory)

    const vfs = yield* pipe(
      Effect.tryPromise(() => (AccessHandlePoolVFS as any).create('opfs', factory)),
      Effect.retry({
        times: 10,
        schedule: Schedule.jittered(Schedule.exponential(300, 1.5)),
      }),
      Effect.tap((vfs) =>
        Effect.sync(() => {
          sqlite3.vfs_register(vfs as any, false)
        }),
      ),
      Effect.retry({
        times: 10,
        schedule: Schedule.jittered(Schedule.exponential(300, 1.5)),
      }),
      Effect.withSpan('sqlite.accessHandlePoolVFSOPFS'),
    )

    // @ts-ignore

    sqlite3._getUsedSize = () => {
      // @ts-ignore
      return vfs.getUsedSize() as number
    }

    const db = yield* pipe(
      Effect.try({
        try: () => sqlite3.open_v2(options.dbName, undefined, 'opfs'),
        catch: (cause) => new SqlError({ cause, message: 'Failed to open database' }),
      }),
      Effect.retry({
        times: 3,
        schedule: Schedule.intersect(
          Schedule.jittered(Schedule.exponential(200, 1.5)),
          Schedule.elapsed.pipe(Schedule.whileOutput((elapsed) => Duration.lessThan(elapsed, Duration.seconds(5)))),
        ),
      }),
      Effect.acquireRelease((db) => Effect.ignore(Effect.try(() => sqlite3.close(db)))),
      Effect.withSpan('sqlite.open'),
    )

    return {
      sqlite3,
      db,
    }
  }).pipe(
    Effect.retry({
      times: 3,
      schedule: Schedule.jittered(Schedule.exponential(300, 1.5)),
    }),
    Effect.withSpan('sqlite-init', { attributes: { 'db.name': options.dbName } }),
  )
