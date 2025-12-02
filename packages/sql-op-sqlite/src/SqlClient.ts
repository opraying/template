/**
 * @since 1.0.0
 */
import * as Reactivity from '@effect/experimental/Reactivity'
import * as Client from '@effect/sql/SqlClient'
import type { Connection } from '@effect/sql/SqlConnection'
import { SqlError } from '@effect/sql/SqlError'
import * as Statement from '@effect/sql/Statement'
import * as Sqlite from '@op-engineering/op-sqlite'
import * as Otel from '@opentelemetry/semantic-conventions'
import * as Config from 'effect/Config'
import type { ConfigError } from 'effect/ConfigError'
import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as FiberRef from 'effect/FiberRef'
import { identity } from 'effect/Function'
import { globalValue } from 'effect/GlobalValue'
import * as Layer from 'effect/Layer'
import * as Scope from 'effect/Scope'

/**
 * @category type ids
 * @since 1.0.0
 */
export const TypeId: unique symbol = Symbol.for('@effect/sql-do-sqlite/SqliteClient')

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
  readonly [TypeId]: TypeId
  readonly config: SqliteClientConfig
  readonly extra: DbExtraMethods

  /** Not supported in sqlite */
  readonly updateValues: never
}

/**
 * @category tags
 * @since 1.0.0
 */
export const SqliteClient = Context.GenericTag<SqliteClient>('@xstack/sql-do-sqlite/sqlite-client')

/**
 * @category models
 * @since 1.0.0
 */
export interface SqliteClientConfig {
  readonly filename: string
  readonly location?: string | undefined
  readonly encryptionKey?: string | undefined
  readonly spanAttributes?: Record<string, unknown> | undefined
  readonly transformResultNames?: ((str: string) => string) | undefined
  readonly transformQueryNames?: ((str: string) => string) | undefined
}

/**
 * @category fiber refs
 * @since 1.0.0
 */
export const asyncQuery: FiberRef.FiberRef<boolean> = globalValue('@effect/sql-do-sqlite/Client/asyncQuery', () =>
  FiberRef.unsafeMake(false),
)

/**
 * @category extra methods
 * @since 1.0.0
 */
interface DbExtraMethods {
  readonly attach: (params: {
    secondaryDbFileName: string
    alias: string
    location?: string
  }) => Effect.Effect<void, never, never>
  readonly delete: () => Effect.Effect<void, never, never>
  readonly loadFile: (location: string) => Effect.Effect<Sqlite.FileLoadResult, never, never>
  readonly loadExtension: (path: string, entryPoint?: string) => Effect.Effect<void, never, never>
  readonly getDbPath: () => Effect.Effect<string, never, never>
}

/**
 * @category fiber refs
 * @since 1.0.0
 */
export const withAsyncQuery = <R, E, A>(effect: Effect.Effect<A, E, R>) => Effect.locally(effect, asyncQuery, true)

interface SqliteConnection extends Connection, DbExtraMethods {}

/**
 * @category constructor
 * @since 1.0.0
 */
export const make = (
  options: SqliteClientConfig,
): Effect.Effect<SqliteClient, never, Scope.Scope | Reactivity.Reactivity> =>
  Effect.gen(function* () {
    const clientOptions: Parameters<typeof Sqlite.open>[0] = {
      name: options.filename,
    }
    if (options.location) {
      clientOptions.location = options.location
    }
    if (options.encryptionKey) {
      clientOptions.encryptionKey = options.encryptionKey
    }

    const compiler = Statement.makeCompilerSqlite(options.transformQueryNames)
    const transformRows = options.transformResultNames
      ? Statement.defaultTransforms(options.transformResultNames).array
      : undefined

    const reactivity = yield* Reactivity.Reactivity

    // https://github.com/OP-Engineering/op-sqlite/blob/92cf03d3662d2473379fb66923825ca6f4fba05e/docs/docs/api.md
    const makeConnection = Effect.gen(function* () {
      const db = Sqlite.open(clientOptions)

      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          db.close()
          db.updateHook(null)
        }),
      )

      db.updateHook(({ table, operation: _operation, row: _row, rowId }) =>
        reactivity.unsafeInvalidate({ [table]: [rowId] }),
      )

      const run = (sql: string, params: ReadonlyArray<unknown> = []) =>
        Effect.withFiberRuntime<Array<any>, SqlError>((fiber) => {
          if (fiber.getFiberRef(asyncQuery)) {
            return Effect.map(
              Effect.tryPromise({
                try: () => db.execute(sql, params as Array<any>),
                catch: (cause) => new SqlError({ cause, message: 'Failed to execute statement (async)' }),
              }),
              (result) => result.rows ?? [],
            )
          }
          return Effect.try({
            try: () => db.executeSync(sql, params as Array<any>).rows,
            catch: (cause) => new SqlError({ cause, message: 'Failed to execute statement' }),
          })
        })

      return identity<SqliteConnection>({
        execute(sql, params, transformRows) {
          return transformRows ? Effect.map(run(sql, params), transformRows) : run(sql, params)
        },
        executeRaw(sql, params) {
          return run(sql, params)
        },
        executeValues(sql, params) {
          return Effect.map(run(sql, params), (results) => {
            if (results.length === 0) {
              return []
            }
            const columns = Object.keys(results[0])
            return results.map((row) => columns.map((column) => row[column]))
          })
        },
        executeUnprepared(sql, params, transformRows) {
          return this.execute(sql, params, transformRows)
        },
        executeStream() {
          return Effect.dieMessage('executeStream not implemented')
        },
        delete() {
          return Effect.sync(() => db.delete())
        },
        attach(params) {
          return Effect.sync(() => db.attach(params))
        },
        loadFile(location) {
          return Effect.promise(() => db.loadFile(location)).pipe(Effect.orDie)
        },
        loadExtension(path, entryPoint) {
          return Effect.sync(() => db.loadExtension(path, entryPoint))
        },
        getDbPath() {
          return Effect.sync(() => db.getDbPath())
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
          [Otel.SEMATTRS_DB_SYSTEM, Otel.DBSYSTEMVALUES_SQLITE],
        ],
        transformRows,
      })) as SqliteClient,
      {
        [TypeId]: TypeId,
        config: options,
        extra: {
          delete: connection.delete,
          attach: connection.attach,
          loadFile: connection.loadFile,
          loadExtension: connection.loadExtension,
          getDbPath: connection.getDbPath,
        },
      },
    )
  })

/**
 * @category layers
 * @since 1.0.0
 */
export const layerConfig = (
  config: Config.Config.Wrap<SqliteClientConfig>,
): Layer.Layer<SqliteClient | Client.SqlClient, ConfigError> =>
  Layer.scopedContext(
    Config.unwrap(config).pipe(
      Effect.flatMap(make),
      Effect.map((client) => Context.make(SqliteClient, client).pipe(Context.add(Client.SqlClient, client))),
    ),
  ).pipe(Layer.provide(Reactivity.layer))

/**
 * @category layers
 * @since 1.0.0
 */
export const layer = (config: SqliteClientConfig): Layer.Layer<SqliteClient | Client.SqlClient, ConfigError> =>
  Layer.scopedContext(
    Effect.map(make(config), (client) =>
      Context.make(SqliteClient, client).pipe(Context.add(Client.SqlClient, client)),
    ),
  ).pipe(Layer.provide(Reactivity.layer))
