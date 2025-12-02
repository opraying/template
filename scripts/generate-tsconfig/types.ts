export type ProjectItemKind = 'library' | 'application'

export interface AliasDefinition {
  /** Alias name, e.g. "@xstack/lib" */
  name: string
  /** Relative path from workspace root */
  path: string
  /** Allow import without subpath (no trailing /*) */
  allowIndex?: boolean | undefined
}

export interface ProjectItemOptions {
  baseConfigPath?: string | undefined
  checkIncludes?: string[] | undefined
  checkExcludes?: string[] | undefined
  isPackage?: boolean | undefined
  projectOverrides?:
    | {
        main?: any
        app?: any
        lib?: any
        test?: any
        check?: any
      }
    | undefined
}

export interface ProjectItemDeclaration {
  name: string
  kind: ProjectItemKind
  options?: ProjectItemOptions | undefined | undefined
}

export interface ProjectAliasOptions {
  siblings?: boolean | undefined
  ui?: boolean | undefined
  map?: ((paths: Record<string, string[]>) => Record<string, string[]>) | undefined
}

export interface ProjectBaseTarget {
  name: string
  alias?: ProjectAliasOptions | undefined
}

export interface ProjectDefinition {
  projectName: string
  items: ProjectItemDeclaration[]
  baseTargets?: ProjectBaseTarget[] | undefined
}

export interface TsconfigManifest {
  aliases: AliasDefinition[]
  projects: ProjectDefinition[]
}

export const LEVEL0_BASE_PATH = './tsconfig.base.json'
export const LEVEL1_BASE_PATH = '../tsconfig.base.json'
export const LEVEL2_BASE_PATH = '../../tsconfig.base.json'
export const LEVEL3_BASE_PATH = '../../../tsconfig.base.json'

export const tsLib = (name: string, options?: ProjectItemOptions | undefined): ProjectItemDeclaration => ({
  kind: 'library',
  name,
  options,
})

export const tsApp = (name: string, options?: ProjectItemOptions | undefined): ProjectItemDeclaration => ({
  kind: 'application',
  name,
  options,
})
