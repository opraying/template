import * as Reactivity from '@effect/experimental/Reactivity'
import * as Client from '@effect/sql/SqlClient'
import type { Connection } from '@effect/sql/SqlConnection'
import { SqlError } from '@effect/sql/SqlError'
import * as Statement from '@effect/sql/Statement'
import { ATTR_DB_SYSTEM, DB_SYSTEM_VALUE_SQLITE } from '@opentelemetry/semantic-conventions/incubating'
import { type QueryResult, SqliteQueryExecute, SqliteQueryStreamExecute } from '@xstack/sqlite/schema'
import * as Chunk from 'effect/Chunk'
import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import { identity, pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import * as Stream from 'effect/Stream'

/**
 * @category type ids
 * @since 1.0.0
 */
export const TypeId: unique symbol = Symbol.for('@xstack/sqlite/sqlite-client')

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
  readonly export: Effect.Effect<Uint8Array<ArrayBufferLike>, SqlError>
  readonly import: (data: Uint8Array<ArrayBufferLike>) => Effect.Effect<void, SqlError>

  /** Not supported in sqlite */
  readonly updateValues: never
}

/**
 * @category tags
 * @since 1.0.0
 */
export const SqlClient = Context.GenericTag<SqlClient>('@xstack/sqlite/sqlite-client')

/**
 * @category models
 * @since 1.0.0
 */
export type SqliteClientConfig = {
  readonly spanAttributes?: Record<string, unknown>
  readonly transformResultNames?: (str: string) => string
  readonly transformQueryNames?: (str: string) => string
  readonly relay: {
    readonly run: (execute: SqliteQueryExecute) => Effect.Effect<QueryResult, SqlError>
    readonly runStream: (execute: SqliteQueryStreamExecute) => Stream.Stream<Array<any>, SqlError>
    readonly export: Effect.Effect<Uint8Array<ArrayBufferLike>, SqlError>
    readonly import: (data: Uint8Array<ArrayBufferLike>) => Effect.Effect<void, SqlError>
  }
}

interface SqliteConnection extends Connection {
  readonly export: Effect.Effect<Uint8Array<ArrayBufferLike>, SqlError>
  readonly import: (data: Uint8Array<ArrayBufferLike>) => Effect.Effect<void, SqlError>
}

/**
 * @category constructors
 * @since 1.0.0
 */
export const make = (options: SqliteClientConfig): Effect.Effect<SqlClient, never, Reactivity.Reactivity> =>
  Effect.gen(function* () {
    const reactivity = yield* Reactivity.Reactivity
    const compiler = Statement.makeCompilerSqlite(options.transformQueryNames)
    const transformRows = options.transformResultNames
      ? Statement.defaultTransforms(options.transformResultNames).array
      : undefined
    const relay = options.relay
    const run = (sql: string, params: ReadonlyArray<unknown> = [], rowMode: 'object' | 'array' = 'object') =>
      Effect.mapError(
        relay.run(new SqliteQueryExecute({ sql, params: params as any, rowMode }, { disableValidation: true })),
        (error) => {
          if (error && !error._tag) {
            return new SqlError({ message: 'query execute error', cause: error })
          }

          return error
        },
      )

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
            relay.runStream(new SqliteQueryStreamExecute({ sql, params: params as any }, { disableValidation: true })),
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
        export: relay.export,
        import: relay.import,
      })
    })

    const connection = yield* makeConnection
    const acquirer = Effect.succeed(connection)

    return Object.assign(
      (yield* Client.make({
        acquirer,
        transactionAcquirer: acquirer,
        compiler,
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
        export: connection.export,
        import: connection.import,
      },
    )
  })

/**
 * @category layers
 * @since 1.0.0
 */
export const layer = (config: SqliteClientConfig): Layer.Layer<Client.SqlClient, never, Reactivity.Reactivity> =>
  Layer.effectContext(
    Effect.map(make(config), (client) =>
      Context.make(SqlClient, client).pipe(Context.add(Client.SqlClient, client), Context.add(SqlClient, client)),
    ),
  )
