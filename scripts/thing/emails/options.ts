import { Options } from '@effect/cli'
const emailCwdOption = Options.text('cwd').pipe(
  Options.withDescription('Absolute or relative path to the emails workspace'),
)

const emailStageOption = Options.choice('stage', ['production', 'staging', 'test'] as const).pipe(
  Options.withDescription('Deployment stage used for KV namespaces'),
  Options.withDefault('test'),
)

export { emailCwdOption, emailStageOption }
