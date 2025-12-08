import { FileSystem, Path } from '@effect/platform'
import { Effect, Layer, pipe } from 'effect'
import { Deployment, DeploymentOutput } from '../deployment'
import { BuildWorkersParameters } from '../domain'
import * as Git from '../git'
import { Workspace } from '../workspace'
import { CF } from '../cloudflare/api'
import { runWorkersDeploy } from '../cloudflare/workers'
import { formatSize } from '../cloudflare/utils'
import { parseConfig } from '../cloudflare/wrangler'
import { visualizer } from 'rollup-plugin-visualizer'

const make = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const workspace = yield* Workspace
  const path = yield* Path.Path
  const git = yield* Git.Git
  const parameters = yield* BuildWorkersParameters
  const cf = yield* CF
  const wranglerPath = path.join(workspace.projectPath, 'wrangler.jsonc')
  const { config: wranglerConfig } = yield* parseConfig(wranglerPath, parameters.nodeEnv, parameters.target.stage)

  const distWrangler = path.join(workspace.projectOutput.dist, 'wrangler.jsonc')

  const build = Effect.gen(function* () {
    const minify: boolean = parameters.env.MINIFY || false
    const entry = wranglerConfig.main!

    const globalDefine = [
      ['navigator.userAgent', JSON.stringify('Cloudflare-Workers')],
      ['process.env.NODE_ENV', JSON.stringify(parameters.nodeEnv)],
    ]

    yield* fs.copyFile(wranglerPath, distWrangler).pipe(
      Effect.zipRight(fs.readFileString(distWrangler)),
      Effect.map((wranglerContent) => wranglerContent.replace(/\.ts"/g, '.js"')),
      Effect.flatMap((modifiedContent) => fs.writeFileString(distWrangler, modifiedContent)),
      Effect.orDie,
      Effect.withSpan('build.prepare-wrangler-config', {
        attributes: {
          wranglerPath: wranglerPath,
          distWrangler: distWrangler,
          projectName: workspace.projectName,
        },
      }),
    )

    const bundler = yield* Effect.tryPromise({
      try: () => import('rolldown'),
      catch: () => new Error('rolldown not found'),
    }).pipe(Effect.withSpan('build.rolldown-import'), Effect.orDie)

    const tsconfigPaths = [`${workspace.projectPath}/tsconfig.app.json`, `${workspace.projectPath}/tsconfig.json`]
    const tsconfigPath = yield* Effect.reduce(
      tsconfigPaths,
      '',
      Effect.fn(function* (acc, path) {
        const exist = yield* fs.exists(path)
        if (exist) {
          return path
        }
        return acc
      }),
    ).pipe(Effect.withSpan('build.find-tsconfig'), Effect.orDie)

    yield* pipe(
      Effect.tryPromise({
        try: () =>
          bundler.build({
            cwd: workspace.projectOutput.dist,
            input: entry,
            tsconfig: tsconfigPath,
            platform: 'browser',
            write: true,
            plugins: [
              visualizer({
                projectRoot: workspace.projectOutput.dist,
                brotliSize: true,
                filename: 'analyze-worekrs.html',
                gzipSize: true,
                open: false,
                template: 'treemap', // or sunburst
              }),
            ],
            optimization: {
              inlineConst: true,
            },
            transform: {
              target: 'esnext',
              define: Object.fromEntries(globalDefine),
            },
            resolve: {
              mainFields: ['browser', 'module', 'main'],
            },
            treeshake: true,
            external: [/^cloudflare:/, /^node:/],
            output: {
              legalComments: 'none',
              minify: minify
                ? true
                : {
                    codegen: { removeWhitespace: false },
                    compress: {
                      keepNames: {
                        class: true,
                        function: true,
                      },
                      target: 'esnext',
                    },
                    mangle: false,
                  },
              esModule: true,
              sourcemap: true,
              dir: '',
              advancedChunks: {
                groups: [
                  {
                    name: 'react',
                    test: /node_modules[\\/]react/,
                    priority: 1,
                  },
                  {
                    name: 'effect',
                    test: /node_modules[\\/]effect/,
                    priority: 10,
                  },
                  {
                    name: 'effect-platform',
                    test: /node_modules[\\/]@effect\/platform/,
                    priority: 9,
                  },
                  {
                    name: 'db',
                    test: /(node_modules[\\/](@effect\/sql|kysely)|packages\/db)/,
                    priority: 8,
                  },
                  {
                    name: 'telemetry',
                    test: /(node_modules[\\/]@effect\/opentelemetry|packages\/otel)/,
                    priority: 8,
                  },
                  {
                    name: 'server',
                    test: /packages[\\/](server|preset-server)/,
                    priority: 8,
                  },
                  {
                    name: 'cloudflare',
                    test: /packages[\\/](cloudflare|preset-cloudflare)/,
                    priority: 7,
                  },
                  {
                    name: 'infra-purchase',
                    test: /infra[\\/](purchase)/,
                  },
                  {
                    name: 'infra-emailer',
                    test: /infra[\\/](emailer)/,
                  },
                  {
                    name: 'user-kit',
                    test: /packages[\\/](user-kit)/,
                  },
                  {
                    name: 'internal-kit',
                    test: /packages[\\/](internal-kit)/,
                  },
                  {
                    name: 'app-kit',
                    test: /packages[\\/](app-kit)/,
                  },
                  {
                    test: /node_modules/,
                    name: 'libs',
                  },
                ],
              },
              entryFileNames: '[name].js',
              chunkFileNames: '[name].js',
              assetFileNames: '[name].[ext]',
            },
          }),
        catch: (error) => error as Error,
      }),
      Effect.withSpan('build.bundler', {
        attributes: {
          entry,
          minify,
          tsconfig: tsconfigPath,
          projectName: workspace.projectName,
        },
      }),
      Effect.orDie,
    )

    const outfileSize = yield* fs.readDirectory(workspace.projectOutput.dist).pipe(
      Effect.map((_) => _.filter((_) => _.endsWith('.js'))),
      Effect.flatMap((files) =>
        Effect.reduce(
          files,
          0,
          Effect.fn(function* (acc, filePath) {
            const size = yield* fs
              .stat(path.join(workspace.projectOutput.dist, filePath))
              .pipe(Effect.map((stat) => stat.size))
            return acc + parseInt(size.toString())
          }),
        ),
      ),
      Effect.orDie,
    )

    return yield* Effect.logInfo('Workers build finished').pipe(
      Effect.annotateLogs('workers bundle size', formatSize(outfileSize)),
    )
  }).pipe(Effect.withSpan('build.cloudflare-build'))

  const deploy = Effect.gen(function* () {
    const workerName =
      parameters.target.stage === 'production'
        ? workspace.projectName
        : `${workspace.projectName}-${parameters.target.stage}`

    yield* runWorkersDeploy(workerName, wranglerConfig, {
      accountId: cf.accountId,
      apiToken: cf.apiToken,
      nodeEnv: parameters.nodeEnv,
      dist: workspace.projectOutput.dist,
      stage: parameters.target.stage,
      env: parameters.env,
    }).pipe(
      Effect.provideService(FileSystem.FileSystem, fs),
      Effect.provideService(Path.Path, path),
      Effect.provideService(Git.Git, git),
      Effect.provideService(CF, cf),
      Effect.provideService(Workspace, workspace),
    )

    const { previewUrls, branchUrls } = yield* cf.getWorkersDeployment(workerName, wranglerConfig)

    const latestDeployment = new DeploymentOutput({
      previewUrls,
      branchUrls,
      logUrl: `https://dash.cloudflare.com/${cf.accountId}/workers/services/view/${workerName}/production/deployments`,
      state: 'success',
    })

    return latestDeployment
  }).pipe(Effect.withSpan('cloudflare.deploy-cloudflare-workers'))

  return Deployment.of({
    deploy,
    build,
  })
})

export const WorkersOnCloudflareLive = Layer.scoped(Deployment, make).pipe(Layer.provide(CF.Live))
