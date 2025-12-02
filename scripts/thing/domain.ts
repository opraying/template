import { Context, Data, type LogLevel, Schema } from 'effect'

export const Stage = Schema.Literal('production', 'staging', 'test')
export type Stage = typeof Stage.Type

export const NodeEnv = Schema.Literal('development', 'production')
export type NodeEnv = typeof NodeEnv.Type

export const BuildReactRouterSchema = Schema.Struct({
  _tag: Schema.Literal('BuildReactRouter'),
  /**
   * Workers
   * /client 静态资源部署到 Pages 上
   * /server 静态资源部署到 Workers 上
   *
   * Pages
   * /client 全部部署到 Pages 上
   */
  runtime: Schema.Literal('cloudflare-workers'),
  options: Schema.Struct({
    isSpaMode: Schema.Boolean,
    isDesktop: Schema.Boolean,
  }),
  stage: Stage,
})
export interface BuildReactRouterTarget extends Schema.Schema.Type<typeof BuildReactRouterSchema> {}
export const BuildReactRouterTarget = Data.tagged<BuildReactRouterTarget>('BuildReactRouter')

export const BuildWorkersSchema = Schema.Struct({
  _tag: Schema.Literal('BuildWorkers'),
  /**
   * 将服务部署到 Workers 上
   */
  runtime: Schema.Literal('cloudflare-workers'),
  options: Schema.Struct({}),
  stage: Stage,
})
export interface BuildWorkersTarget extends Schema.Schema.Type<typeof BuildWorkersSchema> {}
export const BuildWorkersTarget = Data.tagged<BuildWorkersTarget>('BuildWorkers')

export type BuildTarget = BuildReactRouterTarget | BuildWorkersTarget

export type BuildProvider = BuildTarget

export const TargetSchema = Schema.Union(BuildReactRouterSchema, BuildWorkersSchema)
export type TargetSchema = typeof TargetSchema.Type

export interface BuildReactRouterParameters {
  readonly nodeEnv: NodeEnv
  readonly target: BuildReactRouterTarget
  readonly env: Record<string, any>
}
export const BuildReactRouterParameters = Context.GenericTag<BuildReactRouterParameters>(
  '@thing:build-react-router-parameters',
)

export interface BuildWorkersParameters {
  readonly nodeEnv: NodeEnv
  readonly target: BuildWorkersTarget
  readonly env: Record<string, any>
}
export const BuildWorkersParameters = Context.GenericTag<BuildWorkersParameters>('@thing:build-workers-parameters')

// ----- Serve -----

export interface ServeSubcommand {
  readonly _tag: 'ServeSubcommand'
  readonly cwd: string
  readonly target: BuildTarget
  readonly verbose: boolean
}

export const ServeSubcommand = Data.tagged<ServeSubcommand>('ServeSubcommand')

// ----- Build -----

export interface BuildSubcommand {
  readonly _tag: 'BuildSubcommand'
  readonly cwd: string
  readonly target: BuildTarget
  readonly stage: Stage
  readonly nodeEnv: NodeEnv
  readonly minify: boolean
  readonly analyze: boolean
  readonly verbose: boolean
}
export const BuildSubcommand = Data.tagged<BuildSubcommand>('BuildSubcommand')

// ----- Deploy -----

export interface DeploySubcommand {
  readonly _tag: 'DeploySubcommand'
  readonly cwd: string
  readonly verbose: boolean
}
export const DeploySubcommand = Data.tagged<DeploySubcommand>('DeploySubcommand')

// ----- Preview -----

export interface PreviewSubcommand {
  readonly _tag: 'PreviewSubcommand'
  readonly cwd: string
  readonly verbose: boolean
}

export const PreviewSubcommand = Data.tagged<PreviewSubcommand>('PreviewSubcommand')

// ----- Database -----

// DB
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
  readonly sql: string
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

// Email

export interface EmailBuildSubcommand {
  readonly _tag: 'EmailBuildSubcommand'
  readonly cwd: string
}
export const EmailBuildSubcommand = Data.tagged<EmailBuildSubcommand>('EmailBuildSubcommand')

export interface EmailDeploySubcommand {
  readonly _tag: 'EmailDeploySubcommand'
  readonly cwd: string
  readonly stage: Stage
}
export const EmailDeploySubcommand = Data.tagged<EmailDeploySubcommand>('EmailDeploySubcommand')

// Test

export interface TestSubcommand {
  readonly _tag: 'TestSubcommand'

  readonly project: string
  readonly all: boolean
  readonly mode: 'unit' | 'e2e' | 'browser'
  readonly watch: boolean
  readonly headless: boolean
  readonly browser: 'chromium' | 'firefox' | 'webkit' | 'all'
}
export const TestSubcommand = Data.tagged<TestSubcommand>('TestSubcommand')
