import { SqlClient } from '@effect/sql/SqlClient'
import * as SqlKyselySqlite from '@xstack/sql-kysely/sqlite'
import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import { CamelCasePlugin } from 'kysely'

export interface KyselyTables<T> extends SqlKyselySqlite.EffectKysely<T> {}

export class Kysely extends Context.Tag('@xstack/sqlite/kysely')<Kysely, KyselyTables<any>>() {}

export const make = <DB>() => {
  const kysely = SqlKyselySqlite.make<DB>({
    plugins: [new CamelCasePlugin()],
  })

  const DBLive = Layer.effectContext(
    Effect.map(SqlClient, (sqlClient) =>
      pipe(Context.make(Kysely, kysely as unknown as KyselyTables<DB>), Context.add(SqlClient, sqlClient)),
    ),
  )

  return {
    DB: Kysely as Context.Tag<Kysely, KyselyTables<DB>>,
    DBLive,
  }
}
