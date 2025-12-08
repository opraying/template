import { FileSystem, Path } from '@effect/platform'
import { Effect, Layer, pipe } from 'effect'
import { WorkersOnCloudflareLive } from './cloudflare'
import type {
  BuildSubcommand,
  BuildTarget,
  BuildWorkersTarget,
  DeploySubcommand,
  PreviewSubcommand,
  ServeSubcommand,
} from '../domain'
import { BuildWorkersParameters } from '../domain'
import * as Environment from '../environment'
import { shell } from '../utils/shell'
import * as Workspace from '../workspace'

export const serve = Effect.fn('workers.serve')(function* (
  workspace: Workspace.Workspace,
  subcommand: ServeSubcommand,
) {
  yield* Effect.logInfo(`Serve ${workspace.projectName}`)

  if (subcommand.target._tag !== 'BuildWorkers') {
    return yield* Effect.dieMessage('Invalid target')
  }

  yield* Effect.annotateCurrentSpan({
    projectName: workspace.projectName,
    target: subcommand.target._tag,
  })

  const environment = yield* Environment.make({
    mode: 'serve',
    nodeEnv: 'development',
    stage: 'test',
    workspace,
  })

  const ServeLive = Layer.mergeAll(
    Layer.succeed(Workspace.Workspace, workspace),
    Layer.succeed(BuildWorkersParameters, {
      env: environment.env,
      nodeEnv: 'development',
      target: subcommand.target,
    }),
  )

  const workersServe = yield* Effect.promise(() => import('./serve')).pipe(Effect.withSpan('serve.import'))

  return yield* pipe(
    workersServe.start(),
    Effect.provide(ServeLive),
    Effect.withConfigProvider(environment.configProvider),
  )
})

export const build = Effect.fn('workers.build')(function* (
  workspace: Workspace.Workspace,
  subcommand: BuildSubcommand,
) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path

  yield* Effect.logInfo('Start building app')

  if (subcommand.target._tag !== 'BuildWorkers') {
    return yield* Effect.dieMessage('Invalid target')
  }

  yield* Effect.annotateCurrentSpan({
    projectName: workspace.projectName,
    target: subcommand.target._tag,
    stage: subcommand.stage,
    nodeEnv: subcommand.nodeEnv,
    minify: subcommand.minify,
    analyze: subcommand.analyze,
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
      } satisfies BuildWorkersTarget),
    ),
    'build.writeBuildConfig',
  )

  yield* pipe(
    Effect.logInfo('Clean dist folder'),
    Effect.andThen(
      shell`
        $ rm -rf ${workspace.projectOutput.dist}
        $ mkdir -p ${workspace.projectOutput.dist}
      `,
    ),
    Effect.withSpan('build.cleanup'),
    Effect.andThen(saveBuildConfig),
    Effect.andThen(environment.save),
  )

  const Base = Layer.mergeAll(
    Layer.succeed(Workspace.Workspace, workspace),
    Layer.succeed(BuildWorkersParameters, {
      env: environment.env,
      nodeEnv: subcommand.nodeEnv,
      target: subcommand.target,
    }),
  )
  const BuildLive = WorkersOnCloudflareLive.pipe(Layer.provideMerge(Base))

  const workersBuild = yield* Effect.promise(() => import('./build')).pipe(Effect.withSpan('build.import'))

  yield* workersBuild
    .start(subcommand)
    .pipe(Effect.provide(BuildLive), Effect.withConfigProvider(environment.configProvider))

  return yield* Effect.logInfo('Build finished')
})

export const deploy = Effect.fn('workers.deploy')(function* (
  workspace: Workspace.Workspace,
  subcommand: DeploySubcommand,
  buildTarget: BuildTarget,
) {
  yield* Effect.logInfo(`Deploy ${workspace.projectName}`)

  if (buildTarget._tag !== 'BuildWorkers') {
    return yield* Effect.dieMessage('Invalid build target')
  }

  const environment = yield* Environment.loadEnv({
    workspace,
  }).pipe(
    Effect.withSpan('environment.load-env', {
      attributes: {
        projectName: workspace.projectName,
      },
    }),
  )

  const Base = Layer.mergeAll(
    Layer.succeed(Workspace.Workspace, workspace),
    Layer.succeed(
      BuildWorkersParameters,
      BuildWorkersParameters.of({
        env: environment.env,
        target: buildTarget,
        nodeEnv: 'production',
      }),
    ),
  )
  const DeployLive = Layer.provideMerge(WorkersOnCloudflareLive, Base)

  const workersDeploy = yield* Effect.promise(() => import('./deploy')).pipe(Effect.withSpan('deploy.import'))

  yield* workersDeploy
    .start(subcommand, buildTarget)
    .pipe(Effect.provide(DeployLive), Effect.withConfigProvider(environment.configProvider))

  return yield* Effect.logInfo('Deploy finished')
})

export const preview = Effect.fn('workers.preview')(function* (
  workspace: Workspace.Workspace,
  subcommand: PreviewSubcommand,
  buildTarget: BuildTarget,
) {
  yield* Effect.logInfo(`Preview ${workspace.projectName}`)

  if (buildTarget._tag !== 'BuildWorkers') {
    return yield* Effect.dieMessage('Invalid build target')
  }

  const environment = yield* Environment.loadEnv({ workspace })

  const PreviewLive = Layer.mergeAll(
    Layer.succeed(Workspace.Workspace, workspace),
    Layer.succeed(
      BuildWorkersParameters,
      BuildWorkersParameters.of({
        env: environment.env,
        target: buildTarget,
        nodeEnv: 'production',
      }),
    ),
  )

  const workersPreview = yield* Effect.promise(() => import('./preview')).pipe(Effect.withSpan('preview.import'))

  return yield* workersPreview
    .start(subcommand, buildTarget)
    .pipe(Effect.provide(PreviewLive), Effect.withConfigProvider(environment.configProvider))
})
