import { existsSync, statSync } from 'node:fs'
import * as path from 'node:path'
import { parse } from 'tsconfck'

type AliasRecord = Record<string, string>

interface ProjectInfo {
  projectRoot: string
  tsconfigPath: string
}

interface PathCandidate {
  normalized: string
  absolute: string
}

const aliasCache = new Map<string, Promise<AliasRecord>>()

type AliasResolutionKind = 'path-missing' | 'tsconfig-missing' | 'tsconfig-adjacent-missing'

class AliasResolutionError extends Error {
  public readonly kind: AliasResolutionKind
  constructor(kind: AliasResolutionKind, message: string) {
    super(message)
    this.kind = kind
    this.name = 'AliasResolutionError'
  }
}

function resolveProjectInfo(projectPath: string): ProjectInfo {
  const resolvedPath = path.resolve(projectPath)

  if (!existsSync(resolvedPath)) {
    throw new AliasResolutionError('path-missing', `Path not found: ${resolvedPath}`)
  }

  const stat = statSync(resolvedPath)

  if (stat.isDirectory()) {
    const tsconfigPath = path.join(resolvedPath, 'tsconfig.json')
    if (!existsSync(tsconfigPath)) {
      throw new AliasResolutionError('tsconfig-missing', `Unable to locate tsconfig.json inside ${resolvedPath}`)
    }
    return { projectRoot: resolvedPath, tsconfigPath }
  }

  const directory = path.dirname(resolvedPath)
  const isTsconfigFile = path.basename(resolvedPath).startsWith('tsconfig') && resolvedPath.endsWith('.json')
  const tsconfigPath = isTsconfigFile ? resolvedPath : path.join(directory, 'tsconfig.json')

  if (!existsSync(tsconfigPath)) {
    throw new AliasResolutionError(
      'tsconfig-adjacent-missing',
      `Unable to locate tsconfig.json next to ${resolvedPath}`,
    )
  }

  return { projectRoot: directory, tsconfigPath }
}

function normalizeAliasKey(key: string): string {
  if (key.endsWith('/*')) {
    return key.slice(0, -2)
  }
  if (key.endsWith('*')) {
    return key.slice(0, -1)
  }
  return key
}

function normalizeTargetPath(target: string): string {
  if (target.endsWith('/*')) {
    return target.slice(0, -2)
  }
  if (target.endsWith('*')) {
    return target.slice(0, -1)
  }
  return target
}

function isInside(child: string, parent: string): boolean {
  const relative = path.relative(parent, child)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

function pickPreferredTarget(targets: string[], baseDir: string, projectRoot: string): string | undefined {
  const candidates: PathCandidate[] = targets.map((target) => {
    const normalized = normalizeTargetPath(target)
    return {
      normalized,
      absolute: path.resolve(baseDir, normalized),
    }
  })

  const insideProject = candidates.find((candidate) => isInside(candidate.absolute, projectRoot))
  if (insideProject) {
    return insideProject.absolute
  }

  const existing = candidates.find((candidate) => existsSync(candidate.absolute))
  if (existing) {
    return existing.absolute
  }

  return candidates[0]?.absolute
}

async function collectAliasFromTsconfig(project: ProjectInfo): Promise<AliasRecord> {
  const result = await parse(project.tsconfigPath)
  const chain =
    result.extended && result.extended.length > 0
      ? result.extended
      : [{ tsconfigFile: result.tsconfigFile, tsconfig: result.tsconfig }]

  const entries = new Map<string, string>()

  for (const configEntry of [...chain].reverse()) {
    const paths = configEntry.tsconfig.compilerOptions?.paths
    if (!paths) {
      continue
    }

    const configDir = path.dirname(configEntry.tsconfigFile)

    for (const [aliasKey, targetPaths] of Object.entries(paths)) {
      if (!Array.isArray(targetPaths) || targetPaths.length === 0) {
        continue
      }

      const normalizedAlias = normalizeAliasKey(aliasKey)
      const replacement = pickPreferredTarget(targetPaths, configDir, project.projectRoot)

      if (!replacement) {
        continue
      }

      entries.set(normalizedAlias, replacement)
    }
  }

  return Object.fromEntries(entries)
}

const buildProjects = async (project: ProjectInfo): Promise<AliasRecord> => {
  return collectAliasFromTsconfig(project)
}

export const getProjectAlias = (projectPath: string): Promise<AliasRecord> => {
  try {
    const projectInfo = resolveProjectInfo(projectPath)
    const cacheKey = projectInfo.tsconfigPath

    if (!aliasCache.has(cacheKey)) {
      aliasCache.set(cacheKey, buildProjects(projectInfo))
    }

    return aliasCache.get(cacheKey)!
  } catch (error) {
    if (error instanceof AliasResolutionError) {
      if (
        error.kind === 'path-missing' ||
        error.kind === 'tsconfig-missing' ||
        error.kind === 'tsconfig-adjacent-missing'
      ) {
        console.info(`[alias] No tsconfig found for ${projectPath}, returning empty alias map.`)
        return Promise.resolve({})
      }
    }
    console.error(`Error fetching project alias for ${projectPath}:`, error)
    return Promise.resolve({})
  }
}
