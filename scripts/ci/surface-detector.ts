import { STAGES } from './stages'
import type { StageSurfaceConfig, SurfaceSelector } from './types'
import { git, nx } from './utils'

export type SurfaceName = string

export interface SurfaceResult {
  name: SurfaceName
  impacted: boolean
  matches: string[]
  description?: string
}

export interface SurfaceDetectionOptions {
  surfaces?: SurfaceName[]
  base?: string
  head?: string
}

export interface SurfaceDetectionPayload {
  base: string
  head: string
  changedFiles: string[]
  affectedProjects: string[]
  results: SurfaceResult[]
  projectMeta: Record<string, ProjectMeta>
}

type SurfaceConfig = StageSurfaceConfig & { description?: string }

export const SURFACE_DEFINITIONS: Record<SurfaceName, SurfaceConfig> = Object.fromEntries(
  Object.entries(STAGES)
    .filter(([, stage]) => stage.surface)
    .map(([name, stage]) => [
      name,
      {
        description: stage.description,
        selectors: stage.surface?.selectors ?? [],
        defaultToAffected: stage.surface?.defaultToAffected,
      },
    ]),
)

export function getSurfaceNames() {
  return Object.keys(SURFACE_DEFINITIONS)
}

export function detectSurfaces(options: SurfaceDetectionOptions = {}): SurfaceDetectionPayload {
  const available = getSurfaceNames()
  const surfacesToCheck = (options.surfaces?.length ? options.surfaces : available).map((name) => {
    if (!SURFACE_DEFINITIONS[name]) {
      throw new Error(`Unknown surface "${name}". Available surfaces: ${available.join(', ')}`)
    }
    return name
  })
  const head = resolveHead(options.head)
  const base = resolveBase(head, options.base)
  const changedFiles = collectChangedFiles(base, head)
  const affectedRaw = nx(['show', 'projects', '--affected', `--base=${base}`, `--head=${head}`, '--json'])
  const affectedProjects = JSON.parse(affectedRaw) as string[]
  const projectMeta = loadProjectMeta(affectedProjects)
  const results = surfacesToCheck.map((name) =>
    evaluateSurface(name, SURFACE_DEFINITIONS[name], affectedProjects, projectMeta, affectedProjects.length),
  )
  return {
    base,
    head,
    changedFiles,
    affectedProjects,
    results,
    projectMeta: Object.fromEntries(projectMeta.entries()),
  }
}

function resolveHead(headOverride?: string) {
  if (headOverride) return headOverride
  if (process.env.NX_HEAD) return process.env.NX_HEAD
  return git(['rev-parse', 'HEAD'])
}

function resolveBase(head: string, baseOverride?: string) {
  if (baseOverride) return baseOverride
  if (process.env.NX_BASE) return process.env.NX_BASE
  const mainBranch = process.env.NX_MAIN_BRANCH ?? 'main'
  const candidates = [
    () => git(['merge-base', `origin/${mainBranch}`, head]),
    () => git(['merge-base', mainBranch, head]),
    () => git(['rev-parse', `${head}^`]),
  ]
  for (const candidate of candidates) {
    try {
      const base = candidate()
      if (base) return base
    } catch {
      // ignore
    }
  }
  return git(['rev-parse', head])
}

function collectChangedFiles(base: string, head: string) {
  const sets: Array<Set<string>> = []
  const committed = git(['diff', '--name-only', `${base}...${head}`])
  sets.push(new Set(commitmentToArray(committed)))
  try {
    const staged = git(['diff', '--name-only', '--cached'])
    sets.push(new Set(commitmentToArray(staged)))
  } catch {
    // ignore
  }
  try {
    const working = git(['diff', '--name-only'])
    sets.push(new Set(commitmentToArray(working)))
  } catch {
    // ignore
  }
  try {
    const untracked = git(['ls-files', '--others', '--exclude-standard'])
    sets.push(new Set(commitmentToArray(untracked)))
  } catch {
    // ignore
  }
  const merged = new Set<string>()
  for (const set of sets) {
    for (const file of set) {
      if (file) merged.add(file)
    }
  }
  return Array.from(merged).sort()
}

function commitmentToArray(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

export interface ProjectMeta {
  name: string
  root: string
  tags: string[]
  projectType?: string
}

function loadProjectMeta(projectNames: string[]): Map<string, ProjectMeta> {
  const map = new Map<string, ProjectMeta>()
  for (const project of projectNames) {
    const raw = nx(['show', 'project', project, '--json'])
    const parsed = JSON.parse(raw)
    map.set(project, {
      name: parsed.name,
      root: parsed.root ?? parsed.sourceRoot ?? '',
      tags: Array.isArray(parsed.tags) ? parsed.tags : [],
      projectType: parsed.projectType,
    })
  }
  return map
}

function evaluateSurface(
  name: SurfaceName,
  config: SurfaceConfig | undefined,
  affectedProjects: string[],
  projectMeta: Map<string, ProjectMeta>,
  totalAffected: number,
): SurfaceResult {
  if (!config) {
    throw new Error(`Unknown surface "${name}". Configure it in STAGES.surface`)
  }
  const matches = new Set<string>()
  const selectors = config.selectors ?? []
  if (selectors.length > 0) {
    for (const projectName of affectedProjects) {
      const meta = projectMeta.get(projectName)
      if (!meta) continue
      if (selectors.some((selector) => matchesSelector(meta, selector))) {
        matches.add(projectName)
      }
    }
  }
  let impacted = matches.size > 0
  if (config.defaultToAffected && totalAffected > 0) {
    impacted = true
  }
  return {
    name,
    impacted,
    matches: Array.from(matches).sort(),
    description: config.description,
  }
}

function matchesSelector(meta: ProjectMeta, selector: SurfaceSelector): boolean {
  if (selector.projects && !selector.projects.includes(meta.name)) {
    return false
  }
  if (selector.projectTypes?.length && (!meta.projectType || !selector.projectTypes.includes(meta.projectType))) {
    return false
  }
  if (selector.tagsAll?.length && !selector.tagsAll.every((tag) => meta.tags.includes(tag))) {
    return false
  }
  if (selector.tagsAny?.length && !selector.tagsAny.some((tag) => meta.tags.includes(tag))) {
    return false
  }
  return true
}
