import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { workspaceRoot } from '@nx/devkit'
import { type StageContext } from './types'

export const getAndroidProfile = () => process.env.EAS_ANDROID_PROFILE ?? 'preview'
export const getAndroidArtifactExt = () =>
  process.env.ANDROID_ARTIFACT_EXT ?? (getAndroidProfile() === 'production' ? 'aab' : 'apk')

export const getIosProfile = () => process.env.EAS_IOS_PROFILE ?? 'preview'

export const getAndroidSubmitProfile = () => process.env.EAS_ANDROID_SUBMIT_PROFILE ?? getAndroidProfile()
export const getIosSubmitProfile = () => process.env.EAS_IOS_SUBMIT_PROFILE ?? getIosProfile()

export function fileExistsRelative(relPath: string) {
  return fs.existsSync(path.resolve(workspaceRoot, relPath))
}

export function discoverNativeArtifact(kind: 'android' | 'ios', extensions: string[]): string | undefined {
  const root = path.resolve(workspaceRoot, nativeDistRoot)
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
  const absolute = path.resolve(workspaceRoot, relDir)
  if (!fs.existsSync(absolute)) {
    return []
  }
  const results: string[] = []
  const walk = (currentRel: string) => {
    const currentAbs = path.resolve(workspaceRoot, currentRel)
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
    cwd: opts?.cwd ?? workspaceRoot,
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

export const getCiSharedContext = (context: StageContext) => context.ci

const parseProjectOverride = (value: string | undefined) =>
  (value ?? '')
    .split(/[, ]+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)

export const getNativeProjectsFromContext = (context: StageContext): string[] => {
  const value = context['nativeProjects']
  return Array.isArray(value) ? (value as string[]) : []
}

export const storeNativeProjects = (context: StageContext, projects: string[]) => {
  context['nativeProjects'] = projects
}

export const resolveNativeProjects = (context: StageContext, label: string) => {
  const override = parseProjectOverride(process.env.NX_NATIVE_PROJECTS)
  if (override.length > 0) {
    console.log(`[${label}] Using NX_NATIVE_PROJECTS override: ${override.join(', ')}`)
    return override
  }
  const ci = getCiSharedContext(context)
  const native = ci.affectedProjects.filter((project) => {
    const tags = ci.projectMeta?.[project]?.tags ?? []
    return tags.includes('native')
  })
  if (native.length === 0) {
    console.log(`[${label}] No affected native projects detected from surface analysis.`)
  } else {
    console.log(`[${label}] Native projects from surface analysis: ${native.join(', ')}`)
  }
  return native
}
