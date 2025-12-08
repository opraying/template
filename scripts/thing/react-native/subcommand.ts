import { FileSystem, Path, Command, CommandExecutor } from '@effect/platform'
import { diffFingerprints } from '@expo/fingerprint'
import type { Fingerprint, FingerprintDiffItem, Platform as ExpoPlatform } from '@expo/fingerprint'
import { Console, Effect, Schedule } from 'effect'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  type ReactNativePrebuildSubcommand,
  type ReactNativeBuildSubcommand,
  type ReactNativeRunSubcommand,
  type ReactNativeAnalyzeSubcommand,
  type ReactNativeDeployCheckSubcommand,
  type ReactNativeDeployJsUpdateSubcommand,
  type ReactNativeDeploySubmitSubcommand,
} from './domain'
import { execProcess, shellInPath } from '../utils/shell'
import { branchToNativeChannel, Git, git } from '../git'
import * as Workspace from '../workspace'
import { collectChangedFiles, resolveBase, resolveHead } from '../../ci/surface-detector'
import { createFingerprint } from '../utils/fingerprint'

type NativePlatform = 'ios' | 'android'

interface FingerprintSnapshot {
  commit: string
  hash: string
  fingerprint: Fingerprint
}

interface FingerprintSummary {
  baseHash: string
  headHash: string
  changed: boolean
  diff: FingerprintDiffItem[]
}

interface DeployCheckPlatformReport {
  platform: NativePlatform
  jsFingerprint: FingerprintSummary
  nativeFingerprint: FingerprintSummary
  nativeFilesChanged: string[]
  requiresNativeBuild: boolean
  requiresStoreRelease: boolean
  canHotUpdate: boolean
}

const formatArgs = (args: Array<string | undefined | false>) =>
  args.filter((part): part is string => typeof part === 'string' && part.length > 0).join(' ')

const quote = (value: string) => JSON.stringify(value)

const flagIfTrue = (name: string, value: boolean, val?: any) => {
  if (value) {
    if (val) {
      return `--${name} ${quote(val)}`
    }
    return `--${name}`
  }

  return undefined
}

const flagIfFalse = (name: string, value?: unknown) => (!value ? `--no-${name}` : undefined)

const resolvePath = (path: Path.Path, base: string, candidate?: string) => {
  if (!candidate) {
    return undefined
  }

  return path.isAbsolute(candidate) ? candidate : path.join(base, candidate)
}

const makeNativeEnv = Effect.fn('react-native.make-env')(function* (workspace: Workspace.Workspace) {
  const path = yield* Path.Path

  const hermesDir =
    process.env.REACT_NATIVE_OVERRIDE_HERMES_DIR ??
    path.join(workspace.root, 'node_modules', 'hermes-compiler', 'hermesc')

  const easLocalPlugin =
    process.env.EAS_LOCAL_BUILD_PLUGIN_PATH ??
    path.join(workspace.root, 'node_modules', 'eas-cli-local-build-plugin', 'bin', 'run')

  const fixedWorkdir = process.env.EXPO_FIXED_BUILD_WORKDIR ?? workspace.root

  return {
    ...process.env,
    CI: process.env.CI ?? 'false',
    // EXPO_DEBUG: process.env.EXPO_DEBUG ?? 'true',
    EXPO_NO_TELEMETRY: process.env.EXPO_NO_TELEMETRY ?? 'true',
    EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH: process.env.EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH ?? 'true',
    EXPO_ATLAS: process.env.EXPO_ATLAS ?? 'true',
    EXPO_FIXED_BUILD_WORKDIR: fixedWorkdir,
    REACT_NATIVE_OVERRIDE_HERMES_DIR: hermesDir,
    EAS_BUILD_DISABLE_EXPO_DOCTOR_STEP: process.env.EAS_BUILD_DISABLE_EXPO_DOCTOR_STEP ?? 'true',
    EAS_LOCAL_BUILD_PLUGIN_PATH: easLocalPlugin,
    EAS_NO_VCS_CHECK: process.env.EAS_NO_VCS_CHECK ?? '1',
  }
})

export const prebuild = Effect.fn('react-native.prebuild')(function* (
  workspace: Workspace.Workspace,
  subcommand: ReactNativePrebuildSubcommand,
) {
  yield* Effect.annotateCurrentSpan({
    projectName: workspace.projectName,
    command: 'expo prebuild',
    platform: subcommand.platform,
    clean: subcommand.clean,
    install: subcommand.install,
  })

  const env = yield* makeNativeEnv(workspace)
  const runShell = shellInPath(workspace.projectPath, env, true)

  const args = formatArgs([
    `--platform ${subcommand.platform}`,
    flagIfTrue('clean', subcommand.clean),
    flagIfFalse('install', subcommand.install),
  ])

  const command = ['expo prebuild']
  if (args.length > 0) {
    command.push(args)
  }

  return yield* runShell`
    $$ ${command.join(' ')}
  `
})

export const build = Effect.fn('react-native.build')(function* (
  workspace: Workspace.Workspace,
  subcommand: ReactNativeBuildSubcommand,
) {
  if (subcommand.local && subcommand.platform === 'all') {
    return yield* Effect.dieMessage('Local EAS builds require specifying a single platform (ios or android).')
  }

  yield* Effect.annotateCurrentSpan({
    projectName: workspace.projectName,
    command: 'eas build',
    platform: subcommand.platform,
    profile: subcommand.profile,
    local: subcommand.local,
  })

  const env = yield* makeNativeEnv(workspace)
  const path = yield* Path.Path
  const artifactPath = resolvePath(path, workspace.root, subcommand.output)
  const runShell = shellInPath(workspace.projectPath, env, true)

  const args = formatArgs([
    `--platform ${subcommand.platform}`,
    `--profile ${quote(subcommand.profile)}`,
    flagIfTrue('json', subcommand.json),
    flagIfTrue('local', subcommand.local),
    flagIfTrue('message', !!subcommand.message, subcommand.message),
    flagIfTrue('build-logger-level', !!subcommand.buildLoggerLevel, subcommand.buildLoggerLevel),
    flagIfTrue('freeze-credentials', subcommand.freezeCredentials),
    flagIfTrue('reset-cache', subcommand.clearCache),
    flagIfFalse('wait', subcommand.wait),
    flagIfTrue('artifactPath', !!artifactPath, artifactPath),
    '--interactive false',
  ])

  return yield* runShell`
    $$ eas build ${args}
  `
})

export const run = Effect.fn('react-native.run')(function* (
  workspace: Workspace.Workspace,
  subcommand: ReactNativeRunSubcommand,
) {
  yield* Effect.annotateCurrentSpan({
    projectName: workspace.projectName,
    command: 'expo run',
    platform: subcommand.platform,
    device: subcommand.device ?? 'auto',
    clean: subcommand.clean,
  })

  const env = yield* makeNativeEnv(workspace)
  const runShell = shellInPath(workspace.projectPath, env, true)

  const optionalArgs = formatArgs([
    flagIfTrue('device', !!subcommand.device, subcommand.device),
    flagIfTrue('scheme', !!subcommand.scheme, subcommand.scheme),
    flagIfTrue('configuration', subcommand.platform === 'ios', subcommand.xcodeConfiguration),
    flagIfTrue('variant', subcommand.platform === 'android', subcommand.variant),
    `--port ${subcommand.port}`,
    flagIfFalse('bundler', subcommand.bundler),
    '--install false',
    flagIfFalse('build-cache', subcommand.buildCache),
    flagIfTrue('reset-cache', subcommand.clean),
  ])

  const commandParts = [`pnpm exec expo run:${subcommand.platform}`]
  if (optionalArgs.length > 0) {
    commandParts.push(optionalArgs)
  }

  return yield* runShell`
    $$ ${commandParts.join(' ')}
  `
})

export const analyze = Effect.fn('react-native.analyze')(function* (
  workspace: Workspace.Workspace,
  subcommand: ReactNativeAnalyzeSubcommand,
) {
  const env = yield* makeNativeEnv(workspace)

  const head = resolveHead(subcommand.head)
  const base = resolveBase(head, subcommand.base)
  const changedFiles = collectChangedFiles(base, head)

  const outputDir = path.join(workspace.projectPath, '.expo')
  const fs = yield* FileSystem.FileSystem

  yield* Effect.logInfo(`Preparing export output at ${outputDir}`).pipe(
    Effect.andThen(fs.makeDirectory(outputDir, { recursive: true })),
    Effect.orDie,
  )

  const exportCommandArgs = formatArgs([
    `--platform ${subcommand.platform}`,
    '--dev false',
    flagIfFalse('minify', subcommand.minify),
    flagIfTrue('bundle-output', true, outputDir + '/index.bundle'),
    flagIfTrue('assets-dest', true, outputDir),
    '--eager',
    flagIfTrue('bytecode', subcommand.bytecode),
    '--unstable-transform-profile hermes',
  ])

  const exportCommandParts = ['pnpm exec expo export:embed']
  if (exportCommandArgs.length > 0) {
    exportCommandParts.push(exportCommandArgs)
  }

  const port = 9978
  const atlasJsonl = `.expo/atlas.jsonl`
  const atlasJsonlPath = path.join(workspace.projectPath, atlasJsonl)

  const AtlasCommand = Command.make('expo-atlas', '.expo/atlas.jsonl', '--no-open', '--port', port.toString()).pipe(
    Command.workingDirectory(workspace.projectPath),
    Command.env(env),
    Command.start,
  )

  const logMessages = `Expo Atlas is ready on: http://localhost:${port}`

  yield* Effect.logInfo(logMessages).pipe(
    Effect.annotateLogs({
      file: atlasJsonlPath,
    }),
  )

  yield* Effect.logInfo('Change files', changedFiles)

  yield* AtlasCommand.pipe(
    Effect.tap(Effect.addFinalizer(() => Effect.logInfo('Expo Atlas stopped 🛏️'))),
    Effect.zipRight(Effect.never),
    Effect.orDie,
  )
})

export const deployCheck = Effect.fn('react-native.deploy-check')(function* (
  workspace: Workspace.Workspace,
  subcommand: ReactNativeDeployCheckSubcommand,
) {
  const pathService = yield* Path.Path
  const projectRelative = pathService.relative(workspace.root, workspace.projectPath) || '.'
  const head = resolveHead(subcommand.head)
  const base = resolveBase(head, subcommand.base)
  const changedFiles = collectChangedFiles(base, head)

  const platforms: NativePlatform[] = subcommand.platform === 'all' ? ['ios', 'android'] : [subcommand.platform]

  const results: DeployCheckPlatformReport[] = []

  for (const platform of platforms) {
    const nativeHeadSnapshot = yield* Effect.promise(() =>
      createFingerprintSnapshot(workspace.root, {
        commit: head,
        projectPath: projectRelative,
        platform: platform,
      }),
    )

    const nativeBaseSnapshot =
      base === head
        ? nativeHeadSnapshot
        : yield* Effect.promise(() =>
            createFingerprintSnapshot(workspace.root, {
              commit: base,
              projectPath: projectRelative,
              platform: platform,
            }),
          )

    const diff = diffFingerprints(nativeBaseSnapshot.fingerprint, nativeHeadSnapshot.fingerprint)
    const nativeChanged = nativeBaseSnapshot.hash !== nativeHeadSnapshot.hash
    const nativeTouches = detectNativeTouches(changedFiles, platform)

    const headJs = yield* Effect.promise(() =>
      createFingerprintSnapshot(workspace.root, {
        commit: head,
        projectPath: projectRelative,
        platform,
        mode: 'ota',
      }),
    )

    const baseJs =
      base === head
        ? headJs
        : yield* Effect.promise(() =>
            createFingerprintSnapshot(workspace.root, {
              commit: base,
              projectPath: projectRelative,
              platform,
              mode: 'ota',
            }),
          )

    const jsChanged = baseJs.hash !== headJs.hash
    const requiresNativeBuild = nativeChanged || nativeTouches.length > 0
    const canHotUpdate = jsChanged && !requiresNativeBuild

    results.push({
      platform,
      jsFingerprint: {
        baseHash: baseJs.hash,
        headHash: headJs.hash,
        changed: jsChanged,
        diff,
      },
      nativeFingerprint: {
        baseHash: nativeBaseSnapshot.hash,
        headHash: nativeHeadSnapshot.hash,
        changed: nativeChanged,
        diff,
      },
      nativeFilesChanged: nativeTouches,
      requiresStoreRelease: nativeChanged,
      requiresNativeBuild,
      canHotUpdate,
    })
  }
})

export const deployJsUpdate = Effect.fn('react-native.deploy-js-update')(function* (
  workspace: Workspace.Workspace,
  subcommand: ReactNativeDeployJsUpdateSubcommand,
) {
  const git = yield* Git
  const head = resolveHead(subcommand.head)
  const base = resolveBase(head, subcommand.base)
  const branch = yield* git.branch
  const lastCommit = yield* git.lastCommit
  const channel = subcommand.channel ?? branchToNativeChannel(branch, subcommand.env)
  const message = subcommand.message ?? lastCommit.message

  const platforms: Array<'ios' | 'android'> = subcommand.platform === 'all' ? ['ios', 'android'] : [subcommand.platform]

  yield* Effect.logInfo(`Publishing JS update for ${branch} -> channel ${channel} (${subcommand.env}) via hot-updater`)

  const runShell = shellInPath(workspace.root, process.env ?? {}, false)

  for (const platform of platforms) {
    const args = ['exec hot-updater deploy', `-p ${platform}`, `-c ${channel}`, `-m ${quote(message)}`]

    if (subcommand.force || process.env.HOT_UPDATER_FORCE_UPDATE === 'true') {
      args.push('-f')
    }

    const targetVersion = subcommand.targetVersion ?? process.env.HOT_UPDATER_TARGET_VERSION
    if (targetVersion) {
      args.push(`-t ${quote(targetVersion)}`)
    }

    yield* Effect.logInfo(`→ hot-updater deploy (${platform})`)

    if (subcommand.dryRun) {
      yield* Effect.logInfo(`[dry-run] pnpm ${args.join(' ')}`)
      continue
    }

    yield* runShell`
      $$ pnpm ${args.join(' ')}
    `
  }
})

export const deploySubmit = Effect.fn('react-native.deploy-submit')(function* (
  workspace: Workspace.Workspace,
  subcommand: ReactNativeDeploySubmitSubcommand,
) {
  yield* Effect.annotateCurrentSpan({
    projectName: workspace.projectName,
    command: 'eas submit',
    platform: subcommand.platform,
    profile: subcommand.profile ?? 'default',
  })

  const env = yield* makeNativeEnv(workspace)
  const runShell = shellInPath(workspace.projectPath, env, true)

  const shouldUseLatest = subcommand.latest && !subcommand.path && !subcommand.buildId

  const args = formatArgs([
    `--platform ${subcommand.platform}`,
    flagIfTrue('profile', !!subcommand.profile, subcommand.profile),
    flagIfTrue('path', !!subcommand.path, subcommand.path),
    flagIfTrue('id', !!subcommand.buildId, subcommand.buildId),
    flagIfTrue('latest', shouldUseLatest),
    flagIfTrue('non-interactive', subcommand.nonInteractive),
    flagIfFalse('wait', subcommand.wait),
    flagIfTrue('json', subcommand.json),
    flagIfTrue('verbose', subcommand.verbose),
  ])

  return yield* runShell`
    $$ eas submit ${args}
  `
})

const DEFAULT_NATIVE_PROJECT = 'apps/native'

const PLATFORM_PATTERNS: Record<NativePlatform, RegExp[]> = {
  ios: [/^ios\//, /^apps\/native\/ios\//, /^apps\/native\/app\.config\.ios\./, /^apps\/native\/Info\.plist$/],
  android: [
    /^android\//,
    /^apps\/native\/android\//,
    /^apps\/native\/app\.config\.android\./,
    /^apps\/native\/AndroidManifest\.xml$/,
  ],
}

const COMMON_NATIVE_PATTERNS: RegExp[] = [
  /^apps\/native\/app\.json$/,
  /^apps\/native\/eas\.json$/,
  /^apps\/native\/package\.json$/,
  /^apps\/native\/babel\.config\.js$/,
  /^apps\/native\/metro\.config\.js$/,
  /^packages\/expo-/,
  /^packages\/react-native/,
  /^package\.json$/,
  /^pnpm-lock\.yaml$/,
  /^pnpm-workspace\.yaml$/,
]

const detectNativeTouches = (files: string[], platform: NativePlatform) => {
  const patterns = [...PLATFORM_PATTERNS[platform], ...COMMON_NATIVE_PATTERNS]
  return files.filter((file) => patterns.some((regex) => regex.test(file)))
}

async function createFingerprintSnapshot(
  workspaceRoot: string,
  options: {
    commit: string
    projectPath: string
    platform: NativePlatform
    debug?: boolean
    silent?: boolean
    mode?: 'ota' | 'native'
  },
): Promise<FingerprintSnapshot> {
  const fingerprint = await withCommitWorkspace(workspaceRoot, options.commit, async (root) => {
    const projectPath = path.join(root, options.projectPath || DEFAULT_NATIVE_PROJECT)
    if (!fs.existsSync(projectPath)) {
      throw new Error(`Project root ${options.projectPath} is missing in commit ${options.commit}`)
    }

    return createFingerprint(projectPath, {
      platform: options.platform as ExpoPlatform,
      ...(options.debug !== undefined ? { debug: options.debug } : {}),
      ...(options.silent !== undefined ? { silent: options.silent } : {}),
      ...(options.mode ? { mode: options.mode } : {}),
    })
  })

  return {
    commit: options.commit,
    hash: fingerprint.hash,
    fingerprint,
  }
}

async function withCommitWorkspace<T>(workspaceRoot: string, commit: string, task: (root: string) => Promise<T>) {
  const currentHead = git(['rev-parse', 'HEAD'], { cwd: workspaceRoot })
  if (commit === currentHead) {
    return task(workspaceRoot)
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'xstack-native-fingerprint-'))
  let worktreeAdded = false

  try {
    git(['worktree', 'add', '--detach', tempRoot, commit], { cwd: workspaceRoot })
    worktreeAdded = true
    linkSharedResources(workspaceRoot, tempRoot)
    return await task(tempRoot)
  } finally {
    if (worktreeAdded) {
      try {
        git(['worktree', 'remove', '--force', tempRoot], { cwd: workspaceRoot })
      } catch (error) {
        console.warn(
          `[fingerprint] Failed to remove worktree: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }

    try {
      fs.rmSync(tempRoot, { recursive: true, force: true })
    } catch {
      // ignore cleanup errors
    }
  }
}

const linkSharedResources = (workspaceRoot: string, worktreeRoot: string) => {
  const shared = ['node_modules', '.expo']
  for (const entry of shared) {
    const source = path.join(workspaceRoot, entry)
    if (!fs.existsSync(source)) continue
    const target = path.join(worktreeRoot, entry)
    try {
      if (fs.existsSync(target)) {
        fs.rmSync(target, { recursive: true, force: true })
      }
      type SymlinkType = Parameters<typeof fs.symlinkSync>[2]
      const type = (process.platform === 'win32' ? 'junction' : 'dir') as SymlinkType
      fs.symlinkSync(source, target, type)
    } catch (error) {
      console.warn(`[fingerprint] Failed to link ${entry}: ${error instanceof Error ? error.message : error}`)
    }
  }
}
