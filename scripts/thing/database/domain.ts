import { Data } from 'effect'

export interface DatabaseSeedSubcommand {
  readonly _tag: 'DatabaseSeedSubcommand'
  readonly cwd: string
  readonly database: string | undefined
  readonly file: string | undefined
}
export const DatabaseSeedSubcommand = Data.tagged<DatabaseSeedSubcommand>('DatabaseSeedSubcommand')

export interface DatabasePushSubcommand {
  readonly _tag: 'DatabasePushSubcommand'
  readonly cwd: string
  readonly database: string | undefined
  readonly skipSeed: boolean
  readonly skipDump: boolean
}
export const DatabasePushSubcommand = Data.tagged<DatabasePushSubcommand>('DatabasePushSubcommand')

export interface DatabaseDumpSubcommand {
  readonly _tag: 'DatabaseDumpSubcommand'
  readonly cwd: string
  readonly database: string | undefined
}
export const DatabaseDumpSubcommand = Data.tagged<DatabaseDumpSubcommand>('DatabaseDumpSubcommand')

export interface DatabaseExecuteSubcommand {
  readonly _tag: 'DatabaseExecuteSubcommand'
  readonly cwd: string
  readonly sql: string | undefined
  readonly file: string | undefined
  readonly database: string | undefined
}
export const DatabaseExecuteSubcommand = Data.tagged<DatabaseExecuteSubcommand>('DatabaseExecuteSubcommand')

// Migrate
export interface DatabaseMigrateDevSubcommand {
  readonly _tag: 'DatabaseMigrateDevSubcommand'
  readonly cwd: string
  readonly database: string | undefined
  readonly migrationName: string
  readonly skipSeed: boolean
  readonly skipDump: boolean
}
export const DatabaseMigrateDevSubcommand = Data.tagged<DatabaseMigrateDevSubcommand>('DatabaseMigrateDevSubcommand')

export interface DatabaseMigrateResetSubcommand {
  readonly _tag: 'DatabaseMigrateResetSubcommand'
  readonly cwd: string
  readonly database: string | undefined
  readonly skipSeed: boolean
}
export const DatabaseMigrateResetSubcommand = Data.tagged<DatabaseMigrateResetSubcommand>(
  'DatabaseMigrateResetSubcommand',
)

export interface DatabaseMigrateDeploySubcommand {
  readonly _tag: 'DatabaseMigrateDeploySubcommand'
  readonly cwd: string
  readonly database: string | undefined
}
export const DatabaseMigrateDeploySubcommand = Data.tagged<DatabaseMigrateDeploySubcommand>(
  'DatabaseMigrateDeploySubcommand',
)

export interface DatabaseMigrateResolveSubcommand {
  readonly _tag: 'DatabaseMigrateResolveSubcommand'
  readonly cwd: string
  readonly database: string | undefined
}
export const DatabaseMigrateResolveSubcommand = Data.tagged<DatabaseMigrateResolveSubcommand>(
  'DatabaseMigrateResolveSubcommand',
)
