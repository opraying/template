import * as Model from '@effect/sql/Model'
import * as SqlClient from '@effect/sql/SqlClient'
import * as SQLite from '@effect/sql-sqlite-node'
import { assert, describe, it } from '@effect/vitest'
import * as Database from '@xstack/db'
import * as Kysely from '@xstack/sql-kysely/sqlite'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as Schema from 'effect/Schema'
import * as String from 'effect/String'
import * as TestClock from 'effect/TestClock'
import { CamelCasePlugin } from 'kysely'
import * as V from '../src/kysely'

const GroupId = Schema.Uint8ArrayFromSelf.pipe(Schema.brand('GroupId'))

class Group extends Model.Class<Group>('Group')({
  id: Model.UuidV4Insert(GroupId),
  name: Schema.NonEmptyTrimmedString,
  description: Schema.String.pipe(
    Schema.propertySignature,
    Schema.withConstructorDefault(() => ''),
  ),
  createdAt: Model.DateTimeInsert,
  updatedAt: Model.DateTimeUpdate,
}) {
  static repo = V.repo(Group)
  static table = 'group' as const
  static readonly Array = Schema.Array(Group)
}

// Database Configuration
const tables_ = [Group] satisfies Database.Tables
type Tables = Database.TablesRecord<typeof tables_>
type TablesType = Database.TablesType<Tables>
type TablesEncoded = Database.TablesEncoded<Tables>
const _tables = Database.tables(tables_)

// SQLite Configuration
const SqliteLive = SQLite.SqliteClient.layer({
  filename: ':memory:',
  disableWAL: true,
  transformQueryNames: String.camelToSnake,
  transformResultNames: String.snakeToCamel,
})

// Helper function to setup database
const setupDatabase = Effect.gen(function* (_) {
  yield* TestClock.setTime(new Date(2023, 1, 1).getTime())
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS 'group' (
      id BLOB NOT NULL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at DATETIME NOT NULL,
      updated_at DATETIME NOT NULL
    )
  `

  // clear data
  yield* sql`DELETE FROM 'group'`

  const db = Kysely.make<TablesEncoded>({
    plugins: [new CamelCasePlugin()],
  })
  const repo = yield* Group.repo

  return { db, repo }
})

describe('Insert Operations', () => {
  it.layer(SqliteLive)('insert operations', (it) => {
    it.effect('insert operations', () =>
      Effect.gen(function* (_) {
        const { db, repo } = yield* setupDatabase

        // Insert single record with returning all fields
        const insert = repo.insert((input) => db.insertInto('group').values(input).returningAll())
        const insertResult = yield* insert(Group.insert.make({ name: 'A0' }))
        console.log('insertResult', insertResult)

        // Insert multiple records
        const insertResult2 = yield* insert([Group.insert.make({ name: 'A1' }), Group.insert.make({ name: 'A2' })])
        console.log('insertResult2', insertResult2)
      }),
    )

    it.effect('insert operations with decode', () =>
      Effect.gen(function* (_) {
        const { db, repo } = yield* setupDatabase

        const insert = repo.insert.decode(Group.select.pick('id'), (input) =>
          db.insertInto('group').values(input).returning('id'),
        )

        // Insert single record with decode
        const result1 = yield* insert(
          Group.insert.make({
            name: 'React',
            description: 'react en group',
          }),
        )
        console.log('result1', result1)

        // Insert multiple records with decode
        const result2 = yield* insert([Group.insert.make({ name: 'Group1' }), Group.insert.make({ name: 'Group2' })])
        console.log('result2', result2)
      }),
    )

    it.effect('insert operation with void', () =>
      Effect.gen(function* () {
        const { db, repo } = yield* setupDatabase

        const insertVoid = repo.insert.void((input) => db.insertInto('group').values(input))
        yield* insertVoid(Group.insert.make({ name: 'A4' }))
      }),
    )

    it.effect('should handle insert errors gracefully', () =>
      Effect.gen(function* (_) {
        const { db, repo } = yield* setupDatabase

        // Test duplicate key error
        const insert = repo.insert((input) => db.insertInto('group').values(input).returningAll())
        const group = Group.insert.make({ name: 'Duplicate' })

        yield* insert(group)

        const duplicateEffect = insert(group)
        const exit = yield* Effect.exit(duplicateEffect)

        assert(Exit.isFailure(exit))
      }),
    )
  })
})

describe('Select Operations', () => {
  it.layer(SqliteLive)('basic select', (it) => {
    it.effect('basic select', () =>
      Effect.gen(function* (_) {
        const { db, repo } = yield* setupDatabase

        // Insert test data
        const insert = repo.insert((input) => db.insertInto('group').values(input).returningAll())
        yield* insert(Group.insert.make({ name: 'Test Group' }))

        // Test basic select
        const select = repo.select(db.selectFrom('group').selectAll())
        const results = yield* select
        const single = yield* select.single

        console.log('single', results)
        console.log('single single', single)
      }),
    )

    it.effect('select operations with decode', () =>
      Effect.gen(function* (_) {
        const { db, repo } = yield* setupDatabase

        // Insert test data
        const insert = repo.insert((input) => db.insertInto('group').values(input).returningAll())
        yield* insert(Group.insert.make({ name: 'Test Group', description: 'Test Description' }))

        const select = repo.select.decode(
          Group.select.pick('name', 'description'),
          db.selectFrom('group').select(['name', 'description']).limit(5),
        )

        const results = yield* select
        const single = yield* select.single

        console.log('select decoded', results)
        console.log('single decoded single', single)
      }),
    )

    it.effect('select operations with codec', () =>
      Effect.gen(function* (_) {
        const { db, repo } = yield* setupDatabase

        // Insert test data
        const insert = repo.insert((input) => db.insertInto('group').values(input).returningAll())
        yield* insert(Group.insert.make({ name: 'Test Group', description: 'Test Description' }))

        const select = repo.select.codec(
          Group.select.pick('name'),
          Group.select.pick('id', 'name', 'updatedAt'),
          (input) =>
            db
              .selectFrom('group')
              .where('name', 'like', input.name)
              .select(['id', 'name', 'updatedAt'])
              .limit(3)
              .orderBy('createdAt desc'),
        )({ name: 'Test%' })

        console.log('select codec', yield* select)
        console.log('select codec single', yield* select.single)
      }),
    )

    it.effect('should support pagination and sorting', () =>
      Effect.gen(function* (_) {
        const { db, repo } = yield* setupDatabase

        // Insert test data
        const insert = repo.insert((input) => db.insertInto('group').values(input).returningAll())
        yield* insert([
          Group.insert.make({ name: 'A' }),
          Group.insert.make({ name: 'B' }),
          Group.insert.make({ name: 'C' }),
        ])

        // Test pagination
        const select = repo.select.decode(
          Group.select.pick('name'),
          db.selectFrom('group').select(['name']).orderBy('name asc').limit(2).offset(1),
        )

        const results = yield* select
        console.log('select pagination', results)
      }),
    )

    it.effect('should support complex conditions', () =>
      Effect.gen(function* (_) {
        const { db, repo } = yield* setupDatabase

        // Insert test data
        const insert = repo.insert((input) => db.insertInto('group').values(input).returningAll())
        yield* insert([
          Group.insert.make({ name: 'Test1', description: 'desc1' }),
          Group.insert.make({ name: 'Test2', description: 'desc2' }),
        ])

        // Test complex where conditions
        const select = repo.select.decode(
          Group.select.pick('name', 'description'),
          db
            .selectFrom('group')
            .select(['name', 'description'])
            .where('name', 'like', 'Test%')
            .where('description', '!=', ''),
        )

        const results = yield* select
        console.log('select complex conditions', results)
      }),
    )
  })
})

describe('Update Operations', () => {
  it.layer(SqliteLive)('basic update operations', (it) => {
    it.effect('basic update operations', () =>
      Effect.gen(function* (_) {
        const { db, repo } = yield* setupDatabase

        // Insert initial data
        const insert = repo.insert((input) => db.insertInto('group').values(input).returningAll())
        const group = yield* insert(
          Group.insert.make({
            name: 'Initial',
            description: 'Initial description',
          }),
        )

        // Test basic update
        const update = repo.update((input) =>
          db.updateTable('group').set(input).where('id', '=', input.id).returningAll(),
        )

        const updated = yield* update(
          Group.update.make({
            id: group.id,
            name: 'Updated',
            description: 'Updated description',
          }),
        )

        return { original: group, updated }
      }),
    )

    it.effect('should perform update operations with decode', () =>
      Effect.gen(function* (_) {
        const { db, repo } = yield* setupDatabase

        // Insert initial data
        const insert = repo.insert((input) => db.insertInto('group').values(input).returningAll())
        const group = yield* insert(
          Group.insert.make({
            name: 'Initial',
            description: 'Initial description',
          }),
        )

        const update = repo.update.decode(Group.update.pick('name', 'description', 'updatedAt'), (input) =>
          db.updateTable('group').set(input).where('id', '=', input.id).returning(['name', 'description', 'updatedAt']),
        )

        const _result = yield* update(
          Group.update.make({
            id: group.id,
            name: 'Updated',
            description: 'Updated description',
          }),
        )
      }),
    )

    it.effect('should support batch updates', () =>
      Effect.gen(function* (_) {
        const { db, repo } = yield* setupDatabase

        // Insert test data
        const insert = repo.insert((input) => db.insertInto('group').values(input).returningAll())
        const groups = yield* insert([Group.insert.make({ name: 'Batch1' }), Group.insert.make({ name: 'Batch2' })])

        // Test batch update
        const update = repo.update((_input) =>
          db.updateTable('group').set({ description: 'Updated' }).where('name', 'like', 'Batch%').returningAll(),
        )

        const _results = yield* update(
          Group.update.make({
            id: groups[0].id,
            description: 'Updated',
            name: 'Updated Name',
          }),
        )

        // Verify batch update results
      }),
    )
  })
})

describe('Utility Operations', () => {
  it.layer(SqliteLive)('utility operations', (it) => {
    it.effect('should demonstrate encoding/decoding utilities', () =>
      Effect.gen(function* (_) {
        const _v1 = V.encode(Group.jsonUpdate, (_input) => Effect.succeed(1), {} as any)
        const _v2 = V.decode(Group.Array)(Effect.succeed([]))
        const _v3 = V.codec(Group.select.pick('id', 'name'), Group.Array, (_input) => Effect.succeed([]), {} as any)
      }),
    )
  })
})
