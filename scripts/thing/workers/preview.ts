import { Path } from '@effect/platform'
import { Effect } from 'effect'
import type { Unstable_DevOptions } from 'wrangler'
import { BuildWorkersParameters, type BuildWorkersTarget, type PreviewSubcommand } from '../domain'
import { Workspace } from '../workspace'
import { unstableDev } from '../cloudflare/wrangler'

export const start = Effect.fn('workers.preview-start')(function* (
  _subcommand: PreviewSubcommand,
  buildTarget: BuildWorkersTarget,
) {
  const path = yield* Path.Path
  const workspace = yield* Workspace
  const parameters = yield* BuildWorkersParameters

  const script = path.join(workspace.projectOutput.dist, 'index.js')

  yield* Effect.annotateCurrentSpan({
    projectName: workspace.projectName,
    target: buildTarget._tag,
    stage: buildTarget.stage,
    runtime: buildTarget.runtime,
    script,
  })

  const devOptions: Unstable_DevOptions = {
    ip: '0.0.0.0',
    localProtocol: 'http',
    port: parameters.env.PORT ? Number.parseInt(parameters.env.PORT, 10) : 3000,
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
