import { Command } from '@effect/cli'
import { Effect } from 'effect'
import {
  dbCwdOption,
  dbDatabaseOption,
  dbFileOption,
  dbMigrationNameOption,
  dbSkipDumpOption,
  dbSkipSeedOption,
  dbSqlOption,
} from './options'
import {
  DatabaseDumpSubcommand,
  DatabaseExecuteSubcommand,
  DatabaseMigrateDeploySubcommand,
  DatabaseMigrateDevSubcommand,
  DatabaseMigrateResetSubcommand,
  DatabaseMigrateResolveSubcommand,
  DatabasePushSubcommand,
  DatabaseSeedSubcommand,
} from './domain'
import * as Database from './subcommand'
import * as Workspace from '../workspace'
import type { Workspace as WorkspaceModel } from '../workspace'

const withWorkspace = <R, E>(cwd: string, f: (workspace: WorkspaceModel) => Effect.Effect<void, E, R>) =>
  Effect.gen(function* () {
    const workspace = yield* Workspace.make(cwd)
    return yield* f(workspace)
  })

const seedCommand = Command.make(
  'seed',
  { cwd: dbCwdOption, database: dbDatabaseOption, file: dbFileOption },
  (config) =>
    withWorkspace(config.cwd, (workspace) =>
      Database.seed(
        workspace,
        DatabaseSeedSubcommand({
          cwd: config.cwd,
          database: config.database,
          file: config.file,
        }),
      ),
    ),
)

const pushCommand = Command.make(
  'push',
  {
    cwd: dbCwdOption,
    database: dbDatabaseOption,
    skipSeed: dbSkipSeedOption,
    skipDump: dbSkipDumpOption,
  },
  (config) =>
    withWorkspace(config.cwd, (workspace) =>
      Database.push(
        workspace,
        DatabasePushSubcommand({
          cwd: config.cwd,
          database: config.database,
          skipSeed: config.skipSeed,
          skipDump: config.skipDump,
        }),
      ),
    ),
)

const dumpCommand = Command.make('dump', { cwd: dbCwdOption, database: dbDatabaseOption }, (config) =>
  withWorkspace(config.cwd, (workspace) =>
    Database.dump(
      workspace,
      DatabaseDumpSubcommand({
        cwd: config.cwd,
        database: config.database,
      }),
    ),
  ),
)

const executeCommand = Command.make(
  'execute',
  { cwd: dbCwdOption, database: dbDatabaseOption, sql: dbSqlOption, file: dbFileOption },
  (config) =>
    Effect.flatMap(
      config.sql || config.file
        ? Effect.succeed(undefined)
        : Effect.dieMessage('Provide either --sql or --file for db execute'),
      () =>
        withWorkspace(config.cwd, (workspace) =>
          Database.execute(
            workspace,
            DatabaseExecuteSubcommand({
              cwd: config.cwd,
              database: config.database,
              sql: config.sql,
              file: config.file,
            }),
          ),
        ),
    ),
)

const migrateDevCommand = Command.make(
  'dev',
  {
    cwd: dbCwdOption,
    database: dbDatabaseOption,
    skipSeed: dbSkipSeedOption,
    skipDump: dbSkipDumpOption,
    migrationName: dbMigrationNameOption,
  },
  (config) =>
    withWorkspace(config.cwd, (workspace) =>
      Database.dev(
        workspace,
        DatabaseMigrateDevSubcommand({
          cwd: config.cwd,
          database: config.database,
          skipSeed: config.skipSeed,
          skipDump: config.skipDump,
          migrationName: config.migrationName,
        }),
      ),
    ),
)

const migrateResetCommand = Command.make(
  'reset',
  { cwd: dbCwdOption, database: dbDatabaseOption, skipSeed: dbSkipSeedOption },
  (config) =>
    withWorkspace(config.cwd, (workspace) =>
      Database.reset(
        workspace,
        DatabaseMigrateResetSubcommand({
          cwd: config.cwd,
          database: config.database,
          skipSeed: config.skipSeed,
        }),
      ),
    ),
)

const migrateDeployCommand = Command.make('deploy', { cwd: dbCwdOption, database: dbDatabaseOption }, (config) =>
  withWorkspace(config.cwd, (workspace) =>
    Database.deploy(
      workspace,
      DatabaseMigrateDeploySubcommand({
        cwd: config.cwd,
        database: config.database,
      }),
    ),
  ),
)

const migrateResolveCommand = Command.make('resolve', { cwd: dbCwdOption, database: dbDatabaseOption }, (config) =>
  withWorkspace(config.cwd, (workspace) =>
    Database.resolve(
      workspace,
      DatabaseMigrateResolveSubcommand({
        cwd: config.cwd,
        database: config.database,
      }),
    ),
  ),
)

const migrateCommand = Command.make('migrate').pipe(
  Command.withSubcommands([migrateDevCommand, migrateResetCommand, migrateDeployCommand, migrateResolveCommand]),
)

const databaseCommand = Command.make('db').pipe(
  Command.withSubcommands([seedCommand, pushCommand, dumpCommand, executeCommand, migrateCommand]),
)

export { databaseCommand }
