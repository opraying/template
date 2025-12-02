import { Path } from '@effect/platform'
import { Effect, Struct } from 'effect'
import type { Unstable_DevOptions } from 'wrangler'
import { BuildWorkersParameters } from '../domain'
import { Workspace } from '../workspace'
import { unstableDev } from '../cloudflare/wrangler'

export const start = Effect.fn('workers.serve-start')(function* () {
  const path = yield* Path.Path
  const workspace = yield* Workspace
  const parameters = yield* BuildWorkersParameters

  const script = path.join(workspace.projectPath, 'index.ts')

  const port = parameters.env.PORT ? Number.parseInt(parameters.env.PORT, 10) : 3000
  const inspectorPort = port + 1

  const devOptions: Unstable_DevOptions = {
    ip: '0.0.0.0',
    localProtocol: 'http',
    port,
    inspectorPort,
    persist: true,
    persistTo: `${workspace.root}/.wrangler/state/`,
    vars: Struct.omit(parameters.env, 'PORT'),
    envFiles: [],
    config: path.join(workspace.projectPath, 'wrangler.jsonc'),
    bundle: true,
    moduleRoot: workspace.projectRoot,
    rules: [
      {
        globs: ['**/*.js'],
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
      additionalModules: [],
      testScheduled: true,
    },
  }

  return yield* unstableDev(script, devOptions)
})
