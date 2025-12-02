import * as SqlClient from '@effect/sql/SqlClient'
import type { SqlError } from '@effect/sql/SqlError'
import * as Arr from 'effect/Array'
import * as Array from 'effect/Array'
import * as Context from 'effect/Context'
import * as Data from 'effect/Data'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import * as Option from 'effect/Option'
import * as Order from 'effect/Order'
import * as String from 'effect/String'

const LOG_SPAN = '@sql-migrator'

export type ResolvedMigration = {
  name: string
  date: Date
  sql: string
}

export type MigrationSqls = Array<ResolvedMigration>
export const MigrationSqls = Context.GenericTag<MigrationSqls>('@db:migration-sqls')

export interface SchemaSql extends String {}
export const SchemaSql = Context.GenericTag<SchemaSql, string>('@db:schema-sql')

export class MigrationError extends Data.TaggedError('@db:migration-error')<{
  readonly message?: string | undefined
  readonly cause?: Error | undefined
}> {}

export interface Migrator {
  /**
   * Starts the migration process.
   */
  start: Effect.Effect<void, MigrationError, SqlClient.SqlClient>
  /**
   * The list of migration SQLs.
   */
  sqls: MigrationSqls
  /**
   * The schema SQL.
   */
  schemaSql: SchemaSql
}
export const Migrator = Context.GenericTag<Migrator>('@db:migrator')

// filename: 20210831123456-init-todo/migration.sql
const formatMigrationName = (filename: string) => {
  const regex = /(\d+)(_|-)(.+?)\/migration.sql$/
  const match = filename.match(regex)

  if (!match) {
    throw new Error(`Invalid migration filename: ${filename}`)
  }

  const [_, part1, part2] = match.filter((_) => {
    return _ !== '-' && _ !== '_'
  })

  if (!part2 || !part1) {
    throw new Error(`Invalid migration filename: ${filename}`)
  }

  // example: 20240101081837
  const date = new Date(part1.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6Z'))

  return {
    name: `${part1}-${part2}`,
    date,
  }
}

const migrationOrder = Order.make<ResolvedMigration>((a, b) => Order.number(a.date.getTime(), b.date.getTime()))

type RecordFileName = `${string}/${string}-${string}/migration.sql`

export const fromRecord = (
  fn: () => {
    schemaSql?: string | undefined
    migrations: Record<RecordFileName, string>
  },
) => {
  return SqliteMigrator.pipe(
    Layer.provide(
      Layer.unwrapEffect(
        Effect.gen(function* () {
          const { migrations, schemaSql } = fn()

          const sqls: ResolvedMigration[] = pipe(
            Object.entries(migrations).map(([path, sql]) => {
              const { date, name } = formatMigrationName(path)

              return {
                name,
                date,
                sql,
              }
            }),
            Arr.sort(migrationOrder),
          )

          return Layer.merge(Layer.succeed(MigrationSqls, sqls), Layer.succeed(SchemaSql, schemaSql?.trim() || ''))
        }),
      ),
    ),
  )
}

export class MigrationItemError extends Data.TaggedError('@sqlite:migration-item-error')<{
  readonly name: ResolvedMigration
  readonly error: SqlError
}> {}

export interface Migration {
  readonly name: string
  readonly createdAt: Date
  readonly finishedAt: Date | null
}

export const toDate = (n: string) => {
  const date = new Date()
  const year = n.slice(0, 4)
  const month = n.slice(4, 6)
  const day = n.slice(6, 8)
  const hour = n.slice(8, 10)
  const minute = n.slice(10, 12)
  const second = n.slice(12, 14)

  date.setFullYear(Number(year))
  date.setMonth(Number(month) - 1)
  date.setDate(Number(day))
  date.setHours(Number(hour))
  date.setMinutes(Number(minute))
  date.setSeconds(Number(second))

  date.setMilliseconds(0)

  return date
}

const make = Effect.gen(function* () {
  const migrationSqls = yield* MigrationSqls
  const schemaSql = yield* SchemaSql

  const migrationsTable = 'sql_migrations'

  const schemaDate = () => toDate(schemaSql.slice(0, 17).replace('-- ', ''))

  const start = Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    const ensureMigrationsTableExist = pipe(
      Effect.logDebug('Ensured migration table'),
      Effect.zipRight(
        sql`
          CREATE TABLE IF NOT EXISTS ${sql(migrationsTable)} (
            name TEXT PRIMARY KEY NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            finished_at TEXT
          )
          `.withoutTransform,
      ),
      Effect.asVoid,
      Effect.mapError(
        (error) =>
          new MigrationError({
            message: 'Migration failed',
            cause: error,
          }),
      ),
      Effect.withSpan('migrator.ensureTable'),
    )

    // insert or update migrations
    const insertOrUpdateMigrations = (rows: Array<Migration>) => {
      if (rows.length === 0) {
        return Effect.succeed([])
      }

      return sql`
        INSERT INTO ${sql(migrationsTable)}
        ${sql.insert(
          rows.map(({ createdAt, finishedAt, name }) => ({
            name,
            created_at: createdAt.toISOString(),
            finished_at: finishedAt ? finishedAt.toISOString() : null,
          })),
        )}
        ON CONFLICT(name) DO UPDATE SET
          created_at = excluded.created_at,
          finished_at = excluded.finished_at
      `.withoutTransform
    }

    const latestMigration = sql<{ name: string; created_at: string; finished_at: string }>`
        SELECT * FROM ${sql(migrationsTable)} ORDER BY created_at DESC LIMIT 1
      `.withoutTransform.pipe(
      Effect.map((_) =>
        Option.map(Option.fromNullable(_[0]), ({ created_at, finished_at, name }): Migration => {
          return {
            name,
            createdAt: new Date(created_at),
            finishedAt: finished_at ? new Date(finished_at) : null,
          }
        }),
      ),
      Effect.orElseSucceed(() => Option.none<Migration>()),
    )

    const install = Effect.logDebug('Install schema').pipe(
      Effect.zipRight(sql.unsafe(schemaSql)),
      Effect.tap(() =>
        insertOrUpdateMigrations([
          {
            name: 'schema-sql',
            createdAt: schemaDate(),
            finishedAt: new Date(),
          },
        ]),
      ),
      Effect.asVoid,
      Effect.withSpan('schema.install'),
    )

    const migrate = Effect.gen(function* () {
      if (migrationSqls.length === 0) {
        yield* Effect.logDebug('No migrations to apply')
        return
      }

      yield* Effect.logDebug('Migrate')

      /**
       * 检查是否有重复的 migration id
       */
      if (new Set(migrationSqls.map(({ name }) => name)).size !== migrationSqls.length) {
        yield* new MigrationError({
          message: 'Found duplicate migration ids',
        })
      }

      /**
       * 清除已经本地不存在的 migration
       */
      yield* sql`
          SELECT name FROM ${sql(migrationsTable)} where name
        `.withoutTransform.pipe(
        Effect.flatMap((existMigrations) => {
          const toRemove = existMigrations
            .filter((m) => !migrationSqls.find((s) => s.name === m.name))
            .map((m) => m.name) as string[]

          return toRemove.length > 0
            ? sql`DELETE FROM ${sql(migrationsTable)} WHERE ${sql.in('name', toRemove)}`.withoutTransform
            : Effect.void
        }),
        Effect.withSpan('remove-local-migrations'),
      )

      /**
       * 获取最新的 migration 时间
       */
      const latestMigrationDate = yield* latestMigration.pipe(
        Effect.map(
          Option.match({
            onNone: () => new Date('1970-01-01'),
            onSome: (_) => _.createdAt,
          }),
        ),
      )

      /**
       * 分离出需要执行的 migration 和已经执行过的 migration
       * 需要执行的 migration 是大于最新的 migration 时间且大于 schema 最后更新时间
       */
      const [ignored, required] = Array.partition(migrationSqls, (_) => {
        return _.date > latestMigrationDate && _.date > schemaDate()
      })

      const successMigrations: Migration[] = []
      const failedMigrations: Migration[] = []

      yield* Effect.forEach(
        required,
        (item) =>
          pipe(
            Effect.logInfo('Running migration'),
            Effect.zipRight(sql.unsafe(item.sql)),
            Effect.mapError((error) => new MigrationItemError({ name: item, error })),
            Effect.tapBoth({
              onSuccess: () => {
                successMigrations.push({
                  createdAt: item.date,
                  finishedAt: new Date(),
                  name: item.name,
                })
                return Effect.void
              },
              onFailure: (e) => Effect.logError(e.error),
            }),
            Effect.annotateLogs('migration_name', item.name),
          ),
        {
          discard: true,
          concurrency: 1,
          batching: false,
        },
      ).pipe(
        // 不中断整体执行，记录错误的迁移
        Effect.catchTag('@sqlite:migration-item-error', (error) => {
          failedMigrations.push({
            createdAt: error.name.date,
            finishedAt: null,
            name: error.name.name,
          })

          return Effect.void
        }),
        Effect.tap(() =>
          Effect.logDebug('Done running migrations').pipe(
            Effect.annotateLogs(
              'failed_migrations',
              failedMigrations.map((_) => _.name),
            ),
            Effect.annotateLogs(
              'success_migrations',
              successMigrations.map((_) => _.name),
            ),
          ),
        ),
        Effect.withSpan('migrate.execute'),
      )

      if (failedMigrations.length > 0) {
        yield* new MigrationError({
          message: 'Exists failed migration',
          cause: new Error(`failed migrations: ${failedMigrations.map((_) => _.name).join(', ')}`),
        })
      }

      if (successMigrations.length > 0) {
        yield* Effect.logDebug('Save migrations').pipe(
          Effect.zipRight(insertOrUpdateMigrations(successMigrations)),
          Effect.withSpan('migrator.save_migrations'),
          Effect.mapError(
            (error) =>
              new MigrationError({
                message: 'Failed insertOrUpdate migrations',
                cause: error,
              }),
          ),
        )
      }

      yield* latestMigration.pipe(
        Effect.flatMap(
          Option.match({
            onNone: () => Effect.logDebug('Migrations complete'),
            onSome: (_) =>
              pipe(Effect.logDebug('Migrations complete'), Effect.annotateLogs('latest_migration_name', _.name)),
          }),
        ),
        Effect.annotateLogs({
          latest_migration_date: latestMigrationDate,
          ignored_migrations: ignored.map((_) => _.name),
          required_migrations: required.map((_) => _.name),
        }),
      )
    }).pipe(Effect.withSpan('schema.migrate'))

    const run = sql`SELECT * from ${sql(migrationsTable)} where name='schema-sql'`.pipe(
      Effect.tap((rows) =>
        Effect.if(rows.length === 0, {
          onTrue: () => (String.isNonEmpty(schemaSql) ? install : migrate),
          onFalse: () => migrate,
        }),
      ),
    )

    yield* pipe(
      ensureMigrationsTableExist,
      Effect.zipRight(run),
      // Effect.(sql.withTransaction(run)),
      Effect.catchTags({
        SqlError: (error) =>
          new MigrationError({
            message: 'Migration failed',
            cause: error,
          }),
      }),
      Effect.withSpan('migrator.start'),
    )
  }).pipe(
    Effect.withLogSpan(LOG_SPAN),
    Effect.annotateLogs({
      runtime: typeof window === 'undefined' ? 'worker' : 'main',
    }),
  )

  return {
    start,
    sqls: migrationSqls,
    schemaSql: schemaSql,
  } satisfies Migrator
})

export const SqliteMigrator = Layer.effect(Migrator, make)
