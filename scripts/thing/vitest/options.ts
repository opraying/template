import { Options } from '@effect/cli'

const testProjectOption = Options.text('project').pipe(
  Options.withDescription('Nx project name whose Vitest config should run'),
)

const testModeOption = Options.choice('mode', ['unit', 'e2e', 'browser'] as const).pipe(
  Options.withDescription('Vitest mode to run'),
  Options.withDefault('unit'),
)

const testAllOption = Options.boolean('all').pipe(
  Options.withDescription('Run all matching projects regardless of mode'),
  Options.withDefault(false),
)

const testWatchOption = Options.boolean('watch').pipe(
  Options.withDescription('Enable Vitest watch mode'),
  Options.withDefault(false),
)

const testBrowserOption = Options.choice('browser', ['chromium', 'firefox', 'webkit', 'all'] as const).pipe(
  Options.withDescription('Browser target when running in browser mode'),
  Options.withDefault('chromium'),
)

const testHeadlessOption = Options.boolean('headless', { negationNames: ['no-headless'] }).pipe(
  Options.withDescription('Run browsers in headless mode'),
  Options.withDefault(true),
)

export { testAllOption, testBrowserOption, testHeadlessOption, testModeOption, testProjectOption, testWatchOption }
