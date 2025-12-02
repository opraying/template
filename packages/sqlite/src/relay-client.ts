import type { SerializedWorkerPool } from '@effect/platform/Worker'
import type { WorkerError } from '@effect/platform/WorkerError'
import type { SqlClient } from '@effect/sql/SqlClient'
import { SqlError } from '@effect/sql/SqlError'
import * as SqliteMetrics from '@xstack/sqlite/metrics'
import * as SqliteSchema from '@xstack/sqlite/schema'
import * as Duration from 'effect/Duration'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import type { ParseError } from 'effect/ParseResult'
import * as Stream from 'effect/Stream'

const LOG_SPAN = '@sql-client'

const getQueryType = (sql: string) => {
  const queryType = sql.trim().split(' ')[0].toUpperCase()

  const transactionTypes = ['BEGIN', 'COMMIT', 'ROLLBACK']
  if (transactionTypes.includes(queryType)) {
    return 'TRANSACTION'
  }

  return queryType
}

const measureQuery =
  (sql: string) =>
  <T>(effect: Effect.Effect<T, SqlError>) =>
    Effect.gen(function* () {
      const [a, b] = yield* Effect.timed(effect).pipe(
        // Increment error count
        Effect.tapError(() => SqliteMetrics.errorCount(Effect.succeed(1))),
        Effect.ensuring(
          Effect.all(
            [
              // Increment query count
              SqliteMetrics.queryCount(Effect.succeed(1)),
              // Record query type
              SqliteMetrics.queryTypes(Effect.succeed(getQueryType(sql))),
            ],
            { discard: true, concurrency: 'unbounded' },
          ),
        ),
      )

      const latency = Duration.toMillis(a)
      yield* Effect.all(
        [
          // Record latency
          SqliteMetrics.queryLatency(Effect.succeed(latency)),
          SqliteMetrics.lastQueryLatency(Effect.succeed(latency)),
        ],
        { concurrency: 'unbounded', discard: true },
      )

      return b
    })

const makeRelayClient = Effect.gen(function* () {
  let runHandle: (
    execute: SqliteSchema.SqliteQueryExecute,
  ) => Effect.Effect<SqliteSchema.QueryResult, SqlError | ParseError | WorkerError> = () =>
    Effect.succeed([] as SqliteSchema.QueryResult)

  let runStreamHandle: (
    execute: SqliteSchema.SqliteQueryStreamExecute,
  ) => Stream.Stream<Array<any>, SqlError | ParseError | WorkerError> = () => Stream.empty

  let exportHandle: Effect.Effect<Uint8Array<ArrayBufferLike>, SqlError | ParseError | WorkerError> = Effect.succeed(
    new Uint8Array(),
  )

  let importHandle: (data: Uint8Array<ArrayBufferLike>) => Effect.Effect<void, SqlError> = (
    _data: Uint8Array<ArrayBufferLike>,
  ) => Effect.succeed(undefined)

  const catchError = <A, R>(effect: Effect.Effect<A, SqlError | ParseError | WorkerError, R>) =>
    Effect.catchTags(effect, {
      ParseError: (error) => new SqlError({ message: 'parse error', cause: error }),
      WorkerError: (error) => new SqlError({ message: 'worker error', cause: error }),
    })

  const run: (execute: SqliteSchema.SqliteQueryExecute) => Effect.Effect<SqliteSchema.QueryResult, SqlError> = (
    execute: SqliteSchema.SqliteQueryExecute,
  ) => runHandle(execute).pipe(catchError)

  const runStream: (execute: SqliteSchema.SqliteQueryStreamExecute) => Stream.Stream<Array<any>, SqlError> = (
    execute: SqliteSchema.SqliteQueryStreamExecute,
  ) =>
    runStreamHandle(execute).pipe(
      Stream.catchTags({
        ParseError: (error) => new SqlError({ message: 'parse error', cause: error }),
        WorkerError: (error) => new SqlError({ message: 'worker error', cause: error }),
      }),
    )

  const export_: Effect.Effect<Uint8Array<ArrayBufferLike>, SqlError> = Effect.suspend(() =>
    exportHandle.pipe(catchError),
  )

  const import_: (data: Uint8Array<ArrayBufferLike>) => Effect.Effect<void, SqlError> = (
    data: Uint8Array<ArrayBufferLike>,
  ) => Effect.suspend(() => importHandle(data).pipe(catchError))

  const setRelayClient = (_client: SqlClient) => Effect.dieMessage('TODO: impl this')

  const setRelayWorker = (workerPool: SerializedWorkerPool<SqliteSchema.SqliteEvent>, _client: SqlClient) =>
    Effect.gen(function* () {
      runHandle = (execute) =>
        pipe(
          workerPool.executeEffect(execute) as ReturnType<typeof run>,
          Effect.tapErrorCause((cause) =>
            Effect.logTrace('query failure', cause).pipe(
              Effect.annotateLogs({
                ...execute,
              }),
            ),
          ),
          measureQuery(execute.sql),
          Effect.withLogSpan(LOG_SPAN),
        )

      runStreamHandle = (execute) =>
        pipe(
          workerPool.execute(
            new SqliteSchema.SqliteQueryStreamExecute(
              { sql: execute.sql, params: execute.params },
              { disableValidation: true },
            ),
          ) as ReturnType<typeof runStream>,
          Stream.onError((cause) =>
            Effect.logTrace('stream query failure', cause).pipe(
              Effect.annotateLogs({ ...execute }),
              Effect.withLogSpan(LOG_SPAN),
            ),
          ),
        )

      exportHandle = Effect.suspend(() =>
        pipe(
          workerPool.executeEffect(new SqliteSchema.SqliteExportExecute()) as typeof export_,
          Effect.tapErrorCause((cause) => Effect.logTrace('export failure', cause)),
          Effect.withLogSpan(LOG_SPAN),
        ),
      )

      importHandle = (data: Uint8Array<ArrayBufferLike>) =>
        pipe(
          workerPool.executeEffect(
            new SqliteSchema.SqliteImportExecute({ data }, { disableValidation: true }),
          ) as ReturnType<typeof import_>,
          Effect.tapErrorCause((cause) => Effect.logTrace('import failure', cause)),
          Effect.withLogSpan(LOG_SPAN),
        )
    })

  return {
    setClient: setRelayClient,
    setWorker: setRelayWorker,

    run,
    runStream,
    export: export_,
    import: import_,
  }
})

export class RelayClient extends Effect.Tag('@xstack/sqlite/relay-client')<
  RelayClient,
  Effect.Effect.Success<typeof makeRelayClient>
>() {
  static Default = Layer.scoped(this, makeRelayClient)
}
