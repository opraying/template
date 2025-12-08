import { Data, Schema } from 'effect'

export const ReactNativeRunPlatform = Schema.Literal('ios', 'android')
export type ReactNativeRunPlatform = typeof ReactNativeRunPlatform.Type

export const ReactNativeBuildPlatform = Schema.Literal('ios', 'android', 'all')
export type ReactNativeBuildPlatform = typeof ReactNativeBuildPlatform.Type

export const ReactNativeExportPlatform = Schema.Literal('all', 'ios', 'android', 'web')
export type ReactNativeExportPlatform = typeof ReactNativeExportPlatform.Type

export interface ReactNativePrebuildSubcommand {
  readonly _tag: 'ReactNativePrebuildSubcommand'
  readonly cwd: string
  readonly platform: ReactNativeBuildPlatform
  readonly clean: boolean
  readonly install: boolean
}
export const ReactNativePrebuildSubcommand = Data.tagged<ReactNativePrebuildSubcommand>('ReactNativePrebuildSubcommand')

export interface ReactNativeBuildSubcommand {
  readonly _tag: 'ReactNativeBuildSubcommand'
  readonly cwd: string
  readonly platform: ReactNativeBuildPlatform
  readonly profile: string
  readonly local: boolean
  readonly json: boolean
  readonly wait: boolean
  readonly clearCache: boolean
  readonly message?: string | undefined
  readonly buildLoggerLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | undefined
  readonly freezeCredentials: boolean
  readonly output?: string | undefined
}
export const ReactNativeBuildSubcommand = Data.tagged<ReactNativeBuildSubcommand>('ReactNativeBuildSubcommand')

export interface ReactNativeRunSubcommand {
  readonly _tag: 'ReactNativeRunSubcommand'
  readonly cwd: string
  readonly platform: ReactNativeRunPlatform
  readonly device?: string | undefined
  readonly scheme?: string | undefined
  readonly xcodeConfiguration: string
  readonly variant: string
  readonly port: number
  readonly bundler: boolean
  readonly buildCache: boolean
  readonly clean: boolean
}
export const ReactNativeRunSubcommand = Data.tagged<ReactNativeRunSubcommand>('ReactNativeRunSubcommand')

export interface ReactNativeAnalyzeSubcommand {
  readonly _tag: 'ReactNativeAnalyzeSubcommand'
  readonly cwd: string
  readonly head?: string | undefined
  readonly base?: string | undefined
  readonly platform: ReactNativeBuildPlatform
  readonly minify: boolean
  readonly bytecode: boolean
}
export const ReactNativeAnalyzeSubcommand = Data.tagged<ReactNativeAnalyzeSubcommand>('ReactNativeAnalyzeSubcommand')

export interface ReactNativeDeployCheckSubcommand {
  readonly _tag: 'ReactNativeDeployCheckSubcommand'
  readonly cwd: string
  readonly base?: string | undefined
  readonly head?: string | undefined
  readonly platform: ReactNativeBuildPlatform
}
export const ReactNativeDeployCheckSubcommand = Data.tagged<ReactNativeDeployCheckSubcommand>(
  'ReactNativeDeployCheckSubcommand',
)

export interface ReactNativeDeployJsUpdateSubcommand {
  readonly _tag: 'ReactNativeJsUpdateSubcommand'
  readonly cwd: string
  readonly env: string
  readonly base?: string | undefined
  readonly head?: string | undefined
  readonly channel?: string | undefined
  readonly platform: ReactNativeBuildPlatform
  readonly message?: string | undefined
  readonly dryRun: boolean
  readonly force: boolean
  readonly targetVersion?: string | undefined
}
export const ReactNativeDeployJsUpdateSubcommand = Data.tagged<ReactNativeDeployJsUpdateSubcommand>(
  'ReactNativeJsUpdateSubcommand',
)

export interface ReactNativeDeploySubmitSubcommand {
  readonly _tag: 'ReactNativeDeploySubmitSubcommand'
  readonly cwd: string
  readonly platform: ReactNativeRunPlatform
  readonly profile?: string | undefined
  readonly path?: string | undefined
  readonly buildId?: string | undefined
  readonly latest: boolean
  readonly nonInteractive: boolean
  readonly wait: boolean
  readonly json: boolean
  readonly verbose: boolean
}
export const ReactNativeDeploySubmitSubcommand = Data.tagged<ReactNativeDeploySubmitSubcommand>(
  'ReactNativeDeploySubmitSubcommand',
)
