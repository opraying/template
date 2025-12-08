import { Options } from '@effect/cli'

const dbCwdOption = Options.text('cwd').pipe(
  Options.withDescription('Workspace-relative path to the project with db/ folder'),
)

const dbDatabaseOption = Options.text('database').pipe(
  Options.withDescription('Optional database name from wrangler.jsonc'),
  Options.withDefault(undefined),
)

const dbFileOption = Options.text('file').pipe(
  Options.withDescription('Relative path to a file used by the command (seed or SQL script)'),
  Options.withDefault(undefined),
)

const dbSqlOption = Options.text('sql').pipe(
  Options.withDescription('Inline SQL command to execute'),
  Options.withDefault(undefined),
)

const dbSkipSeedOption = Options.boolean('skip-seed').pipe(
  Options.withDescription('Skip running seeds after push operations'),
  Options.withDefault(false),
)

const dbSkipDumpOption = Options.boolean('skip-dump').pipe(
  Options.withDescription('Skip writing Prisma schema dumps after push operations'),
  Options.withDefault(false),
)

const dbMigrationNameOption = Options.text('migration-name').pipe(
  Options.withDescription('Name to use for newly generated migrations'),
  Options.withDefault('migration'),
)

export {
  dbCwdOption,
  dbDatabaseOption,
  dbMigrationNameOption,
  dbFileOption,
  dbSkipDumpOption,
  dbSkipSeedOption,
  dbSqlOption,
}
