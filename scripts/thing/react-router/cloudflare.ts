import { FileSystem, Path } from '@effect/platform'
import { Effect, Layer, pipe } from 'effect'
import type { Plugin } from 'rolldown'
import { visualizer } from 'rollup-plugin-visualizer'
import { CF } from '../cloudflare/api'
import { formatSize } from '../cloudflare/utils'
import { runWorkersDeploy } from '../cloudflare/workers'
import { parseConfig } from '../cloudflare/wrangler'
import { Deployment, DeploymentOutput } from '../deployment'
import { BuildReactRouterParameters } from '../domain'
import { Git } from '../git'
import { shellInPath } from '../utils'
import { Workspace } from '../workspace'

const make = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const git = yield* Git
  const parameters = yield* BuildReactRouterParameters
  const workspace = yield* Workspace
  const cf = yield* CF
  const wranglerPath = path.join(workspace.projectPath, 'wrangler.jsonc')
  const { config: wranglerConfig } = yield* parseConfig(wranglerPath, parameters.nodeEnv, parameters.target.stage)

  const workersStatic = 'public'
  const clientStatic = 'client'
  const distWrangler = path.join(workspace.projectOutput.dist, 'wrangler.jsonc')

  const build = Effect.gen(function* () {
    const minify: boolean = parameters.env.MINIFY || false
    const workerEntry = `${workspace.root}/scripts/thing/react-router/templates/workers-entry.ts`
    const workerTemplate = `${workspace.root}/scripts/thing/react-router/templates/index.js`
    const entryFilename = path.basename(wranglerConfig.main!)
    const outfile = `${workspace.projectOutput.dist}/${entryFilename.replace('.ts', '.js')}`

    const globalDefine = [
      ['import.meta.hot', JSON.stringify(false)],
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
    }).pipe(Effect.withSpan('build.bundler-import'), Effect.orDie)

    const tsconfigPaths = [`${workspace.projectPath}/tsconfig.app.json`, `${workspace.projectPath}/tsconfig.json`]
    const tsconfigPath = yield* Effect.reduce(
      tsconfigPaths,
      '',
      Effect.fn(function* (acc, _) {
        const exist = yield* fs.exists(_)
        if (exist) {
          return _
        }
        return acc
      }),
    ).pipe(Effect.withSpan('build.find-tsconfig'), Effect.orDie)

    // read routes.json
    const routesJson = yield* fs.readFileString(`${workspace.projectOutput.dist}/client/_routes.json`, 'utf-8').pipe(
      Effect.andThen(
        (_) =>
          JSON.parse(_) as {
            include: string[]
            exclude: string[]
          },
      ),
      Effect.orDieWith(() => 'read routes.json failed'),
      Effect.withSpan('build.read-routes-config', {
        attributes: { routesPath: `${workspace.projectOutput.dist}/client/_routes.json` },
      }),
    )

    yield* pipe(
      Effect.tryPromise({
        try: () =>
          bundler.build({
            cwd: workspace.projectOutput.dist,
            input: workerTemplate,
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
              routingRulesJsonPlugin({
                exclude: routesJson.exclude,
                include: ['/__manifest*', '*.data', ...routesJson.include],
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
              alias: {
                ENTRY_POINT_MAKE: workerEntry,
                ENTRY_POINT_APP: `${workspace.projectPath}/context.prod.ts`,
                ENTRY_POINT_REACT_ROUTER_BUILD: `${workspace.projectOutput.dist}/server/index.js`,
                'react-router': path.join(workspace.root, 'node_modules/react-router/dist/production/index.mjs'),
                sonner: `${workspace.root}/scripts/thing/fix/sonner.js`,
                '@sanity/image-url': '@sanity/image-url/lib/browser/image-url.esm.mjs',
              },
            },
            treeshake: true,
            external: [/^cloudflare:/, /^node:/],
            output: {
              legalComments: 'none',
              keepNames: minify ? false : true,
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
              dir: workspace.projectOutput.dist,
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
              chunkFileNames: 'workers/[name].js',
              assetFileNames: 'workers/[name].[ext]',
            },
          }),
        catch: (error) => error,
      }),
      Effect.withSpan('build.esbuild-bundle', {
        attributes: {
          workerTemplate,
          outfile,
          minify,
          tsconfig: tsconfigPath,
          includeRulesCount: routesJson.include.length,
          excludeRulesCount: routesJson.exclude.length,
          projectName: workspace.projectName,
        },
      }),
      Effect.orDie,
    )

    // get output file size
    const outfileSize = yield* fs.readDirectory(workspace.projectOutput.dist, { recursive: true }).pipe(
      Effect.map((files) => files.filter((path) => !path.startsWith('client') && path.endsWith('.js'))),
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

    // Get detailed client directory structure and sizes
    const getClientDirectoryInfo = Effect.gen(function* () {
      const clientPath = path.join(workspace.projectOutput.dist, 'client')

      // Get JS and CSS files size in assets directory
      const assetsJsCssSize = yield* pipe(
        shellInPath(workspace.projectOutput.dist)`
          $ find client/assets -type f \\( -name "*.js" -o -name "*-*.js" -o -name "*.css" -o -name "*-*.css" -o -name "*.wasm" \\) -exec du -ch {} + 2>/dev/null || true
        `,
        Effect.map((result) => {
          const lines = result.stdout.split('\n')
          // Find the total line (ends with "total")
          const totalLine = lines.find((line) => line.includes('total'))
          const total = totalLine ? totalLine.split('\t')[0] : 'unknown'

          const files = lines
            .filter((line) => line && !line.includes('total'))
            .map((line) => {
              const [size, path] = line.split('\t')
              const ext = path.split('.').pop() || ''
              return {
                path: path.replace('client/assets/', ''),
                size: size.trim(),
                type: ext,
              }
            })

          // Convert size strings like "144K" to bytes for accurate calculation
          const parseSize = (size: string): number => {
            const num = Number.parseFloat(size)
            const unit = size.replace(/[\d.]/g, '').toUpperCase()
            const multipliers: Record<string, number> = {
              B: 1,
              K: 1024,
              M: 1024 * 1024,
              G: 1024 * 1024 * 1024,
            }
            return num * (multipliers[unit] || 1)
          }

          // sort files by size "filename (size)"
          const jsFiles = files.filter((f) => f.type === 'js').sort((a, b) => parseSize(b.size) - parseSize(a.size))
          const cssFiles = files.filter((f) => f.type === 'css').sort((a, b) => parseSize(b.size) - parseSize(a.size))
          const wasmFiles = files.filter((f) => f.type === 'wasm').sort((a, b) => parseSize(b.size) - parseSize(a.size))

          return {
            total,
            files,
            jsSize: jsFiles.reduce((acc, f) => acc + parseSize(f.size), 0),
            cssSize: cssFiles.reduce((acc, f) => acc + parseSize(f.size), 0),
            wasmSize: wasmFiles.reduce((acc, f) => acc + parseSize(f.size), 0),
            jsFiles,
            cssFiles,
            wasmFiles,
          }
        }),
        Effect.orElseSucceed(() => ({
          total: 'unknown',
          files: [],
          jsSize: 0,
          cssSize: 0,
          wasmSize: 0,
          jsFiles: [],
          cssFiles: [],
          wasmFiles: [],
        })),
      )

      const dirInfo = yield* pipe(
        shellInPath(workspace.projectOutput.dist)`
          $ du -sh client/assets client/fonts client/images 2>/dev/null || true
        `,
        Effect.map((result) => {
          const sizes = result.stdout
            .split('\n')
            .filter(Boolean)
            .map((line) => {
              const [size, path] = line.split('\t')
              return { path: path.replace('client/', ''), size }
            })
          return sizes
        }),
        Effect.orElseSucceed(() => []),
      )

      // Get service worker info if exists
      const hasServiceWorkers = yield* fs.exists(path.join(clientPath, 'sw.js'))
      const swSize = hasServiceWorkers
        ? yield* fs.stat(path.join(clientPath, 'sw.js')).pipe(
            Effect.map((stat) => formatSize(stat.size)),
            Effect.orElseSucceed(() => 'unknown'),
          )
        : 'not found'

      return { dirInfo, swSize, assetsJsCssSize }
    })

    const clientInfo = yield* getClientDirectoryInfo.pipe(Effect.withSpan('build.getClientDirectoryInfo'), Effect.orDie)
    const clientJsAssetsSize = yield* shellInPath(workspace.projectOutput.dist)`
      $ du -sh client
    `.pipe(
      Effect.map((_) => _.stdout.split('\t')[0]),
      Effect.orElseSucceed(() => 'unknown'),
    )

    // client directory
    // - assets (js, css, svg, images, etc.)
    // - fonts
    // - images
    // - sw.js

    yield* shellInPath(workspace.projectOutput.dist)`
      $ mv ./${clientStatic} ./${workersStatic}
      $ rm -rf server
    `.pipe(Effect.withSpan('build.output-cleanup'), Effect.orDie)

    return yield* Effect.logDebug('React router build finished').pipe(
      Effect.annotateLogs({
        'client assets size': clientJsAssetsSize.toString(),
        'client sw.js size': clientInfo.swSize,
        'client directory structure': clientInfo.dirInfo,
        'assets js/css files': {
          'total size': clientInfo.assetsJsCssSize.total,
          'js files size': formatSize(clientInfo.assetsJsCssSize.jsSize),
          'css files size': formatSize(clientInfo.assetsJsCssSize.cssSize),
          'wasm files size': formatSize(clientInfo.assetsJsCssSize.wasmSize),
          'file count': clientInfo.assetsJsCssSize.files.length,
          'js files': clientInfo.assetsJsCssSize.jsFiles.map((f) => `${f.path} (${f.size})`),
          'css files': clientInfo.assetsJsCssSize.cssFiles.map((f) => `${f.path} (${f.size})`),
          'wasm files': clientInfo.assetsJsCssSize.wasmFiles.map((f) => `${f.path} (${f.size})`),
        },
        'workers bundle size': formatSize(outfileSize),
      }),
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
      nodeEnv: parameters.env.NODE_ENV,
      dist: workspace.projectOutput.dist,
      stage: parameters.target.stage,
      env: parameters.env,
    }).pipe(
      Effect.provideService(FileSystem.FileSystem, fs),
      Effect.provideService(Path.Path, path),
      Effect.provideService(Git, git),
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
  }).pipe(Effect.withSpan('cloudflare.deploy-react-router'))

  return Deployment.of({
    deploy,
    build,
  })
})

export const ReactRouterOnCloudflare = Layer.scoped(Deployment, make).pipe(Layer.provide(CF.Live))

function routingRulesJsonPlugin(routingRulesData: any): Plugin {
  return {
    name: 'routing-rules-json-plugin',
    transform: {
      filter: {
        id: /react-router\/templates\/index.js$/,
      },
      handler(code) {
        const jsonData = JSON.stringify(routingRulesData, null, 2)
        const replacementCode = `const routingRules = ${jsonData}`

        return code.replace("import { routingRules } from 'ENTRY_POINT_ROUTING_RULES'", replacementCode)
      },
    },
  }
}
