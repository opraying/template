import { FileSystem, Path } from '@effect/platform'
import { Effect, Layer, pipe } from 'effect'
import { ReactRouterOnCloudflare } from './cloudflare'
import {
  type BuildSubcommand,
  type BuildTarget,
  type DeploySubcommand,
  type PreviewSubcommand,
  type ServeSubcommand,
} from '../domain'
import { BuildReactRouterParameters, type BuildReactRouterTarget } from './domain'
import * as Environment from '../environment'
import { shell } from '../utils/shell'
import * as Workspace from '../workspace'

export const serve = Effect.fn('react-router.serve')(function* (
  workspace: Workspace.Workspace,
  subcommand: ServeSubcommand,
) {
  yield* Effect.logInfo(`Serve ${workspace.projectName}`)

  if (subcommand.target._tag !== 'BuildReactRouter') {
    return yield* Effect.dieMessage('Invalid target')
  }

  yield* Effect.annotateCurrentSpan({
    projectName: workspace.projectName,
    target: subcommand.target._tag,
    isDesktop: subcommand.target.options.isDesktop,
    isSpaMode: subcommand.target.options.isSpaMode,
  })

  const environment = yield* Environment.make({
    mode: 'serve',
    nodeEnv: 'development',
    stage: 'test',
    workspace,
  })

  const Live = Layer.mergeAll(
    Layer.succeed(Workspace.Workspace, workspace),
    Layer.succeed(
      BuildReactRouterParameters,
      BuildReactRouterParameters.of({
        env: environment.env,
        nodeEnv: 'development',
        target: subcommand.target,
      }),
    ),
  )

  const reactRouterServe = yield* Effect.promise(() => import('./serve')).pipe(Effect.withSpan('serve.import'))

  return yield* reactRouterServe
    .start(subcommand)
    .pipe(Effect.provide(Live), Effect.withConfigProvider(environment.configProvider))
})

export const build = Effect.fn('react-router.build')(function* (
  workspace: Workspace.Workspace,
  subcommand: BuildSubcommand,
) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path

  yield* Effect.logInfo('Start building app')

  if (subcommand.target._tag !== 'BuildReactRouter') {
    return yield* Effect.dieMessage('Invalid target')
  }

  yield* Effect.annotateCurrentSpan({
    projectName: workspace.projectName,
    target: subcommand.target._tag,
    stage: subcommand.stage,
    nodeEnv: subcommand.nodeEnv,
    minify: subcommand.minify,
    analyze: subcommand.analyze,
    isDesktop: subcommand.target.options.isDesktop,
    isSpaMode: subcommand.target.options.isSpaMode,
  })

  const environment = yield* Environment.make({
    mode: 'build',
    nodeEnv: subcommand.nodeEnv,
    stage: subcommand.stage,
    workspace,
    envs: {
      MINIFY: subcommand.minify,
      ANALYZE: subcommand.analyze,
    },
  })

  const saveBuildConfig = Effect.withSpan(
    fs.writeFileString(
      path.join(workspace.projectOutput.dist, 'build.json'),
      JSON.stringify({
        ...subcommand.target,
        stage: subcommand.stage,
      } satisfies BuildReactRouterTarget),
    ),
    'build.write-build-config',
  )

  yield* pipe(
    Effect.logInfo('Clean dist folder'),
    Effect.andThen(
      shell`
        $ rm -rf ${workspace.projectOutput.dist}
        $ mkdir -p ${workspace.projectOutput.dist}
      `,
    ),
    Effect.andThen(saveBuildConfig),
    Effect.andThen(environment.save),
  )

  const Base = Layer.mergeAll(
    Layer.succeed(Workspace.Workspace, workspace),
    Layer.succeed(
      BuildReactRouterParameters,
      BuildReactRouterParameters.of({
        env: environment.env,
        nodeEnv: subcommand.nodeEnv,
        target: subcommand.target,
      }),
    ),
  )
  const BuildLive = Layer.provideMerge(ReactRouterOnCloudflare, Base)

  const reactRouterBuild = yield* Effect.promise(() => import('./build')).pipe(Effect.withSpan('build.import'))

  yield* reactRouterBuild
    .start(subcommand)
    .pipe(Effect.provide(BuildLive), Effect.withConfigProvider(environment.configProvider))

  return yield* Effect.logInfo('Build finished')
})

export const deploy = Effect.fn('react-router.deploy')(function* (
  workspace: Workspace.Workspace,
  subcommand: DeploySubcommand,
  buildTarget: BuildTarget,
) {
  yield* Effect.logInfo(`Deploy ${workspace.projectName}`)

  if (buildTarget._tag !== 'BuildReactRouter') {
    return yield* Effect.dieMessage('Invalid build target')
  }

  yield* Effect.annotateCurrentSpan({
    projectName: workspace.projectName,
    target: buildTarget._tag,
    stage: buildTarget.stage,
    runtime: buildTarget.runtime,
    isCI: !!process.env.CI,
  })

  const environment = yield* Environment.loadEnv({
    workspace,
  })

  const Base = Layer.mergeAll(
    Layer.succeed(Workspace.Workspace, workspace),
    Layer.succeed(
      BuildReactRouterParameters,
      BuildReactRouterParameters.of({
        env: environment.env,
        nodeEnv: process.env.NODE_ENV,
        target: buildTarget,
      }),
    ),
  )
  const DeployLive = Layer.provideMerge(ReactRouterOnCloudflare, Base)

  const reactRouterDeploy = yield* Effect.promise(() => import('./deploy')).pipe(Effect.withSpan('deploy.import'))

  yield* reactRouterDeploy
    .start(subcommand, buildTarget)
    .pipe(Effect.provide(DeployLive), Effect.withConfigProvider(environment.configProvider))

  return yield* Effect.logInfo('Deploy finished')
})

export const preview = Effect.fn('react-router.preview')(function* (
  workspace: Workspace.Workspace,
  subcommand: PreviewSubcommand,
  buildTarget: BuildTarget,
) {
  yield* Effect.logInfo(`Preview ${workspace.projectName}`)

  if (buildTarget._tag !== 'BuildReactRouter') {
    return yield* Effect.dieMessage('Invalid build target')
  }

  const configEnvironment = yield* Environment.loadEnv({ workspace })

  const PreviewLive = Layer.mergeAll(
    Layer.succeed(Workspace.Workspace, workspace),
    Layer.succeed(
      BuildReactRouterParameters,
      BuildReactRouterParameters.of({
        env: configEnvironment.env,
        nodeEnv: process.env.NODE_ENV,
        target: buildTarget,
      }),
    ),
  )

  const reactRouterPreview = yield* Effect.promise(() => import('./preview')).pipe(Effect.withSpan('preview.import'))

  return yield* reactRouterPreview
    .start(subcommand, buildTarget)
    .pipe(Effect.provide(PreviewLive), Effect.withConfigProvider(configEnvironment.configProvider))
})
