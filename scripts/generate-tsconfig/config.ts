import * as path from 'node:path'
import { ALIAS_DEFINITIONS } from '../../project-manifest'
import {
  type AliasDefinition,
  type ProjectAliasOptions,
  type ProjectDefinition,
  type ProjectItemDeclaration,
} from './types'

// root tsconfig.json
export const DefaultRootConfig = {
  // $schema: 'https://json.schemastore.org/tsconfig',
  extends: './tsconfig.base.json',
  compilerOptions: {
    types: ['node'],
  },
  include: ['./scripts/**/*.ts', './scripts/**/*.tsx', './scratchpad/**/*.ts', './scratchpad/**/*.tsx'],
  exclude: ['node_modules', 'dist', 'build', 'infra', 'packages', 'apps', 'template'],
}

// tsconfig.app.json
export const DefaultTsAppConfig = {
  // $schema: 'https://json.schemastore.org/tsconfig',
  extends: './tsconfig.json',
  compilerOptions: {
    types: ['vite/client'],
    outDir: '../../dist/out-tsc',
  },
  include: ['**/*.ts', '**/*.tsx'],
  exclude: ['node_modules', 'dist', 'build', 'e2e/**/*', 'tests/**/*'],
}

// tsconfig.lib.json (for packages)
export const DefaultTsLibConfig = {
  // $schema: 'https://json.schemastore.org/tsconfig',
  extends: './tsconfig.json',
  compilerOptions: {
    outDir: '../../dist/out-tsc',
  },
  include: ['src/**/*.ts', 'src/**/*.tsx'],
  exclude: ['node_modules', 'dist', 'build', 'e2e/**/*', 'tests/**/*'],
}

// tsconfig.test.json
export const DefaultTsTestConfig = {
  // $schema: 'https://json.schemastore.org/tsconfig',
  extends: './tsconfig.json',
  compilerOptions: {
    types: ['vite/client'],
    outDir: '../../dist/out-tsc',
  },
  include: ['**/*.d.ts', 'vite.config.ts', 'e2e/**/*.ts', 'e2e/**/*.tsx', 'tests/**/*.ts', 'tests/**/*.tsx'],
  exclude: ['node_modules', 'dist', 'build'],
}

// tsconfig.check.json
export const DefaultTsCheckConfig = {
  // $schema: 'https://json.schemastore.org/tsconfig',
  extends: './tsconfig.json',
  compilerOptions: {
    types: ['vite/client'],
  },
  include: ['**/*.ts', '**/*.tsx'],
  exclude: ['node_modules', 'dist', 'build'],
}

function getExtendsPath(item: ProjectItemDeclaration): string {
  return item.options?.baseConfigPath ?? '../shared/tsconfig.base.json'
}

export function buildSiblingIncludes(
  currentItem: ProjectItemDeclaration,
  allItems: ProjectItemDeclaration[],
): string[] {
  let siblings = allItems
    .filter((item) => item.name !== currentItem.name)
    .map((item) => item.name)
    .sort()

  const includes = currentItem.options?.checkIncludes
  if (includes) {
    siblings = siblings.filter((sibling) => includes.includes(sibling))
  }

  const excludes = currentItem.options?.checkExcludes
  if (excludes && excludes.length > 0) {
    siblings = siblings.filter((sibling) => !excludes.includes(sibling))
  }

  return siblings.flatMap((sibling) => [`../${sibling}/**/*.ts`, `../${sibling}/**/*.tsx`])
}

export interface ProjectComputationOptions {
  workspaceRoot: string
  baseConfig: Record<string, any>
}

type TsPathAliasMap = Record<string, string[]>

function createTsPathAliases(definitions: AliasDefinition[]): TsPathAliasMap {
  const paths: TsPathAliasMap = {}

  for (const def of definitions) {
    paths[`${def.name}/*`] = [`./${def.path}/*`]

    if (def.allowIndex) {
      paths[def.name] = [`./${def.path}/`]
    }
  }

  return paths
}

export function applyAliasPathsToBaseConfig<T extends { compilerOptions?: Record<string, any> }>(
  baseConfig: T,
  definitions: AliasDefinition[],
): T {
  return {
    ...baseConfig,
    compilerOptions: {
      ...baseConfig.compilerOptions,
      paths: createTsPathAliases(definitions),
    },
  }
}

interface ProjectAliasTarget {
  kind: 'library' | 'application'
  projectName: string
  name: string
  alias?: ProjectAliasOptions | undefined
  definition: ProjectDefinition
  options?: ProjectItemDeclaration['options'] | undefined
  item: ProjectItemDeclaration
}

function buildProjectAliasTargets(definitions: ProjectDefinition[]): Map<string, ProjectAliasTarget> {
  const targets = new Map<string, ProjectAliasTarget>()

  for (const definition of definitions) {
    for (const target of definition.items) {
      const projectName = definition.projectName + '/' + target.name
      const targetConfig = definition.baseTargets?.find((_) => _.name === target.name)

      targets.set(projectName, {
        kind: target.kind,
        projectName,
        name: target.name,
        alias: targetConfig?.alias,
        definition,
        options: target.options,
        item: target,
      })
    }
  }

  return targets
}

function normalizeRelativePath(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, '/')
  if (normalized.startsWith('.')) {
    return normalized
  }
  return `./${normalized}`
}

export function calculateRelativePath(from: string, to: string): string {
  const relative = path.relative(from, to)
  return normalizeRelativePath(relative)
}

function buildGlobalAliasPaths({
  workspaceRoot,
  projectRoot,
  baseCompilerPaths,
}: {
  workspaceRoot: string
  projectRoot: string
  baseCompilerPaths: TsPathAliasMap
}): TsPathAliasMap {
  const result: TsPathAliasMap = {}

  for (const [alias, values] of Object.entries(baseCompilerPaths)) {
    result[alias] = values.map((value) => {
      const absolutePath = path.resolve(workspaceRoot, value)
      let relativePath = path.relative(projectRoot, absolutePath).replace(/\\/g, '/')
      if (!relativePath.startsWith('.')) {
        relativePath = `./${relativePath}`
      }
      if (value.endsWith('/') && !relativePath.endsWith('/')) {
        relativePath += '/'
      }
      return relativePath
    })
  }

  return result
}

function addSiblingAliases(items: ProjectItemDeclaration[], paths: TsPathAliasMap): TsPathAliasMap {
  const siblingPaths: TsPathAliasMap = { ...paths }

  const rejectList = new Set(['web', 'native'])
  const frontendAppPaths: string[] = []

  for (const item of items) {
    if (item.kind === 'application' && rejectList.has(item.name)) {
      frontendAppPaths.push(`../${item.name}/*`)
      continue
    }
    siblingPaths[`@${item.name}/*`] = [`../${item.name}/*`]
  }

  if (frontendAppPaths.length > 0) {
    siblingPaths['@/*'] = frontendAppPaths
  }

  return siblingPaths
}

function buildProjectAliasPaths({
  workspaceRoot,
  projectName,
  baseCompilerPaths,
  items,
  aliasOptions,
}: {
  workspaceRoot: string
  projectName: string
  baseCompilerPaths: TsPathAliasMap
  items: ProjectItemDeclaration[]
  aliasOptions?: ProjectAliasOptions | undefined
}): TsPathAliasMap {
  const projectRoot = path.join(workspaceRoot, projectName)
  const globalPaths = buildGlobalAliasPaths({
    workspaceRoot,
    projectRoot,
    baseCompilerPaths,
  })

  const options: Required<ProjectAliasOptions> = {
    siblings: true,
    ui: true,
    map: (value) => value,
    ...aliasOptions,
  }

  if (!options.ui) {
    delete globalPaths['@/lib/*']
    delete globalPaths['@/components/ui/*']
  }

  let finalPaths: TsPathAliasMap = { ...globalPaths }

  if (options.siblings) {
    finalPaths = addSiblingAliases(items, finalPaths)
  }

  const mapped = options.map ? options.map(finalPaths) : finalPaths
  return mapped
}

export function mergeConfigs(base: any, override: any): any {
  if (!override) {
    return base
  }

  const result = { ...base }

  for (const [key, value] of Object.entries(override)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = mergeConfigs(result[key] || {}, value)
    } else {
      result[key] = value
    }
  }

  return result
}

export function buildProjectBaseTsconfig({
  workspaceRoot,
  projectName,
  baseConfig,
  items,
  aliasOptions,
}: {
  workspaceRoot: string
  projectName: string
  baseConfig: Record<string, any>
  items: ProjectItemDeclaration[]
  aliasOptions?: ProjectAliasOptions | undefined
}): Record<string, any> {
  const extendsPath = calculateRelativePath(
    path.join(workspaceRoot, projectName),
    path.join(workspaceRoot, 'tsconfig.base.json'),
  )
  const compilerPaths = buildProjectAliasPaths({
    workspaceRoot,
    projectName,
    baseCompilerPaths: (baseConfig.compilerOptions?.paths ?? {}) as TsPathAliasMap,
    items,
    aliasOptions,
  })

  const config = {
    extends: extendsPath,
    compilerOptions: {
      paths: compilerPaths,
    },
  }

  return config
}

export function generatePackageLibraryConfigs({ item }: { item: ProjectItemDeclaration }) {
  const extendsPath = getExtendsPath(item)

  const mainConfig = {
    extends: extendsPath,
    references: [{ path: './tsconfig.lib.json' }, { path: './tsconfig.test.json' }],
    include: [],
    files: [],
  }

  const overrides = item.options?.projectOverrides ?? {}

  const main = mergeConfigs(mainConfig, overrides.main || {})
  const lib = mergeConfigs(DefaultTsLibConfig, overrides.lib || {})
  const test = mergeConfigs(DefaultTsTestConfig, overrides.test || {})
  const checkConfig = {
    ...DefaultTsCheckConfig,
    extends: extendsPath,
  }
  const check = mergeConfigs(checkConfig, overrides.check || {})

  return {
    main,
    lib,
    test,
    check,
  }
}

export function generateAppLibraryConfigs({ item }: { item: ProjectItemDeclaration }) {
  const extendsPath = getExtendsPath(item)

  const mainConfig = {
    extends: extendsPath,
    references: [{ path: './tsconfig.app.json' }, { path: './tsconfig.test.json' }],
    include: [],
    files: [],
  }

  const overrides = item.options?.projectOverrides ?? {}

  const main = mergeConfigs(mainConfig, overrides.main || {})
  const app = mergeConfigs(DefaultTsAppConfig, overrides.app || {})
  const test = mergeConfigs(DefaultTsTestConfig, overrides.test || {})

  return { main, app, test }
}

export function generateAppConfigs({
  item,
  allItems,
}: {
  item: ProjectItemDeclaration
  allItems: ProjectItemDeclaration[]
}) {
  const extendsPath = getExtendsPath(item)

  const mainConfig = {
    extends: extendsPath,
    references: [{ path: './tsconfig.app.json' }, { path: './tsconfig.test.json' }],
    include: [],
    files: [],
  }

  const overrides = item.options?.projectOverrides ?? {}

  const main = mergeConfigs(mainConfig, overrides.main || {})
  const app = mergeConfigs(DefaultTsAppConfig, overrides.app || {})
  const test = mergeConfigs(DefaultTsTestConfig, overrides.test || {})

  const siblingIncludes = buildSiblingIncludes(item, allItems)
  const checkConfig = {
    ...DefaultTsCheckConfig,
    extends: extendsPath,
    include: [...siblingIncludes, '**/*.ts', '**/*.tsx'],
  }
  const check = mergeConfigs(checkConfig, overrides.check || {})

  return {
    main,
    app,
    test,
    check,
  }
}

export function getProjectTsconfig(baseConfig: any, projects: ProjectDefinition[], projectName: string) {
  const targets = buildProjectAliasTargets(projects)
  const target = targets.get(projectName)
  if (!target) {
    throw new Error(`Unknown project: ${projectName}`)
  }

  const base = applyAliasPathsToBaseConfig(baseConfig, ALIAS_DEFINITIONS)

  const obj = { base }

  if (target.options?.isPackage) {
    const configs = generatePackageLibraryConfigs({ item: target.item })
    Object.assign(obj, configs)
  } else {
    if (target.kind === 'library') {
      const configs = generateAppLibraryConfigs({ item: target.item })
      Object.assign(obj, configs)
    } else {
      const configs = generateAppConfigs({
        item: target.item,
        allItems: target.definition.items,
      })
      Object.assign(obj, configs)
    }
  }

  // for (const item of target.definition.baseTargets ?? []) {
  //   const projectName = target.definition.projectName + '/' + item.name
  //   const targetItems = target.definition.items

  //   const config = buildProjectBaseTsconfig({
  //     workspaceRoot: path.join(workspaceRoot, projectName),
  //     projectName,
  //     baseConfig: base,
  //     items: targetItems,
  //     aliasOptions: item.alias,
  //   })
  // }

  console.log(obj)
}
