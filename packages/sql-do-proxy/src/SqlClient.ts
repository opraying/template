import * as Reactivity from '@effect/experimental/Reactivity'
import * as Client from '@effect/sql/SqlClient'
import type { Connection } from '@effect/sql/SqlConnection'
import * as SqlError from '@effect/sql/SqlError'
import * as Statement from '@effect/sql/Statement'
import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import { identity } from 'effect/Function'
import * as Layer from 'effect/Layer'
import * as Scope from 'effect/Scope'
import * as Stream from 'effect/Stream'

/**
 * @category type ids
 * @since 1.0.0
 */
export const TypeId: unique symbol = Symbol.for('@effect/sql-do-proxy/SqliteClient')

/**
 * @category type ids
 * @since 1.0.0
 */
export type TypeId = typeof TypeId

/**
 * @category models
 * @since 1.0.0
 */
export interface SqliteClient extends Client.SqlClient {
  readonly config: SqliteClientConfig
  readonly [TypeId]: TypeId

  /** Not supported in sqlite */
  readonly updateValues: never
}

/**
 * @category tags
 * @since 1.0.0
 */
export const SqliteClient = Context.GenericTag<SqliteClient>('@xstack/sql-do-proxy/sqlite-client')

type Primitive = string | number | boolean | Uint8Array<ArrayBufferLike>

/**
 * @category models
 * @since 1.0.0
 */
export interface SqliteClientConfig {
  readonly db: {
    exec(
      query: string,
      ...params: readonly Primitive[]
    ): Effect.Effect<
      {
        raw(): ReadonlyArray<any>
        columnNames: ReadonlyArray<string>
      },
      SqlError.SqlError,
      never
    >
    databaseSize(): Effect.Effect<number, SqlError.SqlError, never>
  }
  readonly spanAttributes?: Record<string, unknown> | undefined

  readonly transformResultNames?: ((str: string) => string) | undefined
  readonly transformQueryNames?: ((str: string) => string) | undefined
}

/**
 * @category constructor
 * @since 1.0.0
 */
export const make = (
  options: SqliteClientConfig,
): Effect.Effect<SqliteClient, never, Scope.Scope | Reactivity.Reactivity> =>
  Effect.gen(function* () {
    const compiler = Statement.makeCompilerSqlite(options.transformQueryNames)
    const transformRows = options.transformResultNames
      ? Statement.defaultTransforms(options.transformResultNames).array
      : undefined

    const makeConnection = Effect.gen(function* () {
      const db = options.db

      const runIterator: (
        sql: string,
        params?: ReadonlyArray<unknown> | undefined,
      ) => Effect.Effect<ReadonlyArray<any>, SqlError.SqlError, never> = Effect.fn(function* (
        sql: string,
        params: ReadonlyArray<unknown> = [],
      ) {
        const cursor = yield* db.exec(sql, ...(params as any))
        const columns = cursor.columnNames
        return cursor.raw().map((result) => {
          const obj: any = {}
          for (let i = 0; i < columns.length; i++) {
            const value = result[i]
            obj[columns[i]] = value instanceof ArrayBuffer ? new Uint8Array(value) : value
          }
          return obj
        })
      })

      const runStatement = (
        sql: string,
        params: ReadonlyArray<unknown> = [],
      ): Effect.Effect<ReadonlyArray<any>, SqlError.SqlError, never> =>
        Effect.catchAllCause(
          runIterator(sql, params),
          (cause) => new SqlError.SqlError({ cause, message: 'Failed to execute statement' }),
        )
      const runValues = (
        sql: string,
        params: ReadonlyArray<unknown> = [],
      ): Effect.Effect<ReadonlyArray<any>, SqlError.SqlError, never> =>
        Effect.catchAllCause(
          Effect.map(db.exec(sql, ...(params as any)), (_) => {
            const row = _.raw()
            for (let i = 0; i < row.length; i++) {
              const value = row[i]
              if (value instanceof ArrayBuffer) {
                // @ts-ignore
                row[i] = new Uint8Array(value) as any
              }
            }
            return row
          }),
          (cause) => new SqlError.SqlError({ cause, message: 'Failed to execute statement' }),
        )

      return identity<Connection>({
        execute(sql, params, transformRows) {
          return transformRows ? Effect.map(runStatement(sql, params), transformRows) : runStatement(sql, params)
        },
        executeRaw(sql, params) {
          return runStatement(sql, params)
        },
        executeValues(sql, params) {
          return runValues(sql, params)
        },
        executeUnprepared(sql, params, transformRows) {
          return transformRows ? Effect.map(runStatement(sql, params), transformRows) : runStatement(sql, params)
        },
        executeStream(_sql, _params, _transformRows) {
          return Stream.never
          // return Stream.suspend(() => {
          //   // const iterator = runIterator(sql, params)
          //   // return Stream.fromIteratorSucceed(iterator, 16)
          // }).pipe(
          //   transformRows
          //     ? Stream.mapChunks((chunk) => Chunk.unsafeFromArray(transformRows(Chunk.toReadonlyArray(chunk))))
          //     : identity,
          // )
        },
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
          ['db.system', 'sqlite'],
        ],
        transformRows,
      })) as SqliteClient,
      {
        [TypeId]: TypeId as TypeId,
        config: options,
      },
    )
  })

export const effect = <E = never, R = never>(
  _: Effect.Effect<
    {
      query: (sql: string, ...params: ReadonlyArray<Primitive>) => Effect.Effect<any, SqlError.SqlError, R>
      databaseSize: () => Effect.Effect<number, SqlError.SqlError, R>
    },
    E,
    R
  >,
) =>
  Layer.scoped(
    Client.SqlClient,
    Effect.gen(function* () {
      const ctx = yield* Effect.context<R>()

      const fn = yield* _

      const client = yield* make({
        db: {
          exec: Effect.fnUntraced(function* (sql: string, ...params: ReadonlyArray<Primitive>) {
            const result = yield* fn
              .query(sql, ...params)
              .pipe(
                Effect.catchAllDefect((e) => new SqlError.SqlError({ message: 'Proxy sqlite exec failed', cause: e })),
              )

            return {
              columnNames: result.columnNames,
              raw() {
                return result.raw
              },
            }
          }, Effect.provide(ctx)),
          databaseSize: Effect.fnUntraced(function* () {
            const databaseSize = yield* fn.databaseSize().pipe(
              Effect.catchAllDefect(
                (e) =>
                  new SqlError.SqlError({
                    message: 'Proxy sqlite get database size failure',
                    cause: e,
                  }),
              ),
            )

            return databaseSize
          }, Effect.provide(ctx)),
        },
      })

      return client
    }),
  ).pipe(Layer.provide(Reactivity.layer))
