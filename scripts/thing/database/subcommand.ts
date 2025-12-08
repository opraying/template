import { FileSystem, Path } from '@effect/platform'
import type { SqlError } from '@effect/sql'
import * as SqlD1 from '@effect/sql-d1/D1Client'
import { formatSchema, loadSchemaContext } from '@prisma/internals'
import type { EngineArgs } from '@prisma/migrate'
import { SchemaEngineCLI } from '@prisma/migrate'
import { Effect, Exit, Layer, pipe, Schedule, Scope, String } from 'effect'
import { tsImport } from 'tsx/esm/api'
import type { Unstable_Config } from 'wrangler'
import { generate, type PrismaGenerateOptions } from '../../../packages/db/src/prisma'
import type { TablesRecord } from '../../../packages/db/src/schema'
import { CloudflareConfig } from '../cloudflare/api'
import { getD1Name, parseConfig } from '../cloudflare/wrangler'
import type {
  DatabaseDumpSubcommand,
  DatabaseExecuteSubcommand,
  DatabaseMigrateDeploySubcommand,
  DatabaseMigrateDevSubcommand,
  DatabaseMigrateResetSubcommand,
  DatabaseMigrateResolveSubcommand,
  DatabasePushSubcommand,
  DatabaseSeedSubcommand,
} from './domain'
import { shell, shellInPath } from '../utils/shell'
import type * as Workspace from '../workspace'
import { CaptureStdout } from '../utils/capture-stdout'
import { formatMigrationName } from './utils'

type DatabaseConfig =
  | {
      provider: PrismaGenerateOptions['provider']
      runtime: 'd1'
    }
  | {
      provider: PrismaGenerateOptions['provider']
      runtime: 'browser'
    }
  | {
      provider: PrismaGenerateOptions['provider']
      runtime: 'server'
      url: string
    }

type SeedEntry = {
  start: Effect.Effect<void, SqlError.SqlError, never>
}

const getWranglerConfig = Effect.fn('wrangler.get-config')(function* (
  workspace: Workspace.Workspace,
  { database }: { database?: string | undefined } = {},
): Effect.fn.Return<
  {
    persistRoot: string
    persistTo: string
    wranglerConfigPath: string
    databaseName: string
    databaseNameId: string
    databaseFile: string
    databaseId: string | undefined
    previewDatabaseId: string | undefined
  },
  never,
  Path.Path | Scope.Scope
> {
  const path = yield* Path.Path
  const wranglerConfigPath = path.join(workspace.projectPath, 'wrangler.jsonc')

  const { config: wranglerConfig, path: foundWranglerConfigPath } = yield* parseConfig(
    wranglerConfigPath,
    process.env.NODE_ENV,
    process.env.STAGE,
  ).pipe(Effect.orDie)

  const selectedDatabaseName = database || wranglerConfig.d1_databases[0].database_name
  const selectedDatabase = wranglerConfig.d1_databases.find((_) => _.database_name === selectedDatabaseName)

  if (!selectedDatabaseName) {
    return yield* Effect.dieMessage('No database name provided')
  }

  const databaseNameId = yield* databaseNameToId(wranglerConfig, selectedDatabaseName)
  const previewDatabaseId = selectedDatabase?.preview_database_id
  const databaseId = selectedDatabase?.database_id

  const persistRoot = path.join(workspace.root, '.wrangler/state')
  const persistTo = path.join(persistRoot, 'v3')
  const dbFile = path.join(persistTo, 'd1/miniflare-D1DatabaseObject', `${databaseNameId}.sqlite`)

  return {
    persistRoot,
    persistTo,
    wranglerConfigPath: foundWranglerConfigPath,
    databaseName: selectedDatabaseName,
    databaseNameId,
    databaseFile: dbFile,
    databaseId,
    previewDatabaseId,
  }
})

const devDB = 'dev.db'

const getMigrationDate = () => {
  const date = new Date()
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const seconds = date.getSeconds()

  const pad = (n: number) => n.toString().padStart(2, '0')

  return `${year}${pad(month)}${pad(day)}${pad(hours)}${pad(minutes)}${pad(seconds)}`
}

export const existDatabase = Effect.fn('db.exist-database')(function* (
  workspace: Workspace.Workspace,
): Effect.fn.Return<boolean, never, Path.Path | FileSystem.FileSystem> {
  yield* Effect.annotateCurrentSpan({
    projectName: workspace.projectName,
  })

  const path = yield* Path.Path
  const fs = yield* FileSystem.FileSystem

  const dbDir = path.join(workspace.projectPath, 'db')

  const migrationsDir = path.join(dbDir, 'migrations')

  return yield* fs.exists(migrationsDir).pipe(Effect.orElseSucceed(() => false))
}, Effect.orDie)

const detectDatabase = Effect.fn('db.detect-database')(function* (
  workspace: Workspace.Workspace,
  { databaseName }: { databaseName?: string | undefined } = {},
): Effect.fn.Return<
  {
    dbDir: string
    migrationsDir: string
    tables: Record<string, any>
    config: DatabaseConfig
    tsconfigPath: string
  },
  never,
  Path.Path | FileSystem.FileSystem
> {
  yield* Effect.annotateCurrentSpan({
    projectName: workspace.projectName,
    databaseName,
  })

  const path = yield* Path.Path
  const fs = yield* FileSystem.FileSystem

  const dbDir = path.join(workspace.projectPath, 'db')

  const migrationsDir = path.join(dbDir, 'migrations')
  yield* pipe(
    fs.exists(migrationsDir),
    Effect.tap((exists) => (!exists ? fs.makeDirectory(migrationsDir) : Effect.void)),
    Effect.orDie,
  )

  const tsconfigPath = path.join(workspace.projectPath, 'tsconfig.app.json')
  const tablesPath = path.join(dbDir, 'tables.ts')

  const { tables, config } = yield* Effect.promise(() =>
    tsImport(tablesPath, { parentURL: import.meta.url, tsconfig: tsconfigPath }),
  ).pipe(
    Effect.map((_) => {
      const config = _.config as DatabaseConfig

      return {
        tables: _.tables as TablesRecord<any>,
        config,
      }
    }),
  )

  return {
    dbDir,
    migrationsDir,
    tables,
    config,
    tsconfigPath,
  }
})

type PrismaMigration = {
  filepath: string
  content: string
}

const getMigrations = Effect.fn('db.get-migrations')(function* (
  dir: string,
): Effect.fn.Return<Array<PrismaMigration>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path

  const migrations = yield* fs.readDirectory(dir).pipe(
    Effect.map((files) =>
      files
        .filter((item) => {
          if (item === 'migration_lock.toml') {
            return false
          }

          // maybe directory
          if (item.indexOf('_') > -1) {
            return true
          }

          // maybe file
          return item.endsWith('.sql')
        })
        .sort((a, b) => {
          const v1 = a.split('_')[0]
          const v2 = b.split('_')[0]

          const t1 = Number.parseInt(v1, 10)
          const t2 = Number.parseInt(v2, 10)

          if (t1 < t2) return 1
          if (t1 > t2) return -1
          return 0
        }),
    ),
    Effect.flatMap((files) =>
      Effect.forEach(
        files,
        Effect.fnUntraced(function* (filename) {
          const filepath = path.join(dir, filename)
          const content = yield* fs.readFileString(filepath)

          return {
            filepath,
            content,
          }
        }),
      ),
    ),
    Effect.orDie,
  )

  return migrations
})

const syncPrismaSchema = Effect.fn('prisma.sync-schema')(function* (
  workspace: Workspace.Workspace,
  { dbDir }: { dbDir: string },
  config: DatabaseConfig,
  tables: TablesRecord<any>,
): Effect.fn.Return<
  {
    prismaPath: string
    prisma: string
  },
  never,
  Path.Path | FileSystem.FileSystem
> {
  const path = yield* Path.Path
  const fs = yield* FileSystem.FileSystem

  if (config.runtime === 'server' && !config.url) {
    return yield* Effect.dieMessage('Missing database url')
  }

  const generated = yield* Effect.try(() =>
    generate(
      {
        provider: config.provider,
        generator: {
          markdown: {
            title: 'Database Schema',
            output: './database-schema.md',
            root: path.relative(dbDir, workspace.root),
          },
        },
      },
      tables,
    ),
  ).pipe(
    Effect.andThen((content) =>
      formatSchema({ schemas: [['schema.prisma', content]] }, { insertSpaces: true, tabSize: 2 }),
    ),
    Effect.map((result) => result[0][1]),
    Effect.orDie,
  )

  const prismaPath = path.join(dbDir, 'schema.prisma')
  yield* fs.writeFileString(prismaPath, generated).pipe(Effect.orDie)

  const prismaBin = path.join(workspace.root, 'node_modules/.bin/prisma')

  yield* shellInPath(dbDir)`
    $ ${prismaBin} generate --schema=./schema.prisma
  `

  yield* Effect.logInfo('Prisma schema generated')

  return {
    prismaPath,
    prisma: generated,
  }
})

const databaseNameToId = (config: Unstable_Config, name: string) =>
  Effect.suspend(() => {
    const databaseId = config.d1_databases.find((item) => item.database_name === name)?.database_id

    return !databaseId ? Effect.dieMessage(`Database ${name} not found`) : Effect.succeed(getD1Name(databaseId))
  })

/**
 * Push changes to local d1 database
 */
const pushD1 = Effect.fn('push-d1')(function* (
  workspace: Workspace.Workspace,
  { sql, database }: { sql: string; database?: string | undefined },
): Effect.fn.Return<void, never, Path.Path | Scope.Scope> {
  const { persistRoot, wranglerConfigPath, databaseName } = yield* getWranglerConfig(workspace, {
    database,
  })

  const output = yield* shell`
    $ wrangler d1 execute ${databaseName} --local --persist-to=${persistRoot} --config=${wranglerConfigPath} --json --command="${sql}"
  `.pipe(
    Effect.withSpan('db.d1-execute', {
      attributes: {
        projectName: workspace.projectName,
        database: database || 'default',
        databaseName,
        sqlLength: sql.length,
      },
    }),
  )

  if (output.stderr) {
    yield* Effect.logError('D1 push failed', output.stderr)
  } else {
    yield* Effect.try(() => JSON.parse(output.stdout)).pipe(
      Effect.orDieWith(() => new Error('Failed to parse JSON')),
      Effect.andThen((result: any[]) => {
        const allSuccess = result.every((item) => item.success)

        if (allSuccess) {
          return Effect.logInfo('D1 push success').pipe(Effect.annotateLogs({ ...result }))
        }

        return Effect.logError('D1 push failed').pipe(Effect.annotateLogs({ ...result }))
      }),
    )
  }
})

/**
 * Reset local d1 database
 */
const resetD1 = Effect.fn('reset-d1')(function* (
  workspace: Workspace.Workspace,
  subcommand: { database: string | undefined },
): Effect.fn.Return<void, never, Path.Path | Scope.Scope> {
  const path = yield* Path.Path
  const { persistRoot, wranglerConfigPath, databaseName, databaseId, databaseFile } = yield* getWranglerConfig(
    workspace,
    {
      database: subcommand.database,
    },
  )

  yield* Effect.logInfo('Reset database').pipe(
    Effect.annotateLogs({
      database: databaseName,
      databaseId,
      databaseFile,
    }),
  )

  const d1MigrationsInit = `
    CREATE TABLE IF NOT EXISTS d1_migrations(
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT UNIQUE,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    );
  `

  // Ensure directory exists before creating files
  const databaseDir = path.dirname(databaseFile)
  yield* shell`
    $ mkdir -p ${databaseDir}
  `

  // Remove database files if they exist (won't error if they don't)
  yield* shell`
    $ rm -f ${databaseFile} ${databaseFile}-wal ${databaseFile}-shm
  `.pipe(Effect.ignore)

  // Create the database file
  yield* shell`
    $ touch ${databaseFile}
  `

  const output = yield* shell`
    $ wrangler d1 execute ${databaseName} --local --persist-to=${persistRoot} --config=${wranglerConfigPath} --json --command="${d1MigrationsInit}"
  `

  if (output.stderr) {
    yield* Effect.logError('D1 reset failed', output.stderr)
  } else {
    yield* Effect.try(() => JSON.parse(output.stdout)).pipe(
      Effect.orDieWith(() => new Error('Failed to parse d1 output result')),
      Effect.andThen((result: any[]) => {
        const allSuccess = result.every((item) => item.success)

        if (allSuccess) {
          return Effect.logInfo('D1 reset success').pipe(Effect.annotateLogs({ ...result }))
        }

        return Effect.logError('D1 reset failed', result)
      }),
    )
  }
})

/**
 * Dump D1 database
 */
const dumpD1 = Effect.fn('dump-d1')(function* (
  workspace: Workspace.Workspace,
  subcommand: DatabaseDumpSubcommand,
): Effect.fn.Return<void, never, Path.Path | FileSystem.FileSystem | Scope.Scope> {
  const isProd = process.env.NODE_ENV === 'production'
  const path = yield* Path.Path
  const fs = yield* FileSystem.FileSystem
  const { wranglerConfigPath, databaseName, databaseFile } = yield* getWranglerConfig(workspace, {
    database: subcommand.database,
  })
  const { dbDir } = yield* detectDatabase(workspace, { databaseName: subcommand.database })
  const schemaOutput = path.join(dbDir, 'schema.sql')

  const formatSchema = fs.readFileString(schemaOutput).pipe(
    Effect.flatMap((content) =>
      fs.writeFileString(
        schemaOutput,
        content
          .replace(/create table sqlite_sequence\(name,seq\);/i, '')
          .replace(/create table _cf_KV[\s\S]*?\);/im, '')
          .replace(/create table _cf_METADATA[\s\S]*?\);/im, '')
          .replace(/\n{2,}/gm, '\n')
          .trim(),
      ),
    ),
    Effect.orDie,
  )

  if (isProd) {
    let args = `--config=${wranglerConfigPath} --no-data --remote`
    args += ` --output=${schemaOutput}`

    const output = yield* shell`
      $ wrangler d1 export ${databaseName} ${args}
    `

    if (output.stderr) {
      yield* Effect.logError('Failed to dump production schema', output.stderr)
    } else {
      yield* formatSchema

      yield* Effect.logInfo('Dump production schema done').pipe(Effect.annotateLogs('output', schemaOutput))
    }
  } else {
    yield* shell`
      $$ sqlite3 ${databaseFile} .schema > ${schemaOutput}
    `

    yield* formatSchema

    yield* Effect.logInfo('Dump local schema done').pipe(
      Effect.annotateLogs('file', databaseFile),
      Effect.annotateLogs('output', schemaOutput),
    )
  }
})

const applyD1Migrations = Effect.fn('apply-d1-migrations')(function* (
  workspace: Workspace.Workspace,
  {
    deploy = false,
    reset = false,
    database,
  }: {
    deploy?: boolean | undefined
    reset?: boolean | undefined
    database?: string | undefined
  } = { deploy: false },
): Effect.fn.Return<void, never, Path.Path | Scope.Scope> {
  const isPreview = deploy && process.env.STAGE !== 'production'
  const { persistRoot, wranglerConfigPath, databaseName, databaseId, previewDatabaseId } = yield* getWranglerConfig(
    workspace,
    { database },
  )

  let API_TOKEN = ''
  let ACCOUNT_ID = ''
  let deployArgs = ''

  if (!deploy) {
    deployArgs += ' --local'
    deployArgs += ` --persist-to=${persistRoot}`
  } else {
    const config = yield* CloudflareConfig.pipe(Effect.orDie)
    API_TOKEN = config.API_TOKEN
    ACCOUNT_ID = config.ACCOUNT_ID

    if (!isPreview) {
      deployArgs += ' --remote'
    } else {
      if (previewDatabaseId) {
        deployArgs += ' --preview'
      }

      deployArgs += ' --remote'
    }
  }

  yield* Effect.logInfo('D1 Apply migrations').pipe(
    Effect.annotateLogs({
      deployArgs,
      databaseName,
      databaseId,
      previewDatabaseId,
    }),
  )

  if (!deploy && reset) {
    yield* resetD1(workspace, { database })
  }

  yield* shell`
    $ export CLOUDFLARE_API_TOKEN="${API_TOKEN}"
    $ export CLOUDFLARE_ACCOUNT_ID="${ACCOUNT_ID}"
    $$ wrangler d1 migrations apply ${databaseName} --config=${wranglerConfigPath} ${deployArgs}
  `.pipe(
    Effect.retry({ times: 2, schedule: Schedule.spaced('5 seconds') }),
    Effect.tap(
      Effect.fnUntraced(function* (output) {
        if (output.stderr) {
          yield* Effect.logError('D1 apply migrations failed', output.stderr)
        } else {
          if (output.stdout.indexOf('No migrations to apply') > -1) {
            yield* Effect.logInfo('D1 apply migrations done')
          } else {
            yield* Effect.logInfo('D1 apply migrations done', output.stdout)
          }
        }
      }),
    ),
    Effect.withSpan('d1-migrate-apply'),
  )
})

const applyPrismaMigrations = Effect.fn('apply-prisma-migrations')(function* (
  _workspace: Workspace.Workspace,
  {
    dbDir,
    datasource,
    migrations,
    reset = false,
  }: {
    dbDir: string
    datasource: { url: string }
    migrations: Array<PrismaMigration>
    reset?: boolean | undefined
  },
) {
  const path = yield* Path.Path
  const fs = yield* FileSystem.FileSystem
  const lockFileContent = yield* fs.readFileString(path.join(dbDir, 'migration_lock.toml'), 'utf8')
  const schemaContext = yield* Effect.promise(() => loadSchemaContext({ schemaPath: { baseDir: dbDir }, cwd: dbDir }))

  const prismaFilter = { externalEnums: [], externalTables: [] }

  yield* Effect.acquireUseRelease(
    Effect.promise(() =>
      SchemaEngineCLI.setup({
        schemaContext,
        baseDir: dbDir,
        datasource: { url: datasource.url },
      }),
    ),
    (migrate) =>
      pipe(
        Effect.suspend(() => (reset ? Effect.promise(() => migrate.reset({ filter: prismaFilter })) : Effect.void)),
        Effect.andThen(
          Effect.promise(() => {
            const captureStdout = new CaptureStdout()
            captureStdout.startCapture()
            const output = migrate.applyMigrations({
              filters: prismaFilter,
              migrationsList: {
                baseDir: dbDir,
                lockfile: {
                  content: lockFileContent,
                  path: 'migration_lock.toml',
                },
                migrationDirectories: migrations.map((_) => {
                  return {
                    path: _.filepath,
                    migrationFile: {
                      path: 'migration.sql',
                      content: { tag: 'ok', value: _.content },
                    },
                  }
                }),
                shadowDbInitScript: '',
              },
            }) as Promise<{
              appliedMigrationNames: string[]
            }>

            return output.finally(() => captureStdout.stopCapture())
          }),
        ),
        Effect.tap((result) =>
          Effect.logInfo('Apply migrations done').pipe(Effect.annotateLogs('applied', result.appliedMigrationNames)),
        ),
      ),
    (migrate, exit) => {
      if (Exit.isFailure(exit)) {
        return Effect.try(() => migrate.stop()).pipe(Effect.tap(Effect.logError(exit.cause)), Effect.ignore)
      }
      return Effect.try(() => migrate.stop()).pipe(Effect.ignore)
    },
  )
})

// DB

export const seed = Effect.fn('db.seed')(function* (
  workspace: Workspace.Workspace,
  subcommand: DatabaseSeedSubcommand,
): Effect.fn.Return<void, SqlError.SqlError, FileSystem.FileSystem | Path.Path | Scope.Scope> {
  const path = yield* Path.Path
  const fs = yield* FileSystem.FileSystem
  const { dbDir, tsconfigPath, config } = yield* detectDatabase(workspace, {
    databaseName: subcommand.database,
  })

  const defaultSeedFile = path.join(dbDir, 'seed.ts')

  yield* fs.exists(defaultSeedFile).pipe(
    Effect.tap((exists) =>
      exists ? fs.writeFileString(defaultSeedFile, 'export const start = () => {}') : Effect.void,
    ),
    Effect.orDie,
  )

  const seedPath = subcommand.file ? path.resolve(dbDir, subcommand.file) : defaultSeedFile

  yield* fs.exists(seedPath).pipe(
    Effect.tap((exists) => (!exists ? Effect.dieMessage(`No seed file found: ${seedPath}`) : Effect.void)),
    Effect.orDie,
  )

  if (config.runtime === 'browser') {
    yield* Effect.logInfo('Skip seed in browser')
    return
  }

  const seed: SeedEntry = yield* Effect.promise(() =>
    tsImport(seedPath, { parentURL: import.meta.url, tsconfig: tsconfigPath }),
  ).pipe(
    Effect.withSpan('db.load-seed-file', {
      attributes: {
        projectName: workspace.projectName,
        seedPath,
        runtime: config.runtime,
      },
    }),
  )

  if (config.runtime === 'd1') {
    const { wranglerConfigPath, persistTo, databaseId } = yield* getWranglerConfig(workspace, {
      database: subcommand.database,
    })
    const { Miniflare } = yield* Effect.promise(() => import('miniflare'))
    const { config } = yield* parseConfig(wranglerConfigPath)

    yield* Effect.acquireUseRelease(
      Effect.gen(function* () {
        const miniflare = new Miniflare({
          script: '',
          modules: true,
          compatibilityDate: '2025-09-25',
          defaultPersistRoot: persistTo,
          cachePersist: path.join(persistTo, 'cache'),
          workflowsPersist: path.join(persistTo, 'workflows'),
          d1Persist: path.join(persistTo, 'd1'),
          d1Databases: Object.fromEntries(
            config.d1_databases.map((_) => {
              return [_.binding, _.database_id || '']
            }),
          ),
        })

        return miniflare
      }),
      Effect.fnUntraced(function* (miniflare) {
        yield* Effect.promise(() => miniflare.ready)

        const dbBinding = config.d1_databases.find((_) => _.database_id === databaseId)?.binding || 'DB'
        const DB = yield* Effect.promise(() => miniflare.getD1Database(dbBinding))

        const SeedLive = Layer.orDie(
          SqlD1.layer({
            db: DB,
            transformQueryNames: String.camelToSnake,
            transformResultNames: String.snakeToCamel,
          }),
        )

        if (!seed || !seed.start || !Effect.isEffect(seed.start)) {
          return yield* Effect.dieMessage('seed failed')
        }

        yield* seed.start.pipe(
          Effect.provide(SeedLive),
          Effect.withSpan('db.execute-d1-seed', {
            attributes: {
              projectName: workspace.projectName,
              database: subcommand.database || 'default',
              dbBinding,
              seedPath,
            },
          }),
        )
      }),
      (miniflare, exit) => {
        if (Exit.isFailure(exit)) {
          return Effect.promise(() => miniflare.dispose()).pipe(Effect.tap(Effect.logError(exit.cause)), Effect.ignore)
        }
        return Effect.promise(() => miniflare.dispose()).pipe(Effect.ignore)
      },
    )

    return
  } else if (config.runtime === 'server') {
    // TODO: implement
    return yield* Effect.dieMessage('Not support seed in server')
  }

  yield* Effect.logInfo('Seed database done')
  return
})

export const dump = Effect.fn('db.dump')(function* (
  workspace: Workspace.Workspace,
  subcommand: DatabaseDumpSubcommand,
) {
  const path = yield* Path.Path
  const fs = yield* FileSystem.FileSystem
  const { dbDir, config } = yield* detectDatabase(workspace, { databaseName: subcommand.database })

  if (config.runtime === 'd1') {
    yield* dumpD1(workspace, subcommand)
  } else if (config.runtime === 'browser' || config.runtime === 'server') {
    if (config.provider === 'sqlite') {
      const _formatSchema = Effect.gen(function* () {
        const content = yield* fs.readFileString(schemaOutput)

        yield* fs.writeFileString(
          schemaOutput,
          content
            .replace(/create table sqlite_sequence\(name,seq\);/i, '')
            .replace(/^create table if not exists "_prisma_migrations"[\s\S]*?\);/im, '')
            .replace(/\n{2,}/gm, '\n')
            .trim(),
        )
      })

      const localDevDbFile = path.join(dbDir, devDB)
      const schemaOutput = path.join(dbDir, 'schema.sql')

      const output = yield* shell`
        $ sqlite3 ${localDevDbFile} .schema
      `

      if (output.stderr) {
        return yield* Effect.logError('Failed to dump sqlite schema', output.stderr)
      }

      const currentFileContent = yield* fs.readFileString(schemaOutput, 'utf-8').pipe(
        Effect.orElseSucceed(() => ''),
        Effect.map((_) => _.replace(/--\s\d+/, '').replace('\n', '')),
      )

      const newFileContent = output.stdout
        .replace(/create table sqlite_sequence\(name,seq\);/i, '')
        .replace(/^create table if not exists "_prisma_migrations"[\s\S]*?\);/im, '')
        .replace(/\n{2,}/gm, '\n')
        .trim()

      if (currentFileContent === newFileContent) {
        yield* Effect.logInfo('No schema change')
      } else {
        yield* fs.writeFileString(schemaOutput, `-- ${getMigrationDate()}\n${newFileContent}`)

        yield* Effect.logInfo('Dump sqlite schema done').pipe(
          Effect.annotateLogs('file', localDevDbFile),
          Effect.annotateLogs('output', schemaOutput),
        )
      }
    } else {
      yield* Effect.logError('Not support database dump')
    }
  }

  yield* Effect.logInfo('Dump database schema done').pipe(Effect.annotateLogs('provider', config.provider))
})

export const push = Effect.fn('db.push')(function* (
  workspace: Workspace.Workspace,
  subcommand: DatabasePushSubcommand,
) {
  const path = yield* Path.Path
  const { config, tables, dbDir } = yield* detectDatabase(workspace, {
    databaseName: subcommand.database,
  })

  yield* syncPrismaSchema(workspace, { dbDir }, config, tables)

  const schemaContext = yield* Effect.promise(() => loadSchemaContext({ schemaPath: { baseDir: dbDir }, cwd: dbDir }))

  if (config.runtime === 'd1') {
    const { databaseFile } = yield* getWranglerConfig(workspace, {
      database: subcommand.database,
    })

    yield* resetD1(workspace, { database: subcommand.database })

    const from_: EngineArgs.MigrateDiffTarget = {
      tag: 'empty',
    }
    const to_: EngineArgs.MigrateDiffTarget = {
      tag: 'schemaDatamodel',
      files: schemaContext.schemaFiles.map((loadedFile) => {
        return {
          path: loadedFile[0],
          content: loadedFile[1],
        }
      }),
    }
    const d1DbPath = `file:${databaseFile}`
    const shadowDatabaseUrl = `file:${path.join(dbDir, devDB)}`

    const captureOutput = yield* Effect.acquireUseRelease(
      Effect.gen(function* () {
        const captureStdout = new CaptureStdout()
        const migrate = yield* Effect.promise(() =>
          SchemaEngineCLI.setup({
            schemaContext,
            baseDir: dbDir,
            datasource: {
              url: d1DbPath,
              shadowDatabaseUrl: shadowDatabaseUrl,
            },
          }),
        )
        captureStdout.startCapture()

        return { migrate, captureStdout }
      }),
      ({ migrate, captureStdout }) =>
        Effect.gen(function* () {
          yield* Effect.promise(() =>
            migrate.migrateDiff({
              from: from_,
              to: to_,
              script: true,
              exitCode: false,
              shadowDatabaseUrl,
              filters: {
                externalEnums: [],
                externalTables: [],
              },
            }),
          )
          const texts = captureStdout.getCapturedText()
          captureStdout.stopCapture()
          return texts
        }),
      ({ migrate, captureStdout }, exit) => {
        captureStdout.stopCapture()
        if (Exit.isFailure(exit)) {
          return Effect.try(() => migrate.stop()).pipe(Effect.tap(Effect.logError(exit.cause)), Effect.ignore)
        }

        return Effect.try(() => migrate.stop()).pipe(Effect.ignore)
      },
    )

    const ensureOutputs = captureOutput.filter((_: any) => {
      if (_.indexOf('empty migration') > -1) {
        return false
      }

      return true
    })

    if (ensureOutputs.length === 0) {
      yield* Effect.logInfo('No migrations diff')

      return
    }

    yield* pushD1(workspace, {
      sql: ensureOutputs.join('\n'),
      database: subcommand.database,
    })

    return
  } else {
    // browser/server
    const datasource =
      config.runtime === 'server'
        ? {
            url: config.url,
          }
        : {
            url: `file:${path.join(dbDir, devDB)}`,
          }
    const prismaFilter = { externalEnums: [], externalTables: [] }

    yield* Effect.acquireUseRelease(
      Effect.promise(() =>
        SchemaEngineCLI.setup({
          schemaContext,
          baseDir: dbDir,
          datasource,
        }),
      ),
      (migrate) =>
        pipe(
          Effect.tryPromise(() => migrate.reset({ filter: prismaFilter })),
          Effect.andThen(
            Effect.tryPromise(() => {
              const output = migrate.schemaPush({
                filters: prismaFilter,
                force: true,
                schema: {
                  files: schemaContext.schemaFiles.map((loadedFile) => {
                    return {
                      path: loadedFile[0],
                      content: loadedFile[1],
                    }
                  }),
                },
              })
              return output
            }),
          ),
          Effect.tap((result) =>
            Effect.logInfo('Force push done').pipe(
              Effect.annotateLogs({
                ...result,
              }),
            ),
          ),
        ),
      (migrate, exit) => {
        if (Exit.isFailure(exit)) {
          return Effect.try(() => migrate.stop()).pipe(Effect.tap(Effect.logError(exit.cause)), Effect.ignore)
        }
        return Effect.try(() => migrate.stop()).pipe(Effect.ignore)
      },
    )
  }

  yield* Effect.logInfo('Push database done')

  if (!subcommand.skipDump) {
    yield* dump(workspace, { ...subcommand, _tag: 'DatabaseDumpSubcommand' })
  }

  if (!subcommand.skipSeed) {
    yield* seed(workspace, {
      _tag: 'DatabaseSeedSubcommand',
      cwd: workspace.projectPath,
      database: subcommand.database,
      file: undefined,
    })
  }
})

export const execute = Effect.fn('db.execute')(function* (
  workspace: Workspace.Workspace,
  subcommand: DatabaseExecuteSubcommand,
) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const { config, dbDir } = yield* detectDatabase(workspace, { databaseName: subcommand.database })

  const schemaContext = yield* Effect.promise(() => loadSchemaContext({ schemaPath: { baseDir: dbDir }, cwd: dbDir }))

  if (config.runtime === 'd1') {
    const { persistRoot, wranglerConfigPath, databaseName } = yield* getWranglerConfig(workspace, {
      database: subcommand.database,
    })

    let args = `--local --persist-to=${persistRoot} --config=${wranglerConfigPath} --json`

    if (subcommand.sql) {
      args += ` --command="${subcommand.sql}`
    } else if (subcommand.file) {
      args += ` --file=${subcommand.file}`
    }

    const output = yield* shell`
      $ wrangler d1 execute ${databaseName} ${args}"
    `.pipe(
      Effect.withSpan('db.d1-execute', {
        attributes: {
          projectName: workspace.projectName,
          databaseName,
          sql: subcommand.sql,
          file: subcommand.file || 'none',
        },
      }),
    )

    if (output.stderr) {
      yield* Effect.logError('D1 execute failed', output.stderr)
    } else {
      yield* Effect.try({
        try: () => JSON.parse(output.stdout),
        catch(error) {
          return error as Error
        },
      }).pipe(
        Effect.andThen((result: any[]) => {
          const allSuccess = result.every((item) => item.success)

          if (allSuccess) {
            return Effect.logInfo('D1 execute success').pipe(Effect.annotateLogs({ ...result }))
          }

          return Effect.logError('D1 execute failed', result)
        }),
      )
    }
  } else {
    let executeScript = ''
    if (subcommand.sql) {
      executeScript = subcommand.sql
    } else if (subcommand.file) {
      const inputPath = path.isAbsolute(subcommand.file)
        ? subcommand.file
        : path.resolve(process.cwd(), subcommand.file)

      executeScript = yield* fs.readFileString(inputPath)
    }

    const datasourceType: EngineArgs.DbExecuteDatasourceType = {
      tag: 'schema',
      files: schemaContext.schemaFiles.map((loadedFile) => {
        return {
          path: loadedFile[0],
          content: loadedFile[1],
        }
      }),
      configDir: dbDir,
    }

    const datasource =
      config.runtime === 'server'
        ? {
            url: config.url,
          }
        : {
            url: `file:${path.join(dbDir, devDB)}`,
          }

    yield* Effect.acquireUseRelease(
      Effect.promise(() => SchemaEngineCLI.setup({ schemaContext, baseDir: dbDir, datasource })),
      (migrate) =>
        Effect.promise(() =>
          migrate.dbExecute({
            script: executeScript,
            datasourceType,
          }),
        ),
      (migrate, exit) => {
        console.log(exit)
        if (Exit.isFailure(exit)) {
          return Effect.try(() => migrate.stop()).pipe(Effect.tap(Effect.logError(exit.cause)), Effect.ignore)
        }

        return Effect.try(() => migrate.stop()).pipe(Effect.ignore)
      },
    )
  }

  yield* Effect.logInfo('Execute database done')
})

// Migrate

export const dev = Effect.fn('db.dev')(function* (
  workspace: Workspace.Workspace,
  subcommand: DatabaseMigrateDevSubcommand,
) {
  const path = yield* Path.Path
  const { config, tables, dbDir, migrationsDir } = yield* detectDatabase(workspace, {
    databaseName: subcommand.database,
  })
  const migrations = yield* getMigrations(migrationsDir)

  yield* syncPrismaSchema(workspace, { dbDir }, config, tables)

  const schemaContext = yield* Effect.promise(() => loadSchemaContext({ schemaPath: { baseDir: dbDir }, cwd: dbDir }))

  const localDevDb = `file:${path.join(dbDir, devDB)}`
  const localDevShadowDb = `file:${path.join(dbDir, 'shadow.db')}`

  // 全新的数据库
  let from_: EngineArgs.MigrateDiffTarget = {
    tag: 'empty',
  }

  if (migrations.length > 0) {
    // 从已有的 D1 sqlite 数据库迁移
    if (config.runtime === 'd1') {
      const { databaseFile } = yield* getWranglerConfig(workspace, {
        database: subcommand.database,
      })

      from_ = {
        tag: 'url',
        url: `file:${databaseFile}`,
      }
    } else if (config.runtime === 'browser') {
      // 如果是 Browser 则用使用 dev 数据库

      from_ = {
        tag: 'url',
        url: localDevDb,
      }
    } else if (config.runtime === 'server') {
      if (!config.url) {
        return yield* Effect.dieMessage('[From] Missing database url')
      }

      from_ = {
        tag: 'url',
        url: config.url,
      }
    }
  }

  // 用 schema.prisma 作为目标进行迁移
  const to_: EngineArgs.MigrateDiffTarget = {
    tag: 'schemaDatamodel',
    files: schemaContext.schemaFiles.map((loadedFile) => {
      return {
        path: loadedFile[0],
        content: loadedFile[1],
      }
    }),
  }

  const datasource = { url: from_.tag === 'empty' ? localDevDb : from_.url }

  const captureOutput = yield* Effect.acquireUseRelease(
    Effect.gen(function* () {
      const captureStdout = new CaptureStdout()
      const migrate = yield* Effect.promise(() =>
        SchemaEngineCLI.setup({
          schemaContext,
          baseDir: dbDir,
          datasource,
        }),
      )
      captureStdout.startCapture()

      return { migrate, captureStdout }
    }),
    ({ migrate, captureStdout }) =>
      Effect.gen(function* () {
        yield* Effect.promise(() =>
          migrate.migrateDiff({
            from: from_,
            to: to_,
            script: true,
            exitCode: false,
            shadowDatabaseUrl: localDevShadowDb,
            filters: {
              externalEnums: [],
              externalTables: [],
            },
          }),
        )
        const text = captureStdout.getCapturedText()
        captureStdout.stopCapture()
        return text
      }),
    ({ migrate }, exit) => {
      if (Exit.isFailure(exit)) {
        return Effect.try(() => migrate.stop()).pipe(Effect.tap(Effect.logError(exit.cause)), Effect.ignore)
      }

      return Effect.try(() => migrate.stop()).pipe(Effect.ignore)
    },
  )

  const ensuredOutputs = captureOutput
    ? captureOutput.filter((_: any) => {
        if (_.indexOf('empty migration') > -1) {
          return false
        }

        return true
      })
    : []

  /**
   * 没有新的迁移文件生成
   * 但是可能是在部署过程中所以还是需要继续执行，因为数据库可能没有应用迁移
   */
  if (ensuredOutputs.length === 0) {
    yield* Effect.logInfo('No migrations diff')
  } else {
    const isNativeMigration = config.runtime === 'browser' || config.runtime === 'server'

    const inputMigrationName = subcommand.migrationName
    const migrationName = formatMigrationName(inputMigrationName)
    const migrationDate = getMigrationDate()
    const outputFile = isNativeMigration
      ? path.join(`${migrationDate}_${migrationName}`, '/migration.sql')
      : `${migrationDate}_${migrationName}.sql`
    const outputMigrationFile = path.join(migrationsDir, outputFile)

    yield* Effect.logInfo('Generated migrations diff').pipe(Effect.annotateLogs('saveTo', outputMigrationFile))

    const fs = yield* FileSystem.FileSystem
    if (isNativeMigration) {
      const dir = path.join(migrationsDir, `${migrationDate}_${migrationName}`)
      yield* fs.makeDirectory(dir)
    }
    yield* fs.writeFileString(outputMigrationFile, ensuredOutputs.join('\n'))
  }

  yield* Effect.logInfo('Apply dev migrations').pipe(
    Effect.annotateLogs({
      runtime: config.runtime,
      provider: config.provider,
    }),
  )

  /**
   * Apply migrations
   */
  if (config.runtime === 'd1') {
    yield* applyD1Migrations(workspace, { database: subcommand.database })
  } else if (config.runtime === 'browser') {
    yield* applyPrismaMigrations(workspace, { datasource, dbDir, migrations })
  } else if (config.runtime === 'server') {
    const databaseUrl = config.url
    if (!databaseUrl) {
      return yield* Effect.dieMessage('Database url is required')
    }
    yield* applyPrismaMigrations(workspace, { datasource, dbDir, migrations })
  }

  yield* Effect.logInfo('Migrate database done')

  if (!subcommand.skipDump) {
    yield* dump(workspace, { ...subcommand, _tag: 'DatabaseDumpSubcommand' })
  }

  if (!subcommand.skipSeed) {
    yield* seed(workspace, {
      _tag: 'DatabaseSeedSubcommand',
      cwd: workspace.projectPath,
      database: subcommand.database,
      file: undefined,
    })
  }
})

export const reset = Effect.fn('db.reset')(function* (
  workspace: Workspace.Workspace,
  subcommand: DatabaseMigrateResetSubcommand,
) {
  const path = yield* Path.Path
  const { config, dbDir, migrationsDir } = yield* detectDatabase(workspace, {
    databaseName: subcommand.database,
  })
  const migrations = yield* getMigrations(migrationsDir)

  if (config.runtime === 'd1') {
    yield* applyD1Migrations(workspace, { database: subcommand.database, reset: true })
  } else if (config.runtime === 'browser') {
    const datasource = {
      url: `file:${path.join(dbDir, devDB)}`,
    }
    yield* applyPrismaMigrations(workspace, { dbDir, datasource, migrations, reset: true })
  } else if (config.runtime === 'server') {
    const datasource = {
      url: config.url,
    }
    yield* applyPrismaMigrations(workspace, { dbDir, datasource, migrations, reset: true })
  }

  yield* Effect.logInfo('Reset database done')

  if (!subcommand.skipSeed) {
    yield* seed(workspace, {
      _tag: 'DatabaseSeedSubcommand',
      cwd: workspace.projectPath,
      database: subcommand.database,
      file: undefined,
    })
  }
})

export const deploy = Effect.fn('db.deploy')(function* (
  workspace: Workspace.Workspace,
  subcommand: DatabaseMigrateDeploySubcommand,
) {
  const { config, migrationsDir, dbDir } = yield* detectDatabase(workspace, {
    databaseName: subcommand.database,
  })
  const migrations = yield* getMigrations(migrationsDir)

  if (migrations.length === 0) {
    return yield* Effect.logInfo('No migrations to deploy')
  }

  if (config.runtime === 'd1') {
    yield* applyD1Migrations(workspace, { database: subcommand.database, deploy: true })
  } else if (config.runtime === 'browser') {
    yield* Effect.logInfo('Skip browser database deploy')
  } else if (config.runtime === 'server') {
    const datasource = {
      url: config.url,
    }
    yield* applyPrismaMigrations(workspace, { dbDir, datasource, migrations })
  }

  yield* Effect.logInfo('Deploy database done')
})

export const resolve = Effect.fn('resolve')(function* (
  workspace: Workspace.Workspace,
  _subcommand: DatabaseMigrateResolveSubcommand,
) {
  const _path = yield* Path.Path

  yield* detectDatabase(workspace)
})
