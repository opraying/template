import { FileSystem, Path } from '@effect/platform'
import { Effect } from 'effect'
import type { Unstable_DevOptions } from 'wrangler'
import { type PreviewSubcommand } from '../domain'
import { BuildReactRouterParameters, type BuildReactRouterTarget } from './domain'
import { Workspace } from '../workspace'
import { unstableDev } from '../cloudflare/wrangler'

export const start = Effect.fn('react-router.preview-start')(function* (
  _subcommand: PreviewSubcommand,
  _buildTarget: BuildReactRouterTarget,
) {
  const path = yield* Path.Path
  const fs = yield* FileSystem.FileSystem
  const workspace = yield* Workspace
  const parameters = yield* BuildReactRouterParameters

  const port = 8787

  // read json routes
  const routesJson = yield* fs
    .readFileString(path.join(workspace.projectOutput.dist, 'public/_routes.json'))
    .pipe(Effect.map((routes) => JSON.parse(routes)))

  const entryPoint = path.join(workspace.root, 'scripts/thing/react-router/templates/preview.js')
  const workerPath = path.join(workspace.projectOutput.dist, 'index.js')
  const workerContent = yield* fs.readFileString(workerPath)

  const devOptions: Unstable_DevOptions = {
    ip: '0.0.0.0',
    localProtocol: 'http',
    port,
    inspectorPort: 9229,
    persist: true,
    persistTo: `${workspace.root}/.wrangler/state/`,
    vars: { ...parameters.env, DISABLE_RATELIMIT: true },
    envFiles: [],
    config: path.join(workspace.projectOutput.dist, 'wrangler.jsonc'),
    bundle: false,
    moduleRoot: workspace.projectOutput.dist,
    rules: [
      {
        globs: ['workers/**/*.js'],
        type: 'ESModule',
      },
    ],
    experimental: {
      disableExperimentalWarning: true,
      testMode: false,
      disableDevRegistry: false,
      fileBasedRegistry: true,
      forceLocal: false,
      watch: true,
      liveReload: false,
      showInteractiveDevSession: false,
      devEnv: false,
      enablePagesAssetsServiceBinding: {
        directory: `${workspace.projectOutput.dist}/public`,
      },
      additionalModules: [
        {
          filePath: workerPath,
          content: workerContent,
          name: './worker.js',
        },
        {
          filePath: undefined,
          content: `export default ${JSON.stringify({
            exclude: routesJson.exclude,
            include: ['/__manifest*', '*.data', ...routesJson.include],
          })}`,
          name: './routes.js',
        },
      ],
      testScheduled: true,
    },
  }

  return yield* unstableDev(entryPoint, devOptions)
})
