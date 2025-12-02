import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export const repoRoot = path.resolve(__dirname, '..', '..')
export const nativeDistRoot = path.join('dist', 'native')
export const desktopDistRoot = () => process.env.DESKTOP_ARTIFACT_DIR ?? path.join('dist', 'desktop')

export const getAndroidProfile = () => process.env.EAS_ANDROID_PROFILE ?? 'preview'
export const getAndroidArtifactExt = () =>
  process.env.ANDROID_ARTIFACT_EXT ?? (getAndroidProfile() === 'production' ? 'aab' : 'apk')
export const getAndroidArtifactPath = () =>
  path.join(nativeDistRoot, `android-${getAndroidProfile()}.${getAndroidArtifactExt()}`)

export const getIosProfile = () => process.env.EAS_IOS_PROFILE ?? 'preview'
export const getIosArtifactPath = () => path.join(nativeDistRoot, `ios-${getIosProfile()}.ipa`)

export const getAndroidSubmitProfile = () => process.env.EAS_ANDROID_SUBMIT_PROFILE ?? getAndroidProfile()
export const getIosSubmitProfile = () => process.env.EAS_IOS_SUBMIT_PROFILE ?? getIosProfile()

export function ensureDirRelative(relPath: string) {
  fs.mkdirSync(path.resolve(repoRoot, relPath), { recursive: true })
}

export function fileExistsRelative(relPath: string) {
  return fs.existsSync(path.resolve(repoRoot, relPath))
}

export function discoverNativeArtifact(kind: 'android' | 'ios', extensions: string[]): string | undefined {
  const root = path.resolve(repoRoot, nativeDistRoot)
  if (!fs.existsSync(root)) {
    return undefined
  }
  const entries = fs.readdirSync(root)
  const matches = entries
    .filter((file) => file.startsWith(`${kind}-`) && extensions.some((ext) => file.endsWith(`.${ext}`)))
    .sort()
  if (matches.length === 0) {
    return undefined
  }
  return path.join(nativeDistRoot, matches[matches.length - 1])
}

export function listFilesRecursive(relDir: string): string[] {
  const absolute = path.resolve(repoRoot, relDir)
  if (!fs.existsSync(absolute)) {
    return []
  }
  const results: string[] = []
  const walk = (currentRel: string) => {
    const currentAbs = path.resolve(repoRoot, currentRel)
    const entries = fs.readdirSync(currentAbs, { withFileTypes: true })
    for (const entry of entries) {
      const entryRel = path.join(currentRel, entry.name)
      if (entry.isDirectory()) {
        walk(entryRel)
      } else if (entry.isFile()) {
        results.push(entryRel)
      }
    }
  }
  walk(relDir)
  return results
}

export function ensureEnvVars(stageName: string, variables: string[]) {
  const missing = variables.filter((name) => !process.env[name] || process.env[name] === '')
  if (missing.length > 0) {
    throw new Error(`Stage "${stageName}" requires the following env vars: ${missing.join(', ')}`)
  }
}

export function runCommand(command: string, args: string[], opts?: { cwd?: string }) {
  const result = spawnSync(command, args, {
    cwd: opts?.cwd ?? repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.status !== 0) {
    throw new Error(`Failed to run ${command} ${args.join(' ')}: ${result.stderr || result.stdout}`)
  }
  return result.stdout.trim()
}

export function git(args: string[]) {
  return runCommand('git', args)
}

export function nx(args: string[]) {
  return runCommand('pnpm', ['exec', 'nx', ...args])
}

const projectTagCache = new Map<string, string[]>()

interface AffectedProjectsResult {
  base: string
  head: string
  projects: string[]
}

export function getAffectedProjects(options: { base?: string; head?: string } = {}): AffectedProjectsResult {
  const head = resolveHead(options.head)
  const base = resolveBase(head, options.base)
  const raw = nx(['show', 'projects', '--affected', `--base=${base}`, `--head=${head}`, '--json'])
  const parsed = safeParseStringArray(raw)
  return {
    base,
    head,
    projects: parsed,
  }
}

export function getAffectedNativeProjects(options: { base?: string; head?: string } = {}): string[] {
  const override = parseProjectList(process.env.NX_NATIVE_PROJECTS)
  if (override.length > 0) {
    return override
  }
  const result = getAffectedProjects(options)
  return result.projects.filter((project) => projectHasTag(project, 'ci:surface:native'))
}

function resolveHead(headOverride?: string): string {
  if (headOverride && headOverride.length > 0) {
    return headOverride
  }
  if (process.env.NX_HEAD) {
    return process.env.NX_HEAD
  }
  return git(['rev-parse', 'HEAD'])
}

function resolveBase(head: string, baseOverride?: string): string {
  if (baseOverride && baseOverride.length > 0) {
    return baseOverride
  }
  if (process.env.NX_BASE) {
    return process.env.NX_BASE
  }
  const mainBranch = process.env.NX_MAIN_BRANCH ?? 'main'
  const candidates = [
    () => git(['merge-base', `origin/${mainBranch}`, head]),
    () => git(['merge-base', mainBranch, head]),
    () => git(['rev-parse', `${head}^`]),
  ]
  for (const candidate of candidates) {
    try {
      const value = candidate()
      if (value) {
        return value
      }
    } catch {
      // ignore and try next option
    }
  }
  return git(['rev-parse', head])
}

function safeParseStringArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed.map((value) => String(value))
    }
  } catch {
    // fall through
  }
  return []
}

function projectHasTag(projectName: string, tag: string): boolean {
  const tags = getProjectTags(projectName)
  return tags.includes(tag)
}

function getProjectTags(projectName: string): string[] {
  if (!projectTagCache.has(projectName)) {
    const raw = nx(['show', 'project', projectName, '--json'])
    const parsed = JSON.parse(raw)
    const tags = Array.isArray(parsed.tags) ? parsed.tags.map((value: unknown) => String(value)) : []
    projectTagCache.set(projectName, tags)
  }
  return projectTagCache.get(projectName) ?? []
}

function parseProjectList(value: string | undefined): string[] {
  if (!value) {
    return []
  }
  return value
    .split(/[, ]+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
}
