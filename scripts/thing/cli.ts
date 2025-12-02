import { Command, HelpDoc, Options } from '@effect/cli'
import { FileSystem, Path } from '@effect/platform'
import { Effect, Schema } from 'effect'
import * as Commands from './domain'
import { detectStage } from './git'
import * as Workspace from './workspace'

const cwdOption = Options.text('cwd').pipe(
  Options.withDescription('The current working directory'),
  Options.withDefault(process.cwd()),
)

const nodeEnvOption = Options.choice('node-env', ['production', 'development']).pipe(
  Options.withDescription('The node environment (env.NODE_ENV)'),
  Options.withDefault('production'),
)

const stageOption = Options.choice('stage', ['production', 'staging', 'test']).pipe(
  Options.withDescription('The stage'),
  Options.optional,
)

const minifyOption = Options.boolean('minify', { ifPresent: false }).pipe(
  Options.withDescription('Minify the build'),
  Options.withDefault(true),
)

const analyzeOption = Options.boolean('analyze', { ifPresent: false }).pipe(
  Options.withDescription('analyze the build'),
  Options.withDefault(false),
)

const RuntimeOption = Options.choice('runtime', ['cloudflare-workers']).pipe(
  Options.withDescription('The runtime to deploy to'),
  Options.withDefault('cloudflare-workers'),
)

const verboseOption = Options.boolean('verbose', { aliases: ['v'], ifPresent: false }).pipe(
  Options.withDescription('Show verbose logs'),
  Options.withDefault(true),
)

/**
 * - React Router (SSR/SPA) mode
 * - Worker
 */

const getReactRouterOptions = Effect.fn('react-router.get-options')(function* (cwd: string) {
  const path = yield* Path.Path
  const fs = yield* FileSystem.FileSystem

  // exist functions dir
  const isReactRouter = yield* fs.exists(path.join(cwd, 'root.tsx'))

  if (isReactRouter) {
    // check src-tauri directory exists
    const isDesktop = yield* fs.exists(path.join(cwd, 'src-tauri/tauri.conf.json'))
    // TODO: more logic to check if it's a spa mode
    const isSpaMode = isDesktop

    return { isSpaMode, isDesktop }
  }

  return { isSpaMode: false, isDesktop: false }
})

const checkProjectType = Effect.fn('checkProjectType')(function* (cwd: string) {
  const path = yield* Path.Path
  const fs = yield* FileSystem.FileSystem

  const isReactRouter = yield* fs.exists(path.join(cwd, 'root.tsx'))

  if (isReactRouter) {
    return {
      type: 'react-router',
      command: yield* Effect.promise(() => import('./react-router/subcommand')).pipe(
        Effect.withSpan('subcommand.react-router-serve.import'),
      ),
    } as const
  }

  return {
    type: 'workers',
    command: yield* Effect.promise(() => import('./workers/subcommand')).pipe(
      Effect.withSpan('subcommand.workers-serve.import'),
    ),
  } as const
})

const loadDistProject = Effect.fn('loadDistProject')(function* (cwd: string) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path

  const workspace = yield* Workspace.make(cwd)
  const [distExist, buildConfig] = yield* Effect.all([
    fs.exists(workspace.projectOutput.dist),
    fs.exists(path.join(workspace.projectOutput.dist, 'build.json')),
  ])

  if (!distExist) {
    return yield* Effect.dieMessage('dist folder not found')
  }

  if (!buildConfig) {
    return yield* Effect.dieMessage('build config not found')
  }

  const buildJson = yield* fs.readFileString(path.join(workspace.projectOutput.dist, 'build.json')).pipe(
    Effect.map(JSON.parse),
    Effect.mapError((e: any) => new Error(`Failed to read build.json: ${e.message}`)),
  )

  const parse = Schema.decodeUnknown(Commands.TargetSchema)

  const buildTarget = yield* parse(buildJson)

  process.env.NODE_ENV = 'production'
  process.env.STAGE = buildTarget.stage

  return {
    buildTarget,
    workspace,
  }
})

const thingServe = Command.make(
  'serve',
  {
    cwd: cwdOption,
    verbose: verboseOption,
  },
  Effect.fn('command.serve')(function* (options) {
    yield* Effect.annotateCurrentSpan({
      cwd: options.cwd,
    })

    process.env.STAGE = 'test'
    process.env.NODE_ENV = 'development'

    const { type, command } = yield* checkProjectType(options.cwd)

    let target: Commands.BuildTarget

    if (type === 'react-router') {
      const reactRouterOptions = yield* getReactRouterOptions(options.cwd)

      if (reactRouterOptions.isDesktop) {
        process.env.DESKTOP = 'true'
      }

      target = Commands.BuildReactRouterTarget({
        runtime: 'cloudflare-workers',
        options: reactRouterOptions,
        stage: process.env.STAGE,
      })
    } else {
      target = Commands.BuildWorkersTarget({
        runtime: 'cloudflare-workers',
        options: {},
        stage: process.env.STAGE,
      })
    }

    const subcommand = Commands.ServeSubcommand({
      ...options,
      target,
    })

    const workspace = yield* Workspace.make(subcommand.cwd)

    return yield* command.serve(workspace, subcommand)
  }),
).pipe(Command.withDescription('Start development server with hot reload'))

const thingBuild = Command.make(
  'build',
  {
    cwd: cwdOption,
    nodeEnv: nodeEnvOption,
    stage: stageOption,
    minify: minifyOption,
    analyze: analyzeOption,
    runtime: RuntimeOption,
    verbose: verboseOption,
  },
  Effect.fn('command.build')(function* (options) {
    yield* detectStage(options.stage)

    process.env.NODE_ENV = options.nodeEnv

    const { type, command } = yield* checkProjectType(options.cwd)

    yield* Effect.annotateCurrentSpan({
      type,
      cwd: options.cwd,
      runtime: options.runtime,
      stage: options.stage,
      minify: options.minify,
      analyze: options.analyze,
    })

    const workspace = yield* Workspace.make(options.cwd)

    if (type === 'react-router') {
      const reactRouterOptions = yield* getReactRouterOptions(options.cwd)

      if (reactRouterOptions.isDesktop) {
        process.env.DESKTOP = 'true'
      }

      const target = Commands.BuildReactRouterTarget({
        runtime: options.runtime,
        options: reactRouterOptions,
        stage: process.env.STAGE,
      })

      const subcommand = Commands.BuildSubcommand({
        ...options,
        stage: process.env.STAGE,
        target,
      })

      yield* command.build(workspace, subcommand)
    } else {
      const target = Commands.BuildWorkersTarget({
        runtime: options.runtime,
        options: {},
        stage: process.env.STAGE,
      })

      const subcommand = Commands.BuildSubcommand({
        ...options,
        target,
        stage: process.env.STAGE,
        analyze: false,
      })

      yield* command.build(workspace, subcommand)
    }
  }),
).pipe(Command.withDescription('Build project for production deployment (outputs to dist/ with build.json config)'))

const thingDeploy = Command.make(
  'deploy',
  {
    cwd: cwdOption,
    verbose: verboseOption,
  },
  Effect.fn('command.deploy')(function* (options) {
    yield* Effect.annotateCurrentSpan({
      cwd: options.cwd,
      verbose: options.verbose,
    })

    const { buildTarget, workspace } = yield* loadDistProject(options.cwd)

    const subcommand = Commands.DeploySubcommand({
      ...options,
    })

    const { command } = yield* checkProjectType(options.cwd)

    yield* command.deploy(workspace, subcommand, buildTarget)
  }),
).pipe(Command.withDescription('Deploy built project to production (requires existing dist/ folder from build)'))

const thingPreview = Command.make(
  'preview',
  {
    cwd: cwdOption,
    verbose: verboseOption,
  },
  Effect.fn('command.preview')(function* (options) {
    yield* Effect.annotateCurrentSpan({
      cwd: options.cwd,
      verbose: options.verbose,
    })

    const { buildTarget, workspace } = yield* loadDistProject(options.cwd)

    const subcommand = Commands.PreviewSubcommand({
      ...options,
    })

    const { command } = yield* checkProjectType(options.cwd)

    return yield* command.preview(workspace, subcommand, buildTarget)
  }),
).pipe(Command.withDescription('Preview built project locally before deployment (requires existing dist/ folder)'))

// Database

const databaseOption = Options.text('database').pipe(
  Options.withAlias('db'),
  Options.withDescription('Database name (optional, uses default if not specified)'),
  Options.withDefault(''),
)

const dbSeed = Command.make(
  'seed',
  {
    cwd: cwdOption,
    database: databaseOption,
    file: Options.file('file').pipe(
      Options.withDescription('Specific seed file to execute'),
      Options.withDefault(undefined),
    ),
  },
  Effect.fn('command.db-seed')(function* (options) {
    yield* Effect.annotateCurrentSpan({
      database: options.database,
      hasFile: !!options.file,
    })

    yield* detectStage()

    const subcommand = Commands.DatabaseSeedSubcommand({
      ...options,
    })

    const workspace = yield* Workspace.make(subcommand.cwd)

    const command = yield* Effect.promise(() => import('./database/subcommand'))

    yield* command.seed(workspace, subcommand)
  }),
).pipe(Command.withDescription('Populate database with seed data'))

const dbPush = Command.make(
  'push',
  {
    cwd: cwdOption,
    database: databaseOption,
    skipSeed: Options.boolean('skip-seed').pipe(
      Options.withDescription('Skip seeding the database'),
      Options.withDefault(false),
    ),
    skipDump: Options.boolean('skip-dump').pipe(
      Options.withDescription('Skip dumping the database'),
      Options.withDefault(false),
    ),
  },
  Effect.fn('command.db-push')(function* (options) {
    yield* Effect.annotateCurrentSpan({
      database: options.database,
      skipSeed: options.skipSeed,
      skipDump: options.skipDump,
    })

    yield* detectStage()

    const subcommand = Commands.DatabasePushSubcommand({
      ...options,
    })

    const workspace = yield* Workspace.make(subcommand.cwd)

    const command = yield* Effect.promise(() => import('./database/subcommand'))

    yield* command.push(workspace, subcommand)
  }),
).pipe(Command.withDescription('Push schema changes to database (dev migration)'))

const dbExecute = Command.make(
  'execute',
  {
    cwd: cwdOption,
    database: databaseOption,
    sql: Options.text('sql').pipe(Options.withDescription('The SQL to execute')),
    file: Options.file('file').pipe(Options.withDescription('The file to execute')),
  },
  Effect.fn('command.db-execute')(function* (options) {
    yield* Effect.annotateCurrentSpan({
      database: options.database,
      hasFile: !!options.file,
      hasSql: !!options.sql,
    })

    yield* detectStage()

    const subcommand = Commands.DatabaseExecuteSubcommand({
      ...options,
    })

    const workspace = yield* Workspace.make(subcommand.cwd)
    const command = yield* Effect.promise(() => import('./database/subcommand'))

    yield* command.execute(workspace, subcommand)
  }),
).pipe(Command.withDescription('Execute SQL query or file against database'))

const dbDump = Command.make(
  'dump',
  {
    cwd: cwdOption,
    database: databaseOption,
  },
  Effect.fn('command.db-dump')(function* (options) {
    yield* Effect.annotateCurrentSpan({
      database: options.database,
    })

    yield* detectStage()

    const subcommand = Commands.DatabaseDumpSubcommand({
      ...options,
    })

    const workspace = yield* Workspace.make(subcommand.cwd)
    const command = yield* Effect.promise(() => import('./database/subcommand'))

    yield* command.dump(workspace, subcommand)
  }),
).pipe(Command.withDescription('Export database schema and data to files'))

const dbMigrateDev = Command.make(
  'dev',
  {
    cwd: cwdOption,
    database: databaseOption,
    migrationName: Options.text('migration-name').pipe(
      Options.withDescription('The migration name'),
      Options.withAlias('name'),
    ),
    skipSeed: Options.boolean('skip-seed').pipe(
      Options.withDescription('Skip seeding the database'),
      Options.withDefault(false),
    ),
    skipDump: Options.boolean('skip-dump').pipe(
      Options.withDescription('Skip dumping the database'),
      Options.withDefault(false),
    ),
  },
  Effect.fn('command.db-migrate')(function* (options) {
    yield* Effect.annotateCurrentSpan({
      database: options.database,
      migrationName: options.migrationName,
      skipSeed: options.skipSeed,
      skipDump: options.skipDump,
    })

    yield* detectStage()

    const subcommand = Commands.DatabaseMigrateDevSubcommand({
      ...options,
    })

    const workspace = yield* Workspace.make(subcommand.cwd)
    const command = yield* Effect.promise(() => import('./database/subcommand'))

    yield* command.dev(workspace, subcommand)
  }),
).pipe(Command.withDescription('Create and apply new migration for development'))

const dbReset = Command.make(
  'reset',
  {
    cwd: cwdOption,
    database: databaseOption,
    skipSeed: Options.boolean('skip-seed').pipe(
      Options.withDescription('Skip seeding the database'),
      Options.withDefault(false),
    ),
  },
  Effect.fn('command.db-reset')(function* (options) {
    yield* Effect.annotateCurrentSpan({
      database: options.database,
      skipSeed: options.skipSeed,
    })

    yield* detectStage()

    const subcommand = Commands.DatabaseMigrateResetSubcommand({
      ...options,
    })

    const workspace = yield* Workspace.make(subcommand.cwd)

    const command = yield* Effect.promise(() => import('./database/subcommand'))

    yield* command.reset(workspace, subcommand)
  }),
).pipe(Command.withDescription('Reset database to initial state and re-run migrations'))
const dbDeploy = Command.make(
  'deploy',
  {
    cwd: cwdOption,
    database: databaseOption,
  },
  Effect.fn('command.db-deploy')(function* (options) {
    yield* Effect.annotateCurrentSpan({
      database: options.database,
    })

    yield* detectStage()

    const { workspace } = yield* loadDistProject(options.cwd)

    const subcommand = Commands.DatabaseMigrateDeploySubcommand({
      ...options,
    })

    const command = yield* Effect.promise(() => import('./database/subcommand'))

    return yield* command.deploy(workspace, subcommand)
  }),
).pipe(Command.withDescription('Deploy migrations to production database'))

const dbResolve = Command.make(
  'resolve',
  {
    cwd: cwdOption,
    database: databaseOption,
  },
  Effect.fn('command.db-resolve')(function* (options) {
    yield* Effect.annotateCurrentSpan({
      database: options.database,
    })

    yield* detectStage()

    const subcommand = Commands.DatabaseMigrateResolveSubcommand({
      ...options,
    })

    const workspace = yield* Workspace.make(subcommand.cwd)
    const command = yield* Effect.promise(() => import('./database/subcommand'))

    return yield* command.resolve(workspace, subcommand)
  }),
).pipe(Command.withDescription('Resolve migration conflicts and mark as applied'))

const dbMigrate = Command.make('migrate').pipe(
  Command.withDescription('Database migration management'),
  Command.withSubcommands([dbMigrateDev, dbReset, dbDeploy, dbResolve]),
)

const thingDB = Command.make('db').pipe(
  Command.withDescription('Database commands'),
  Command.withSubcommands([dbSeed, dbDump, dbPush, dbExecute, dbMigrate]),
)

const thingAnalyze = Command.make('analyze').pipe(Command.withDescription('Analyze project structure and dependencies'))

// build local jsx-email
const emailBuild = Command.make(
  'build',
  {
    cwd: cwdOption,
  },
  Effect.fn('command.email-build')(function* (options) {
    const subcommand = Commands.EmailBuildSubcommand({
      ...options,
    })

    const workspace = yield* Workspace.make(subcommand.cwd)
    const command = yield* Effect.promise(() => import('./email')).pipe(
      Effect.withSpan('subcommand.email-build.import'),
    )

    yield* command.build(workspace, subcommand)
  }),
).pipe(Command.withDescription('Build JSX email templates for deployment'))

const emailDeploy = Command.make(
  'deploy',
  {
    cwd: cwdOption,
    stage: stageOption,
  },
  Effect.fn('command.email-deploy')(function* (options) {
    yield* detectStage(options.stage)

    const subcommand = Commands.EmailDeploySubcommand({
      ...options,
      stage: process.env.STAGE,
    })

    const workspace = yield* Workspace.make(subcommand.cwd)
    const command = yield* Effect.promise(() => import('./email')).pipe(
      Effect.withSpan('subcommand.email-deploy.import'),
    )

    yield* command.deploy(workspace, subcommand)
  }),
).pipe(Command.withDescription('Deploy JSX email templates to specified stage'))

const thingEmail = Command.make('email').pipe(
  Command.withDescription('JSX email template management'),
  Command.withSubcommands([emailBuild, emailDeploy]),
)

const projectOption = Options.text('project').pipe(
  Options.withDescription('The project name (e.g., infra-emailer, pkgs-atom-react)'),
)

const projectAllOption = Options.boolean('all').pipe(
  Options.withDescription('Run all tests for project'),
  Options.withDefault(false),
)

const modeOption = Options.choice('mode', ['unit', 'e2e', 'browser'] as const).pipe(
  Options.withDescription('The test mode to run'),
  Options.withDefault('unit'),
)

const watchOption = Options.boolean('watch').pipe(Options.withDefault(false))

const headlessOption = Options.boolean('headless', { ifPresent: false }).pipe(
  Options.withDescription('Run browser tests in headless mode'),
  Options.withDefault(true),
)

const browserOption = Options.choice('browser', ['chromium', 'firefox', 'webkit', 'all']).pipe(
  Options.withDescription('Browser to use for tests'),
  Options.withDefault('chromium'),
)

const thingTest = Command.make('test', {
  project: projectOption,
  all: projectAllOption,
  mode: modeOption,
  watch: watchOption,
  headless: headlessOption,
  browser: browserOption,
}).pipe(
  Command.withHandler((options) =>
    Effect.gen(function* () {
      const subcommand = Commands.TestSubcommand({ ...options })
      const command = yield* Effect.promise(() => import('./vitest/subcommand')).pipe(
        Effect.withSpan('subcommand.vitest.import'),
      )

      yield* command.runTest(subcommand)
    }),
  ),
  Command.withDescription('Run tests for a specific project and mode'),
)

export const xdevCommand = Command.make('xdev').pipe(
  Command.withSubcommands([
    thingServe,
    thingBuild,
    thingPreview,
    thingDeploy,
    thingDB,
    thingAnalyze,
    thingEmail,
    thingTest,
  ]),
)

export const cli = xdevCommand.pipe(
  Command.withDescription('XStack development toolkit - build, serve, deploy React Router and Workers projects'),
  Command.run({
    name: 'XDev',
    version: '0.0.1',
    footer: HelpDoc.blocks([
      HelpDoc.h1('XStack XDev CLI'),
      HelpDoc.p('Development toolkit for React Router and Cloudflare Workers projects'),
      HelpDoc.h2('Common Usage Patterns:'),
      HelpDoc.p('• Development: xdev serve --cwd <project-path>'),
      HelpDoc.p('• Production: xdev build --cwd <project-path> && xdev deploy --cwd <project-path>'),
      HelpDoc.p('• Database: xdev db push --cwd <project-path> [--database <db-name>]'),
    ]),
  }),
)
