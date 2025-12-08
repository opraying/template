import { FileSystem } from '@effect/platform'
import { Effect, pipe } from 'effect'
import { Deployment } from '../deployment'
import { type BuildSubcommand } from '../domain'
import { BuildReactRouterParameters } from './domain'
import { shell, shellInPath } from '../utils/shell'
import { Workspace } from '../workspace'
import { fixPwaSwScript } from './scripts'

export const start = Effect.fn('react-router.build-start')(function* (subcommand: BuildSubcommand) {
  const workspace = yield* Workspace

  if (subcommand.target._tag !== 'BuildReactRouter') {
    return yield* Effect.dieMessage('Invalid provider')
  }

  yield* Effect.logInfo('React router build started')

  const fs = yield* FileSystem.FileSystem
  const parameters = yield* BuildReactRouterParameters
  const { isSpaMode, isDesktop } = subcommand.target.options

  const analyze = parameters.env.ANALYZE as boolean
  const minify = parameters.env.MINIFY as boolean

  const viteEnv = Object.entries(parameters.env)
    .filter(([key]) => key.startsWith('VITE_'))
    .reduce(
      (acc, [key, value]) => {
        acc[key] = value
        return acc
      },
      {} as Record<string, any>,
    )

  if (isSpaMode || isDesktop) {
    const mode = isDesktop ? 'DESKTOP' : 'SPA'
    const runShell = shellInPath(workspace.projectPath, {
      ...viteEnv,
      NODE_ENV: subcommand.nodeEnv,
      STAGE: subcommand.stage,
      DESKTOP: process.env.DESKTOP ?? false,
      ANALYZE: analyze,
      MINIFY: minify,
    })
    yield* Effect.logInfo(`Build App (${mode})`).pipe(
      Effect.andThen(
        runShell`
          $ BUILD_TARGET=client vite build -c vite.config.ts
          $ BUILD_TARGET=server vite build -c vite.config.ts --ssr
        `,
      ),
      Effect.withSpan('build.vite-build', {
        attributes: {
          mode,
          buildType: 'spa-desktop',
          clientBuild: true,
          serverBuild: true,
          analyze,
          minify,
          projectName: workspace.projectName,
        },
      }),
    )
  } else {
    const runShell = shellInPath(workspace.projectPath, {
      ...viteEnv,
      NODE_ENV: subcommand.nodeEnv,
      STAGE: subcommand.stage,
      DESKTOP: process.env.DESKTOP ?? false,
      ANALYZE: analyze,
      MINIFY: minify,
    })
    yield* Effect.logInfo('Build App (SSR MODE)').pipe(
      Effect.andThen(
        runShell`
          $ BUILD_TARGET=client vite build -c vite.config.ts
          $ BUILD_TARGET=server vite build -c vite.config.ts --ssr
        `,
      ),
      Effect.withSpan('build.vite-build', {
        attributes: {
          mode: 'SSR',
          buildType: 'ssr',
          clientBuild: true,
          serverBuild: true,
          analyze,
          minify,
          projectName: workspace.projectName,
        },
      }),
    )
  }

  // fix server/index.js
  yield* Effect.logInfo('Fix server/index.js').pipe(
    Effect.andThen(fs.readFileString(`${workspace.projectOutput.dist}/server/index.js`)),
    Effect.andThen((content) => {
      // dead import removal
      // example: import "package";
      const newContent = content.replace(/import\s+["'][^"']*["'];\s*\n/g, '')

      return fs.writeFileString(`${workspace.projectOutput.dist}/server/index.js`, newContent)
    }),
    Effect.withSpan('build.fix-server-index', {
      attributes: {
        serverIndexPath: `${workspace.projectOutput.dist}/server/index.js`,
        projectName: workspace.projectName,
      },
    }),
  )

  // PWA fix
  yield* Effect.logInfo('Fix PWA sw.js script').pipe(
    Effect.andThen(fixPwaSwScript(workspace, { minify })),
    Effect.orDie,
  )

  const deployment = yield* Deployment

  yield* deployment.build

  yield* Effect.logInfo('Cleanup build folder').pipe(
    Effect.andThen(
      shell`
        $ rm -rf ${workspace.projectOutput.dist}/package.json
        $ rm -rf ${workspace.projectOutput.dist}/public/.vite
      `,
    ),
    Effect.withSpan('build.cleanup-artifacts', {
      attributes: {
        projectName: workspace.projectName,
        distPath: workspace.projectOutput.dist,
        removedFiles: ['package.json', 'public/.vite'],
      },
    }),
  )

  if (isSpaMode) {
    yield* pipe(
      shellInPath(workspace.projectOutput.dist)`
        $ rm -rf ./client/_headers ./client/_redirects ./client/_routes.json
        $ zip -r client.zip ./client
      `,
      Effect.withSpan('build.spa-package', {
        attributes: {
          mode: 'SPA',
          packageType: 'zip',
          projectName: workspace.projectName,
          outputFile: 'client.zip',
        },
      }),
    )
    return
  }

  return yield* Effect.logInfo('Build completed successfully')
})
