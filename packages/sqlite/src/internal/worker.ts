import * as Reactivity from '@effect/experimental/Reactivity'
import * as Client from '@effect/sql/SqlClient'
import type { Connection } from '@effect/sql/SqlConnection'
import { SqlError } from '@effect/sql/SqlError'
import * as Statement from '@effect/sql/Statement'
import { ATTR_DB_SYSTEM, DB_SYSTEM_VALUE_SQLITE } from '@opentelemetry/semantic-conventions/incubating'
import * as Chunk from 'effect/Chunk'
import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import { identity, pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import * as Scope from 'effect/Scope'
import * as Stream from 'effect/Stream'

/**
 * @category type ids
 * @since 1.0.0
 */
export const TypeId: unique symbol = Symbol.for('@xstack/sqlite/sqlite-client-worker')

/**
 * @category type ids
 * @since 1.0.0
 */
export type TypeId = typeof TypeId

/**
 * @category models
 * @since 1.0.0
 */
export interface SqlClient extends Client.SqlClient {
  readonly [TypeId]: TypeId
  readonly config: SqliteClientConfig
  readonly export: Effect.Effect<Uint8Array, SqlError>
  readonly import: (data: Uint8Array<ArrayBufferLike>) => Effect.Effect<void, SqlError>

  readonly runStream: (sql: string, params: ReadonlyArray<unknown>) => Stream.Stream<Array<any>, SqlError>

  /** Not supported in sqlite */
  readonly updateValues: never
}

/**
 * @category tags
 * @since 1.0.0
 */
export const SqlClient = Context.GenericTag<SqlClient>('@xstack/sqlite/sqlite-client-worker')

export interface SqliteClientFactory {
  readonly run: (
    sql: string,
    params: ReadonlyArray<unknown>,
    rowMode?: 'object' | 'array',
  ) => Effect.Effect<Array<any>, SqlError, never>
  readonly runStream: (sql: string, params: ReadonlyArray<unknown>) => Stream.Stream<Record<string, any>, SqlError>
  readonly export: Effect.Effect<Uint8Array, SqlError>
  readonly import: (data: Uint8Array<ArrayBufferLike>) => Effect.Effect<void, SqlError>
  readonly getUsedSize: Effect.Effect<number, never, never>
}

/**
 * @category models
 * @since 1.0.0
 */
export type SqliteClientConfig = {
  readonly sqlite3Api: SqliteClientFactory
  readonly spanAttributes?: Record<string, unknown>
  readonly transformResultNames?: (str: string) => string
  readonly transformQueryNames?: (str: string) => string
}

interface SqliteConnection extends Connection {
  readonly export: Effect.Effect<Uint8Array, SqlError>
  readonly import: (data: Uint8Array<ArrayBufferLike>) => Effect.Effect<void, SqlError>
}

/**
 * @category constructor
 * @since 1.0.0
 */
export const make = (options: SqliteClientConfig): Effect.Effect<SqlClient, SqlError, Reactivity.Reactivity> =>
  Effect.gen(function* () {
    const reactivity = yield* Reactivity.Reactivity
    const compiler = Statement.makeCompilerSqlite(options.transformQueryNames)
    const transformRows = options.transformResultNames
      ? Statement.defaultTransforms(options.transformResultNames).array
      : undefined
    const api = options.sqlite3Api
    const run = api.run

    const makeConnection = Effect.gen(function* () {
      return identity<SqliteConnection>({
        execute(sql, params, transformRows) {
          return transformRows ? Effect.map(run(sql, params), transformRows) : run(sql, params)
        },
        executeRaw(sql, params) {
          return run(sql, params)
        },
        executeValues(sql, params) {
          return run(sql, params, 'array')
        },
        executeUnprepared(sql, params, transformRows) {
          return this.execute(sql, params, transformRows)
        },
        executeStream(sql, params, transformRows) {
          return pipe(
            api.runStream(sql, params),
            transformRows
              ? Stream.mapChunks((chunk) => Chunk.unsafeFromArray(transformRows(Chunk.toReadonlyArray(chunk))))
              : identity,
            Stream.mapError((error) => {
              if (error && !error._tag) {
                return new SqlError({ message: 'query stream execute error', cause: error })
              }

              return error
            }),
          )
        },
        export: api.export,
        import: api.import,
      })
    })

    const semaphore = yield* Effect.makeSemaphore(1)
    const connection = yield* makeConnection

    const acquirer = semaphore.withPermits(1)(Effect.succeed(connection))
    const transactionAcquirer = Effect.uninterruptibleMask((restore) =>
      Effect.as(
        Effect.zipRight(
          restore(semaphore.take(1)),
          Effect.tap(Effect.scope, (scope) => Scope.addFinalizer(scope, semaphore.release(1))),
        ),
        connection,
      ),
    )

    return Object.assign(
      (yield* Client.make({
        acquirer,
        compiler,
        transactionAcquirer,
        spanAttributes: [
          ...(options.spanAttributes ? Object.entries(options.spanAttributes) : []),
          [ATTR_DB_SYSTEM, DB_SYSTEM_VALUE_SQLITE],
        ],
        transformRows,
      })) as SqlClient,
      {
        [TypeId]: TypeId as TypeId,
        config: options,
        reactive: reactivity.stream,
        reactiveMailbox: reactivity.query,
        export: semaphore.withPermits(1)(connection.export),
        import: (data: Uint8Array<ArrayBufferLike>) => semaphore.withPermits(1)(connection.import(data)),
        runStream: api.runStream,
      },
    )
  })

/**
 * @category layers
 * @since 1.0.0
 */
export const layer = (config: SqliteClientConfig): Layer.Layer<Client.SqlClient, SqlError, Reactivity.Reactivity> =>
  Layer.effectContext(
    Effect.map(make(config), (client) => Context.make(SqlClient, client).pipe(Context.add(Client.SqlClient, client))),
  )
