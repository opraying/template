/**
 * @since 1.0.0
 */
import * as SqlClient from '@effect/sql/SqlClient'
import * as Effect from 'effect/Effect'
import type * as ReadonlyRecord from 'effect/Record'
import * as Stream from 'effect/Stream'
import type { KyselyConfig } from 'kysely'
import {
  AlterTableColumnAlteringBuilder,
  CreateIndexBuilder,
  CreateSchemaBuilder,
  CreateTableBuilder,
  CreateTypeBuilder,
  CreateViewBuilder,
  DeleteQueryBuilder,
  DropIndexBuilder,
  DropSchemaBuilder,
  DropTableBuilder,
  DropTypeBuilder,
  DropViewBuilder,
  InsertQueryBuilder,
  Kysely,
  UpdateQueryBuilder,
  WheneableMergeQueryBuilder,
} from 'kysely'
import type { EffectKysely } from '../patch.types'
import { effectifyWithExecute, effectifyWithSql, patch } from './patch'

/**
 * @internal
 * patch all compilable/executable builders with commit prototypes
 *
 * @warning side effect
 */
patch(AlterTableColumnAlteringBuilder.prototype)
patch(CreateIndexBuilder.prototype)
patch(CreateSchemaBuilder.prototype)
patch(CreateTableBuilder.prototype)
patch(CreateTypeBuilder.prototype)
patch(CreateViewBuilder.prototype)
patch(DropIndexBuilder.prototype)
patch(DropSchemaBuilder.prototype)
patch(DropTableBuilder.prototype)
patch(DropTypeBuilder.prototype)
patch(DropViewBuilder.prototype)
patch(InsertQueryBuilder.prototype)
patch(UpdateQueryBuilder.prototype)
patch(DeleteQueryBuilder.prototype)
patch(WheneableMergeQueryBuilder.prototype)

const patchFlag = Symbol.for('sql-kysely-patch-flag')
const patchDB = <DB>(db: EffectKysely<DB>) => {
  // @ts-ignore
  if (db[patchFlag]) {
    return db
  }

  db.withTransaction = <R, E, A>(self: Effect.Effect<A, E, R>) =>
    Effect.flatMap(SqlClient.SqlClient, (client) => client.withTransaction(self)) as any
  db.reactive = <A, E, R>(
    keys: ReadonlyArray<unknown> | ReadonlyRecord.ReadonlyRecord<string, ReadonlyArray<unknown>>,
    effect: Effect.Effect<A, E, R>,
  ) => Stream.unwrap(Effect.map(SqlClient.SqlClient, (client) => client.reactive(keys, effect))) as any
  db.reactiveMailbox = <A, E, R>(
    keys: ReadonlyArray<unknown> | ReadonlyRecord.ReadonlyRecord<string, ReadonlyArray<unknown>>,
    effect: Effect.Effect<A, E, R>,
  ) => Effect.map(SqlClient.SqlClient, (client) => client.reactiveMailbox(keys, effect)) as any

  // SelectQueryBuilder is not exported from "kysely" so we patch the prototype from it's instance
  const selectPrototype = Object.getPrototypeOf(db.selectFrom('' as any))
  patch(selectPrototype)

  // @ts-ignore
  db[patchFlag] = true
}

/**
 * @internal
 * create a Kysely instance from a dialect
 * and using an effect/sql client backend
 */
export const makeWithSql = <DB>(config: KyselyConfig) => {
  const db = new Kysely<DB>(config) as unknown as EffectKysely<DB>
  patchDB(db)
  return effectifyWithSql(db, ['compile', 'withTransaction', 'reactive', 'reactiveMailbox'])
}

/**
 * @internal
 * create a Kysely instance from a dialect
 * and using an effect/sql client backend
 */
export const makeWithSqlFromDB = <DB>(db: EffectKysely<DB>) => {
  patchDB(db)
  return effectifyWithSql(db, ['compile', 'withTransaction', 'reactive', 'reactiveMailbox'])
}

/**
 * @internal
 * create a Kysely instance from a dialect
 * and using the native kysely driver
 */
export const makeWithExecute = <DB>(config: KyselyConfig) => {
  const db = new Kysely<DB>(config)
  // SelectQueryBuilder is not exported from "kysely" so we patch the prototype from it's instance
  const selectPrototype = Object.getPrototypeOf(db.selectFrom('' as any))
  patch(selectPrototype)
  return effectifyWithExecute(db)
}
