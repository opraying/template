import { Command, Path, FileSystem } from '@effect/platform'
import { Console, Effect, Stream } from 'effect'
import type { TestSubcommand } from './domain'
import { workspaceRoot } from '@nx/devkit'

export const runTest = Effect.fn(function* (subcommand: TestSubcommand) {
  const path = yield* Path.Path
  const fs = yield* FileSystem.FileSystem

  const { project, all, mode, watch, browser, headless } = subcommand

  // Get workspace root
  const vitestConfigPath = path.join(workspaceRoot, 'vitest.config.ts')

  // Check if vitest.config.ts exists
  const configExists = yield* fs.exists(vitestConfigPath)
  if (!configExists) {
    return yield* Effect.fail(new Error('vitest.config.ts not found in workspace root'))
  }

  // Import the vitest config to get test projects
  const vitestConfig = yield* Effect.promise(() => import(vitestConfigPath)).pipe(
    Effect.withSpan('test.import-vitest-config'),
  )

  const testProjects: any[] = vitestConfig.default?.test?.projects || []

  if (testProjects.length === 0) {
    return yield* Effect.logInfo('No test projects found in vitest.config.ts')
  }

  // Get all available test project names
  const availableTests = testProjects.map((p: any) => p.test?.name).filter(Boolean)

  // Build the project name pattern
  let projectPattern: string
  if (all) {
    projectPattern = `${project}:*`
  } else {
    if (mode) {
      projectPattern = `${project}:${mode}`
    } else {
      projectPattern = project
    }
  }

  // Build the vitest command arguments
  const args: string[] = []

  if (all) {
    args.push('--project')
    args.push(projectPattern)
  } else {
    // Find matching test projects
    const matchingTests = availableTests.filter((testName: string) => {
      if (mode) {
        return testName === projectPattern
      }

      return testName.startsWith(`${project}:`)
    })

    if (matchingTests.length === 0) {
      yield* Effect.logInfo(`No tests found for project: ${project}${mode ? ` with mode: ${mode}` : ''}`)
      yield* Effect.logInfo(`Available test projects:`).pipe(
        Effect.annotateLogs({
          projects: availableTests,
        }),
      )
      return
    }

    yield* Effect.logInfo(`Found ${matchingTests.length} matching test(s):`).pipe(
      Effect.annotateLogs({
        projects: matchingTests,
      }),
    )

    // Add project flags
    for (const name of matchingTests) {
      args.push('--project')
      args.push(name)
    }
  }

  // Add watch flag
  args.push(`--watch=${watch}`)

  // Add browser flags
  if (mode === 'browser' || all) {
    if (browser !== 'all') {
      args.push(`--browser.name=${browser}`)
    }
    args.push(`--browser.headless=${headless}`)
  }

  yield* Effect.logInfo('Running vitest with projects').pipe(Effect.annotateLogs({ args }))

  const outStream = Command.make('vitest', ...args).pipe(
    Command.workingDirectory(workspaceRoot),
    Command.stdin('inherit'),
    Command.stdout('pipe'),
    Command.stderr('inherit'),
    Command.streamLines,
  )

  yield* outStream.pipe(Stream.tap(Console.log), Stream.runDrain)
})
