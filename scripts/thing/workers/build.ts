import { Effect } from 'effect'
import { Deployment } from '../deployment'
import type { BuildSubcommand } from '../domain'

export const start = Effect.fn('workers.build-start')(function* (subcommand: BuildSubcommand) {
  yield* Effect.annotateCurrentSpan({
    target: subcommand.target._tag,
    stage: subcommand.stage,
    nodeEnv: subcommand.nodeEnv,
    minify: subcommand.minify,
  })

  if (subcommand.target._tag !== 'BuildWorkers') {
    return yield* Effect.dieMessage('Invalid provider')
  }

  const deployment = yield* Deployment

  yield* deployment.build

  yield* Effect.logInfo('Build completed successfully')
})
