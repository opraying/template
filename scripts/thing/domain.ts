import { Context, Data, Schema } from 'effect'
import { NodeEnv, Stage } from './core/env'
import { BuildReactRouterSchema, BuildReactRouterTarget } from './react-router/domain'

export { NodeEnv, Stage } from './core/env'

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

// ----- React Native -----

// ----- Database -----

// DB
// Email

// Test
