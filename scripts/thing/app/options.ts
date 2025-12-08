import { Options } from '@effect/cli'

const appCwdOption = Options.text('cwd').pipe(Options.withDescription('Path to the app to operate on'))

const appStageOption = Options.choice('stage', ['production', 'staging', 'test'] as const).pipe(
  Options.withDescription('Deployment stage for the current command'),
  Options.withDefault(undefined),
)

const appNodeEnvOption = Options.choice('node-env', ['development', 'production'] as const).pipe(
  Options.withDescription('NODE_ENV used for build pipelines'),
  Options.withDefault(undefined),
)

const appVerboseOption = Options.boolean('verbose').pipe(
  Options.withDescription('Enable verbose logging'),
  Options.withDefault(false),
)

const appAnalyzeOption = Options.boolean('analyze').pipe(
  Options.withDescription('Emit bundle analyzer output'),
  Options.withDefault(false),
)

const appMinifyOption = Options.boolean('minify', { negationNames: ['no-minify'] }).pipe(
  Options.withDescription('Minify production bundles (use --no-minify to disable)'),
  Options.withDefault(true),
)

export { appAnalyzeOption, appCwdOption, appMinifyOption, appNodeEnvOption, appStageOption, appVerboseOption }
