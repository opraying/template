/**
 * @since 1.0.0
 */
import type { KyselyConfig } from 'kysely'
import { DummyDriver, SqliteAdapter, SqliteIntrospector, SqliteQueryCompiler } from 'kysely'
import * as internal from './internal/kysely'
import type { EffectKysely } from './patch.types'

/**
 * @since 1.0.0
 * @category constructors
 */
export const make = <DB>(config?: Omit<KyselyConfig, 'dialect'>) =>
  internal.makeWithSql<DB>({
    ...config,
    dialect: {
      createAdapter: () => new SqliteAdapter(),
      createDriver: () => new DummyDriver(),
      createIntrospector: (db) => new SqliteIntrospector(db),
      createQueryCompiler: () => new SqliteQueryCompiler(),
    },
  })

/**
 * @since 1.0.0
 * @category constructors
 */
export const fromDB = <DB>(db: EffectKysely<DB>) => internal.makeWithSqlFromDB(db)

/**
 * @since 1.0.0
 * @category types
 */
export type * from './patch.types'
