import * as Reactivity from '@effect/experimental/Reactivity'
import * as SqlClient from '@effect/sql/SqlClient'
import { PrettyLogger } from '@xstack/preset-web/browser'
import { atomHooks, makeAtomService, UseUseServices, Atom } from '@xstack/atom-react'
import * as GlobalLayer from '@xstack/atom-react/global'
import { getSqlClient } from '@xstack/sqlite/client'
import type * as InternalClient from '@xstack/sqlite/internal/client'
import { flatten } from 'effect/Array'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import * as Option from 'effect/Option'
import * as Runtime from 'effect/Runtime'
import * as String from 'effect/String'

const QueryLayer = pipe(
  GlobalLayer.use('DebugDatabase', SqlClient.SqlClient, Reactivity.Reactivity),
  Layer.provide([PrettyLogger]),
)

export class DBService extends Effect.Service<DBService>()('DBDebugService', {
  accessors: true,
  effect: Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    const getTables = Effect.gen(function* () {
      const sql = yield* getSqlClient

      const excludeTables = ['sqlite_master', 'sqlite_sequence']
      const tables = yield* sql<{
        name: string
      }>`SELECT name FROM sqlite_master WHERE type='table' and name not in ${sql.in(excludeTables)}`

      const tablesAndCount = yield* Effect.forEach(
        tables,
        (table) =>
          sql<{
            name: string
            count: number
          }>`SELECT ${table.name} as name, COUNT(*) as count FROM ${sql.literal(table.name)}`,
        {
          concurrency: 'unbounded',
        },
      ).pipe(Effect.map((_) => flatten(_)))

      return tablesAndCount
    })

    const getTable = (table: string) =>
      Effect.gen(function* () {
        const sql = yield* getSqlClient

        const latestKey = ['createdAt', 'updatedAt']

        const [columns, rows] = yield* Effect.all([
          sql<{
            name: string
            type: string
            pk: 0 | 1
            notnull: 0 | 1
            dflt_value: string
          }>`pragma table_info(${sql(table)})`.pipe(
            Effect.map((results) =>
              results
                .map((_) => {
                  return {
                    name: String.snakeToCamel(_.name),
                    type: _.type,
                    primaryKey: _.pk === 1,
                    notNull: _.notnull === 1,
                    defaultValue: _.dflt_value,
                  } as const
                })
                .sort((a, b) => latestKey.indexOf(a.name) - latestKey.indexOf(b.name)),
            ),
          ),
          sql<any>`SELECT * FROM ${sql.literal(table)}`,
        ])

        return {
          rows,
          columns,
          columnsIndexs: columns.map((_) => _.name),
        }
      })

    const unsafeQuery = (sqlString: string) => sql.unsafe(sqlString)

    const export_ = Effect.gen(function* () {
      const data = yield* (sql as InternalClient.SqlClient).export
      const blob = new Blob([data.slice()], { type: 'application/octet-stream' })
      return blob
    })

    const import_ = Effect.fn(function* (_: Uint8Array<ArrayBufferLike>) {
      yield* (sql as InternalClient.SqlClient).import(_)
    })

    return {
      unsafeQuery,
      getTables,
      getTable,
      export: export_,
      import: import_,
    }
  }),
  dependencies: [],
}) {
  static get useAtom() {
    return makeAtomService(this, useDBService)
  }
}

const useDBService = UseUseServices(
  { DBService },
  QueryLayer,
)(({ runtime, services: { DBService } }) => {
  const selectModule = Atom.make<'table' | 'runner' | 'migration'>('runner')

  const selectedTable = Atom.make(Option.none<string>())

  const dbLockAcquireAtom = runtime.atom((ctx) =>
    Effect.gen(function* () {
      //@ts-ignore
      const init = (globalThis.__x_sqlite_lockAcquire as boolean) ?? false
      const runtime = yield* Effect.runtime()
      const run = Runtime.runFork(runtime)

      //@ts-ignore

      if (!globalThis.__x_sqlite_lockAcquireChange) {
        //@ts-ignore

        globalThis.__x_sqlite_lockAcquireChange = () => {
          run(Effect.sync(() => ctx.refreshSelf()))
        }
      }

      const cleanup = Effect.sync(() => {
        //@ts-ignore
        globalThis.__x_sqlite_lockAcquireChange = undefined
      })

      yield* Effect.addFinalizer(() => cleanup)

      return init
    }),
  )
  const lockAcquire = atomHooks(dbLockAcquireAtom, 'suspense')

  const query = runtime.fn((_: string) => DBService.unsafeQuery(_))

  const export_ = runtime.fn((options?: { filename?: string | undefined } | undefined) =>
    Effect.gen(function* () {
      const blob = yield* DBService.export

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = options?.filename || 'db.sqlite'
      a.click()
    }),
  )
  const import_ = runtime.fn((_: File) =>
    Effect.gen(function* () {
      const arrayBuffer = yield* Effect.promise(() => _.arrayBuffer())
      const uint8Array = new Uint8Array(arrayBuffer)
      yield* DBService.import(uint8Array)
    }),
  )

  const tablesAtom = runtime.atom(DBService.getTables)
  const tables = atomHooks(tablesAtom, 'suspense')

  const table = runtime.atom((ctx) =>
    Effect.gen(function* () {
      const table = yield* ctx.some(selectedTable)

      const tableData = yield* DBService.getTable(table)

      return tableData
    }),
  )

  const migrations = runtime.atom(() =>
    Effect.gen(function* () {
      const table = 'sql_migrations'
      const sql = yield* getSqlClient

      const migrations = yield* sql<{
        name: string
        finishedAt: string
        createdAt: string
      }>`SELECT * FROM ${sql.literal(table)}`

      return {
        table,
        migrations,
      }
    }),
  )

  return {
    selectModule,
    selectedTable,
    lockAcquire,
    query,
    export: export_,
    import: import_,
    tables,
    table,
    migrations,
  }
})
