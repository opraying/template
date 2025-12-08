import { Command } from '@effect/cli'
import { TestSubcommand } from './domain'
import {
  testAllOption,
  testBrowserOption,
  testHeadlessOption,
  testModeOption,
  testProjectOption,
  testWatchOption,
} from './options'
import { runTest } from './subcommand'

const testCommand = Command.make(
  'test',
  {
    project: testProjectOption,
    mode: testModeOption,
    all: testAllOption,
    watch: testWatchOption,
    browser: testBrowserOption,
    headless: testHeadlessOption,
  },
  (config) =>
    runTest(
      TestSubcommand({
        project: config.project,
        mode: config.mode,
        all: config.all,
        watch: config.watch,
        browser: config.browser,
        headless: config.headless,
      }),
    ),
)

export { testCommand }
