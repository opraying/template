import { Command } from '@effect/cli'
import { FileSystem, Path } from '@effect/platform'
import { Effect } from 'effect'
import {
  BuildSubcommand,
  BuildWorkersTarget,
  DeploySubcommand,
  PreviewSubcommand,
  ServeSubcommand,
  type BuildTarget,
  type NodeEnv,
  type Stage,
} from '../domain'
import {
  appAnalyzeOption,
  appCwdOption,
  appMinifyOption,
  appNodeEnvOption,
  appStageOption,
  appVerboseOption,
} from './options'
import { reactRouterDesktopOption, reactRouterSpaModeOption } from '../react-router/options'
import {
  createReactRouterTarget,
  runBuild as runReactRouterBuild,
  runDeploy as runReactRouterDeploy,
  runPreview as runReactRouterPreview,
  runServe as runReactRouterServe,
} from '../react-router/command'
import * as Workers from '../workers/subcommand'
import type { Workspace as WorkspaceModel } from '../workspace'
import * as Workspace from '../workspace'

interface TargetDetectionOptions {
  readonly isSpaMode: boolean
  readonly isDesktop: boolean
}

const withWorkspace = <R, E>(cwd: string, f: (workspace: WorkspaceModel) => Effect.Effect<void, E, R>) =>
  Effect.gen(function* () {
    const workspace = yield* Workspace.make(cwd)
    return yield* f(workspace)
  })

const detectBuildTarget = (workspace: WorkspaceModel, stage: Stage, options: TargetDetectionOptions) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const configCandidates = [
      'react-router.config.ts',
      'react-router.config.mts',
      'react-router.config.cts',
      'react-router.config.js',
      'react-router.config.mjs',
      'react-router.config.cjs',
    ]

    for (const candidate of configCandidates) {
      const fullPath = path.join(workspace.projectPath, candidate)
      const exists = yield* fs.exists(fullPath)
      if (exists) {
        return createReactRouterTarget(stage, options)
      }
    }

    return BuildWorkersTarget({
      runtime: 'cloudflare-workers',
      options: {},
      stage,
    })
  })

const loadBuildTarget = (workspace: WorkspaceModel) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const buildFile = path.join(workspace.projectOutput.dist, 'build.json')
    const exists = yield* fs.exists(buildFile)

    if (!exists) {
      return yield* Effect.fail(new Error('Missing build output. Run xdev build before deploy/preview.'))
    }

    const content = yield* fs.readFileString(buildFile)
    const parsed = yield* Effect.try({
      try: () => JSON.parse(content) as BuildTarget,
      catch: (error) => error as Error,
    })

    return parsed
  })

const dispatchServe = (workspace: WorkspaceModel, target: BuildTarget, subcommand: ServeSubcommand) =>
  target._tag === 'BuildReactRouter' ? runReactRouterServe(workspace, subcommand) : Workers.serve(workspace, subcommand)

const dispatchBuild = (workspace: WorkspaceModel, target: BuildTarget, subcommand: BuildSubcommand) =>
  target._tag === 'BuildReactRouter' ? runReactRouterBuild(workspace, subcommand) : Workers.build(workspace, subcommand)

const dispatchDeploy = (workspace: WorkspaceModel, target: BuildTarget, subcommand: DeploySubcommand) =>
  target._tag === 'BuildReactRouter'
    ? runReactRouterDeploy(workspace, subcommand, target)
    : Workers.deploy(workspace, subcommand, target)

const dispatchPreview = (workspace: WorkspaceModel, target: BuildTarget, subcommand: PreviewSubcommand) =>
  target._tag === 'BuildReactRouter'
    ? runReactRouterPreview(workspace, subcommand, target)
    : Workers.preview(workspace, subcommand, target)

const serveCommand = Command.make(
  'serve',
  {
    cwd: appCwdOption,
    stage: appStageOption,
    nodeEnv: appNodeEnvOption,
    verbose: appVerboseOption,
    spa: reactRouterSpaModeOption,
    desktop: reactRouterDesktopOption,
  },
  (config) =>
    withWorkspace(config.cwd, (workspace) => {
      const stage = (config.stage ?? 'test') as Stage
      const nodeEnv = (config.nodeEnv ?? 'development') as NodeEnv
      return Effect.flatMap(
        detectBuildTarget(workspace, stage, { isSpaMode: config.spa, isDesktop: config.desktop }),
        (target) =>
          dispatchServe(
            workspace,
            target,
            ServeSubcommand({
              cwd: config.cwd,
              target,
              verbose: config.verbose,
            }),
          ),
      )
    }),
)

const buildCommand = Command.make(
  'build',
  {
    cwd: appCwdOption,
    stage: appStageOption,
    nodeEnv: appNodeEnvOption,
    minify: appMinifyOption,
    analyze: appAnalyzeOption,
    verbose: appVerboseOption,
    spa: reactRouterSpaModeOption,
    desktop: reactRouterDesktopOption,
  },
  (config) =>
    withWorkspace(config.cwd, (workspace) => {
      const stage = (config.stage ?? 'staging') as Stage
      const nodeEnv = (config.nodeEnv ?? 'production') as NodeEnv
      return Effect.flatMap(
        detectBuildTarget(workspace, stage, { isSpaMode: config.spa, isDesktop: config.desktop }),
        (target) =>
          dispatchBuild(
            workspace,
            target,
            BuildSubcommand({
              cwd: config.cwd,
              target,
              stage,
              nodeEnv,
              minify: config.minify,
              analyze: config.analyze,
              verbose: config.verbose,
            }),
          ),
      )
    }),
)

const deployCommand = Command.make('deploy', { cwd: appCwdOption, verbose: appVerboseOption }, (config) =>
  withWorkspace(config.cwd, (workspace) =>
    Effect.flatMap(loadBuildTarget(workspace), (target) =>
      dispatchDeploy(
        workspace,
        target,
        DeploySubcommand({
          cwd: config.cwd,
          verbose: config.verbose,
        }),
      ),
    ),
  ),
)

const previewCommand = Command.make('preview', { cwd: appCwdOption, verbose: appVerboseOption }, (config) =>
  withWorkspace(config.cwd, (workspace) =>
    Effect.flatMap(loadBuildTarget(workspace), (target) =>
      dispatchPreview(
        workspace,
        target,
        PreviewSubcommand({
          cwd: config.cwd,
          verbose: config.verbose,
        }),
      ),
    ),
  ),
)

const appCommands = [serveCommand, buildCommand, deployCommand, previewCommand] as const

export { appCommands, buildCommand, deployCommand, previewCommand, serveCommand }
