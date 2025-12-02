import { FileSystem, Path } from '@effect/platform'
import type { SqlError } from '@effect/sql'
import * as SqlD1 from '@effect/sql-d1/D1Client'
import { formatSchema, loadSchemaContext } from '@prisma/internals'
import type { EngineArgs } from '@prisma/migrate'
import { Migrate } from '@prisma/migrate'
import { Effect, Exit, Layer, Schedule, String } from 'effect'
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
} from '../domain'
import { shell, shellInPath } from '../utils'
import type * as Workspace from '../workspace'
import { CaptureStdout } from './capture-stdout'
import { formatMigrationName } from './utils'

interface DatabaseConfig {
  provider: PrismaGenerateOptions['provider']
  url?: PrismaGenerateOptions['url'] | undefined
  runtime: 'd1' | 'browser' | 'server'
}

type SeedEntry = {
  start: Effect.Effect<void, SqlError.SqlError, never>
}

const devDB = 'dev.db'

// https://vscode.dev/github/prisma/prisma-engines/blob/main/schema-engine/connectors/schema-connector/src/migrations_directory.rs#L30
// "%Y%m%d%H%M%S"
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

export const existDatabase = Effect.fn('db.exist-database')(function* (workspace: Workspace.Workspace) {
  yield* Effect.annotateCurrentSpan({
    projectName: workspace.projectName,
  })

  const path = yield* Path.Path
  const fs = yield* FileSystem.FileSystem

  const dbDir = path.join(workspace.projectPath, 'db')

  const migrationsDir = path.join(dbDir, 'migrations')

  return yield* fs.exists(migrationsDir)
}, Effect.orDie)

const detectDatabase = Effect.fn('db.detect-database')(function* (
  workspace: Workspace.Workspace,
  { databaseName }: { databaseName?: string } = {},
) {
  yield* Effect.annotateCurrentSpan({
    projectName: workspace.projectName,
    databaseName,
  })

  const path = yield* Path.Path
  const fs = yield* FileSystem.FileSystem

  const dbDir = path.join(workspace.projectPath, 'db')

  const migrationsDir = path.join(dbDir, 'migrations')
  if (!(yield* fs.exists(migrationsDir))) {
    yield* fs.makeDirectory(migrationsDir)
  }

  const tsconfig = path.join(workspace.projectPath, 'tsconfig.app.json')
  const tablesPath = path.join(dbDir, 'tables.ts')

  const { tables, config } = yield* Effect.promise(() =>
    tsImport(tablesPath, { parentURL: import.meta.url, tsconfig }),
  ).pipe(
    Effect.map((_) => {
      const config = _.config as DatabaseConfig

      config.url = config.url || `"file:./${devDB}"`

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
    tsconfig,
  }
})

const wranglerConfig = Effect.fn('wrangler.get-config')(function* (
  workspace: Workspace.Workspace,
  { database }: { database?: string | undefined } = {},
) {
  const path = yield* Path.Path
  const wranglerConfigPath = path.join(workspace.projectPath, 'wrangler.jsonc')
  const fallbackConfigPath = path.join(workspace.projectRoot, '/web/wrangler.jsonc')

  const { config: wranglerConfig, path: foundWranglerConfigPath } = yield* parseConfig(
    [wranglerConfigPath, fallbackConfigPath],
    process.env.NODE_ENV,
    process.env.STAGE,
  )

  const selectedDatabaseName = database || wranglerConfig.d1_databases[0].database_name
  const selectedDatabase = wranglerConfig.d1_databases.find((_) => _.database_name === selectedDatabaseName)

  if (!selectedDatabaseName) {
    return yield* Effect.dieMessage('No database name provided')
  }

  const databaseNameId = yield* databaseNameToId(wranglerConfig, selectedDatabaseName)
  const previewDatabaseId = selectedDatabase?.preview_database_id
  const databaseId = selectedDatabase?.database_id

  const persistRoot = path.join(workspace.root, '.wrangler/state')
  const persistTo = path.join(workspace.root, '.wrangler/state/v3')
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

const getMigrations = Effect.fn('db.get-migrations')(function* (dir: string) {
  const fs = yield* FileSystem.FileSystem

  if (!(yield* fs.exists(dir))) {
    yield* fs.makeDirectory(dir)
  }

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
  )

  return migrations
})

const syncPrismaSchema = Effect.fn('prisma.sync-schema')(function* (
  workspace: Workspace.Workspace,
  { dbDir }: { dbDir: string },
  config: DatabaseConfig,
  tables: TablesRecord<any>,
) {
  const path = yield* Path.Path
  const fs = yield* FileSystem.FileSystem

  const url = config.url

  if (config.runtime === 'server' && !config.url) {
    return yield* Effect.dieMessage('Missing database url')
  }

  const generated = yield* Effect.try({
    try: () =>
      generate(
        {
          provider: config.provider,

          url: url!,
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
    catch: (error) => new Error('Failed to generate prisma schema', { cause: error }),
  }).pipe(
    // format prisma schema
    Effect.andThen((content) =>
      formatSchema(
        {
          schemas: [['schema.prisma', content]],
        },
        {
          insertSpaces: true,
          tabSize: 2,
        },
      ),
    ),
    Effect.map((result) => result[0][1]),
  )
  const prismaPath = path.join(dbDir, 'schema.prisma')
  yield* fs.writeFileString(prismaPath, generated)

  const prismaBin = path.join(workspace.root, 'node_modules/.bin/prisma')

  yield* shellInPath(dbDir)`
    $ ${prismaBin} generate
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
 * Only Dev Mode
 * Push changes to D1 database
 */
const d1Push = Effect.fn('d1-push')(function* (
  workspace: Workspace.Workspace,
  { sql, database }: { sql: string; database?: string | undefined },
) {
  const { persistRoot, wranglerConfigPath, databaseName } = yield* wranglerConfig(workspace, { database })

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
    yield* Effect.try({
      try: () => JSON.parse(output.stdout),
      catch(error) {
        return error as Error
      },
    }).pipe(
      Effect.andThen((result: any[]) => {
        const allSuccess = result.every((item) => item.success)

        if (allSuccess) {
          return Effect.logInfo('D1 push success').pipe(Effect.annotateLogs({ ...result }))
        }

        return Effect.logError('D1 push failed', result)
      }),
    )
  }
})

const d1ApplyMigrations = Effect.fn('d1-apply-migrations')(function* (
  workspace: Workspace.Workspace,
  { deploy = false, database }: { deploy?: boolean; database?: string | undefined } = { deploy: false },
) {
  const isPreview = deploy && process.env.STAGE !== 'production'
  const { persistRoot, wranglerConfigPath, databaseName, databaseId, previewDatabaseId } = yield* wranglerConfig(
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

const d1Reset = Effect.fn('d1-reset')(function* (
  workspace: Workspace.Workspace,
  subcommand: { database: string | undefined },
) {
  const { persistRoot, wranglerConfigPath, databaseName, databaseId, databaseFile } = yield* wranglerConfig(workspace, {
    database: subcommand.database,
  })

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
    );`

  const output = yield* shell`
    $ rm -f ${databaseFile} ${databaseFile}-wal ${databaseFile}-shm
    $ touch ${databaseFile}
    $ wrangler d1 execute ${databaseName} --local --persist-to=${persistRoot} --config=${wranglerConfigPath} --json --command="${d1MigrationsInit}"
  `

  if (output.stderr) {
    yield* Effect.logError('D1 reset failed', output.stderr)
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
          return Effect.logInfo('D1 reset success').pipe(Effect.annotateLogs({ ...result }))
        }

        return Effect.logError('D1 reset failed', result)
      }),
    )
  }
})

const d1Dump = Effect.fn('d1-dump')(function* (workspace: Workspace.Workspace, subcommand: DatabaseDumpSubcommand) {
  const isProd = process.env.NODE_ENV === 'production'
  const path = yield* Path.Path
  const fs = yield* FileSystem.FileSystem
  const { wranglerConfigPath, databaseName, databaseFile } = yield* wranglerConfig(workspace, {
    database: subcommand.database,
  })
  const dbDir = path.join(workspace.projectPath, 'db')
  const schemaOutput = path.join(dbDir, 'schema.sql')

  const formatSchema = Effect.gen(function* () {
    const content = yield* fs.readFileString(schemaOutput)

    yield* fs.writeFileString(
      schemaOutput,
      content
        .replace(/create table sqlite_sequence\(name,seq\);/i, '')
        .replace(/create table _cf_KV[\s\S]*?\);/im, '')
        .replace(/create table _cf_METADATA[\s\S]*?\);/im, '')
        .replace(/\n{2,}/gm, '\n')
        .trim(),
    )
  })

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

const prismaApplyMigrations = Effect.fn('prisma.apply-migrations')(function* (
  _workspace: Workspace.Workspace,
  { dbDir }: { dbDir: string },
  { reset = false }: { reset?: boolean } = { reset: false },
) {
  const path = yield* Path.Path
  const prismaSchemaPath = path.join(dbDir, 'schema.prisma')

  const schemaContext = yield* Effect.promise(() =>
    loadSchemaContext({
      schemaPathFromConfig: prismaSchemaPath,
    }),
  )

  yield* Effect.acquireUseRelease(
    Effect.promise(() => Migrate.setup({ schemaContext, configDir: dbDir, schemaEngineConfig: {} })),
    (migrate) =>
      Effect.suspend(() => (reset ? Effect.promise(() => migrate.reset()) : Effect.void)).pipe(
        Effect.andThen(
          Effect.promise(() => {
            const captureStdout = new CaptureStdout()
            captureStdout.startCapture()
            const output = migrate.applyMigrations() as Promise<{
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
) {
  const path = yield* Path.Path
  const fs = yield* FileSystem.FileSystem
  const { dbDir, tsconfig, config } = yield* detectDatabase(workspace)

  // default seed file
  const defaultSeedFile = path.join(dbDir, 'seed.ts')

  if (!(yield* fs.exists(defaultSeedFile))) {
    yield* fs.writeFileString(defaultSeedFile, 'export const start = () => {}')
  }

  const seedPath = subcommand.file ? path.resolve(dbDir, subcommand.file) : defaultSeedFile
  const seedExists = yield* fs.exists(seedPath)

  if (!seedExists) {
    yield* Effect.logInfo('No seed file found').pipe(Effect.annotateLogs('file', seedPath))
    return
  }

  if (config.runtime === 'browser') {
    yield* Effect.logInfo('Skip seed in browser')
    return
  }

  const seed: SeedEntry = yield* Effect.promise(() =>
    tsImport(seedPath, { parentURL: import.meta.url, tsconfig }),
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
    const { wranglerConfigPath, persistTo, databaseId } = yield* wranglerConfig(workspace, {
      database: subcommand.database,
    })
    const { Miniflare } = yield* Effect.promise(() => import('miniflare'))
    const { config } = yield* parseConfig(wranglerConfigPath)

    const dev = new Miniflare({
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

    yield* Effect.promise(() => dev.ready)
    const dbBinding = config.d1_databases.find((_) => _.database_id === databaseId)?.binding || 'DB'
    const DB = yield* Effect.promise(() => dev.getD1Database(dbBinding))

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
      Effect.acquireRelease(() => Effect.promise(() => dev.dispose())),
      Effect.withSpan('db.execute-d1-seed', {
        attributes: {
          projectName: workspace.projectName,
          database: subcommand.database || 'default',
          dbBinding,
          seedPath,
        },
      }),
    )
  } else if (config.runtime === 'server') {
    // TODO: implement
    return yield* Effect.dieMessage('Not support seed in server')
  }

  yield* Effect.logInfo('Seed database done')
})

export const dump = Effect.fn('db.dump')(function* (
  workspace: Workspace.Workspace,
  subcommand: DatabaseDumpSubcommand,
) {
  const path = yield* Path.Path
  const fs = yield* FileSystem.FileSystem
  const { dbDir, config } = yield* detectDatabase(workspace)

  if (config.runtime === 'browser' || config.runtime === 'server') {
    if (config.provider === 'sqlite') {
      // sqlite export
      if (!config.url) {
        return yield* Effect.dieMessage('Missing database url')
      }

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

      // "file:./xxx.db"
      const dbUrl = config.url.replace('file:', '').replaceAll(`"`, '')
      const dbFile = path.join(dbDir, dbUrl)
      const schemaOutput = path.join(dbDir, 'schema.sql')

      const output = yield* shell`
        $ sqlite3 ${dbFile} .schema
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
          Effect.annotateLogs('file', dbFile),
          Effect.annotateLogs('output', schemaOutput),
        )
      }
    } else {
      yield* Effect.logError('Not support database dump')
    }
  } else if (config.runtime === 'd1') {
    yield* d1Dump(workspace, subcommand)
  }

  yield* Effect.logInfo('Dump database schema done').pipe(Effect.annotateLogs('provider', config.provider))
})

export const push = Effect.fn('db.push')(function* (
  workspace: Workspace.Workspace,
  subcommand: DatabasePushSubcommand,
) {
  const { config, tables, dbDir } = yield* detectDatabase(workspace)
  const { prismaPath, prisma } = yield* syncPrismaSchema(workspace, { dbDir }, config, tables)

  const schemaContext = yield* Effect.promise(() =>
    loadSchemaContext({
      schemaPathFromConfig: prismaPath,
    }),
  )

  if (config.runtime === 'd1') {
    yield* d1Reset(workspace, { database: subcommand.database })

    const from_: EngineArgs.MigrateDiffTarget = {
      tag: 'empty',
    }
    const to_: EngineArgs.MigrateDiffTarget = {
      tag: 'schemaDatamodel',
      files: [
        {
          path: prismaPath,
          content: prisma,
        },
      ],
    }

    const captureStdout = new CaptureStdout()
    captureStdout.startCapture()
    let captureOutput: any
    yield* Effect.acquireUseRelease(
      Effect.promise(() => Migrate.setup({ schemaContext, configDir: dbDir, schemaEngineConfig: {} })),
      (migrate) =>
        Effect.promise(() =>
          migrate.engine.migrateDiff({
            from: from_,
            to: to_,
            script: true,
            exitCode: false,
            shadowDatabaseUrl: `./${devDB}`,
            filters: {
              externalEnums: [],
              externalTables: [],
            },
          }),
        ),
      (migrate, exit) => {
        if (Exit.isFailure(exit)) {
          return Effect.try(() => migrate.stop()).pipe(
            Effect.tap(Effect.logError(exit.cause)),
            Effect.ignore,
            Effect.tap(() => {
              captureStdout.stopCapture()
            }),
          )
        }

        return Effect.try(() => migrate.stop()).pipe(
          Effect.tap(() => {
            const text = captureStdout.getCapturedText()
            captureStdout.stopCapture()

            if (!text) {
              return Effect.dieMessage('Failed to migrate diff database')
            }

            captureOutput = text
          }),
          Effect.ignore,
        )
      },
    )

    const ensureOutputs = captureOutput
      ? captureOutput.filter((_: any) => {
          if (_.indexOf('empty migration') > -1) {
            return false
          }

          return true
        })
      : []

    if (ensureOutputs.length === 0) {
      yield* Effect.logInfo('No migrations diff')

      return
    }

    yield* d1Push(workspace, {
      sql: ensureOutputs.join('\n'),
      database: subcommand.database,
    })
  } else {
    /**
     * - 重置数据库
     * - Push （用最新的 schema.prisma 对比 Empty State 生成迁移并执行，不会产生 migration 记录）
     */
    yield* Effect.acquireUseRelease(
      Effect.promise(() => Migrate.setup({ schemaContext, configDir: dbDir, schemaEngineConfig: {} })),
      (migrate) =>
        Effect.tryPromise(() => migrate.reset()).pipe(
          Effect.andThen(
            Effect.tryPromise(() => {
              const output = migrate.push({ force: true }) as Promise<{
                executedSteps: number
                warnings: string[]
                unexecutable: string[]
              }>

              return output
            }),
          ),
          Effect.tap((result) => Effect.logInfo('Force push done').pipe(Effect.annotateLogs(result))),
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
  const { config } = yield* detectDatabase(workspace)
  const dbDir = path.join(workspace.projectPath, 'db')
  const prismaPath = path.join(workspace.projectPath, dbDir, 'schema.prisma')
  const prisma = yield* fs.readFileString(prismaPath)

  const schemaContext = yield* Effect.promise(() =>
    loadSchemaContext({
      schemaPathFromConfig: prismaPath,
    }),
  )

  if (config.runtime === 'd1') {
    const { persistRoot, wranglerConfigPath, databaseName } = yield* wranglerConfig(workspace, {
      database: subcommand.database,
    })

    let args = `--local --persist-to=${persistRoot} --config=${wranglerConfigPath} --json`
    if (subcommand.file) {
      args += ` --file=${subcommand.file}`
    }
    if (subcommand.sql) {
      args += ` --command="${subcommand}`
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
  } else if (config.runtime === 'browser') {
    yield* Effect.logInfo('Skip browser database execute')
  } else if (config.runtime === 'server') {
    // TODO: more test
    let script = ''
    if (subcommand.sql) {
      script = subcommand.sql
    }
    if (subcommand.file) {
      const inputPath = path.isAbsolute(subcommand.file)
        ? subcommand.file
        : path.resolve(process.cwd(), subcommand.file)

      script = yield* fs.readFileString(inputPath)
    }

    const datasourceType: EngineArgs.DbExecuteDatasourceType = {
      tag: 'schema',
      files: [{ path: prismaPath, content: prisma }],
      configDir: path.dirname(prismaPath),
    }

    yield* Effect.acquireUseRelease(
      Effect.promise(() => Migrate.setup({ schemaContext, configDir: dbDir, schemaEngineConfig: {} })),
      (migrate) =>
        Effect.promise(() =>
          migrate.engine.dbExecute({
            script,
            datasourceType,
          }),
        ),
      (migrate, exit) => {
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
  const { config, tables, dbDir, migrationsDir } = yield* detectDatabase(workspace)
  const { prisma, prismaPath } = yield* syncPrismaSchema(workspace, { dbDir }, config, tables)
  const migrations = yield* getMigrations(migrationsDir)

  const schemaContext = yield* Effect.promise(() =>
    loadSchemaContext({
      schemaPathFromConfig: prismaPath,
    }),
  )

  // 从什么地方开始迁移
  let from_: EngineArgs.MigrateDiffTarget = {
    tag: 'empty',
  }

  // 全新的数据库
  if (migrations.length === 0) {
    from_ = {
      tag: 'empty',
    }
  } else {
    // 从已有的 D1 sqlite 数据库迁移
    if (config.runtime === 'd1') {
      const { databaseFile } = yield* wranglerConfig(workspace, {
        database: subcommand.database,
      })

      from_ = {
        tag: 'url',
        url: `file:${databaseFile}`,
      }
    } else if (config.runtime === 'browser') {
      // 如果是 Browser 则用不到本地数据库默认 dev 数据库
      const localDBUrl = config.url ? config.url.replace('file:', '').replaceAll(`"`, '') : devDB
      const db = path.join(dbDir, localDBUrl)

      from_ = {
        tag: 'url',
        url: `file:${db}`,
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
    files: [
      {
        path: prismaPath,
        content: prisma,
      },
    ],
  }

  const captureStdout = new CaptureStdout()
  captureStdout.startCapture()
  let captureOutput: any

  yield* Effect.acquireUseRelease(
    Effect.promise(() => Migrate.setup({ schemaContext, configDir: dbDir, schemaEngineConfig: {} })),
    (migrate) =>
      Effect.promise(() =>
        migrate.engine.migrateDiff({
          from: from_,
          to: to_,
          script: true,
          exitCode: false,
          shadowDatabaseUrl: `./${devDB}`,
          filters: {
            externalEnums: [],
            externalTables: [],
          },
        }),
      ),
    (migrate, exit) => {
      if (Exit.isFailure(exit)) {
        return Effect.try(() => migrate.stop()).pipe(
          Effect.tap(Effect.logError(exit.cause)),
          Effect.ignore,
          Effect.tap(() => {
            const text = captureStdout.getCapturedText()
            captureStdout.stopCapture()

            if (!text) {
              return Effect.dieMessage('Failed to migrate diff database')
            }
          }),
        )
      }

      return Effect.try(() => migrate.stop()).pipe(
        Effect.ignore,
        Effect.map(() => {
          const text = captureStdout.getCapturedText()
          captureStdout.stopCapture()
          captureOutput = text

          return text
        }),
      )
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
    yield* d1ApplyMigrations(workspace, { database: subcommand.database })
  } else if (config.runtime === 'browser') {
    yield* prismaApplyMigrations(workspace, { dbDir })
  } else if (config.runtime === 'server') {
    const databaseUrl = config.url
    if (!databaseUrl) {
      return yield* Effect.dieMessage('Database url is required')
    }
    yield* prismaApplyMigrations(workspace, { dbDir })
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
  const { config, dbDir } = yield* detectDatabase(workspace)

  if (config.runtime === 'd1') {
    yield* d1Reset(workspace, { database: subcommand.database })
    yield* d1ApplyMigrations(workspace, { database: subcommand.database })
  } else if (config.runtime === 'browser') {
    yield* prismaApplyMigrations(workspace, { dbDir }, { reset: true })
  } else if (config.runtime === 'server') {
    yield* prismaApplyMigrations(workspace, { dbDir }, { reset: true })
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
  const { config, migrationsDir, dbDir } = yield* detectDatabase(workspace)

  const migrations = yield* getMigrations(migrationsDir)

  if (migrations.length === 0) {
    return yield* Effect.logInfo('No migrations to deploy')
  }

  if (config.runtime === 'd1') {
    yield* d1ApplyMigrations(workspace, {
      deploy: true,
      database: subcommand.database,
    })
  } else if (config.runtime === 'browser') {
    yield* Effect.logInfo('Skip browser database deploy')
  } else if (config.runtime === 'server') {
    yield* prismaApplyMigrations(workspace, { dbDir })
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
