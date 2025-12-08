import { Data } from 'effect'

export interface TestSubcommand {
  readonly _tag: 'TestSubcommand'

  readonly project: string
  readonly all: boolean
  readonly mode: 'unit' | 'e2e' | 'browser'
  readonly watch: boolean
  readonly headless: boolean
  readonly browser: 'chromium' | 'firefox' | 'webkit' | 'all'
}
export const TestSubcommand = Data.tagged<TestSubcommand>('TestSubcommand')
