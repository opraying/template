export type Platform = 'linux' | 'macos' | 'windows'

export interface CiProjectMetaSummary {
  name?: string | undefined
  root?: string | undefined
  tags?: string[] | undefined
  projectType?: string | undefined
}

export interface CiDetectionContext {
  base?: string | undefined
  head?: string | undefined
  changedFiles: string[]
  affectedProjects: string[]
  projectMeta: Record<string, CiProjectMetaSummary>
  surfaces?: unknown | undefined
}

export interface StageContext {
  ci: CiDetectionContext
  [key: string]: unknown
}

export interface SurfaceSelector {
  projects?: string[] | undefined
  tagsAll?: string[] | undefined
  tagsAny?: string[] | undefined
  projectTypes?: string[] | undefined
}

export interface StageSurfaceConfig {
  selectors?: SurfaceSelector[] | undefined
  defaultToAffected?: boolean
}

export interface StageStep {
  name: string
  command: string
  args?: string[] | ((context: StageContext) => string[]) | undefined
  cwd?: string | ((context: StageContext) => string | undefined) | undefined
  env?: Record<string, string> | ((context: StageContext) => Record<string, string>) | undefined
  platforms?: Platform[] | undefined
}

export interface StageDefinition {
  description: string
  steps: StageStep[]
  prepare?: ((context: StageContext) => void) | undefined
  requiredEnv?: string[] | undefined
  supportedPlatforms?: Platform[] | undefined
  surface?: StageSurfaceConfig
}
