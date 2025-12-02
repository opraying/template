import * as dotenv from '@dotenvx/dotenvx'
import { FileSystem, Path } from '@effect/platform'
import { ConfigProvider, Effect, type LogLevel } from 'effect'
import type { NodeEnv, Stage } from './domain'
import type { Workspace } from './workspace'

/**
 * .env = local env
 * .env.test = test env
 * .env.staging = staging env
 * .env.production = production env
 */
const DEFAULT_ENV_FILE = '.env'

const ignoreEnv = [
  'DOTENV_PUBLIC_KEY',
  'DOTENV_PUBLIC_KEY_TEST',
  'DOTENV_PUBLIC_KEY_PRODUCTION',
  'CLOUDFLARE_API_TOKEN',
  'CLOUDFLARE_ACCOUNT_ID',
]

export interface MakeEnvOptions {
  mode: 'serve' | 'build'
  nodeEnv: NodeEnv
  stage: Stage
  workspace: Workspace
  envs?: Record<string, any>
}

export const make = Effect.fn('environment.make')(function* ({
  nodeEnv,
  stage,
  workspace,
  envs = {},
  mode,
}: MakeEnvOptions) {
  const fs = yield* FileSystem.FileSystem
  const path = yield* Path.Path

  yield* Effect.annotateCurrentSpan({
    mode: 'build',
    nodeEnv: nodeEnv,
    stage: stage,
    projectName: workspace.projectName,
    envs,
  })

  /**
   * .env 文件已 server 目录下的为基准
   *
   * 如果 projectName 以 web 结尾，则认为是 web 项目
   * 如果 projectName 以 desktop 结尾，则认为是 desktop 项目
   */
  const envFiles: string[] = []

  const hasServer = yield* fs.exists(path.join(workspace.projectRoot, 'server'))

  if (hasServer) {
    envFiles.push(path.join(workspace.projectRoot, 'server', DEFAULT_ENV_FILE))
  }

  // 使用项目目录下的默认配置
  envFiles.push(path.join(workspace.projectPath, DEFAULT_ENV_FILE))

  let defaultEnv = yield* Effect.sync(
    () =>
      dotenv.config({
        envKeysFile: path.join(workspace.root, '.env.keys'),
        path: envFiles,
        quiet: true,
        ignore: ['MISSING_ENV_FILE'],
        processEnv: {},
      }).parsed || {},
  ).pipe(Effect.withSpan('dotenv.load'))

  const stageEnvFiles = envFiles
    .map((file) => `${file}.${stage}`)
    .filter((filePath) => {
      /**
       * ignore .env.test file in serve mode
       */
      if (mode === 'serve') {
        return !filePath.endsWith('.env.test')
      }

      return true
    })

  const stageEnv = yield* Effect.sync(
    () =>
      dotenv.config({
        envKeysFile: path.join(workspace.root, '.env.keys'),
        path: stageEnvFiles,
        quiet: true,
        ignore: ['MISSING_ENV_FILE'],
        processEnv: {},
      }).parsed || {},
  ).pipe(Effect.withSpan('dotenv.load'))

  defaultEnv = {
    ...defaultEnv,
    ...stageEnv,
  }

  ignoreEnv.forEach((key) => {
    delete defaultEnv[key]
  })

  let githubEnv: Record<string, string> = {}
  if (process.env.CI && process.env.GITHUB_REPO) {
    const { context } = yield* Effect.promise(() => import('@actions/github'))

    githubEnv = {
      GITHUB_SHA: context.sha,
      GITHUB_OWNER: context.repo.owner,
      GITHUB_REPO: context.repo.repo,
      GITHUB_BRANCH: context.ref,
    }
  }

  const saveAllEnv = {
    ...defaultEnv,
    STAGE: stage,
    NODE_ENV: nodeEnv,
  } as Record<string, any>

  saveAllEnv.LOG_LEVEL =
    saveAllEnv.LOG_LEVEL ??
    ((nodeEnv === 'development' || stage !== 'production' ? 'All' : 'Warning') satisfies LogLevel.Literal)

  const allEnv: Record<string, string> = {
    ...saveAllEnv,
    ...githubEnv,
  }

  // write env file to dist folder
  const saveIgnoreEnv = ['PORT', ...ignoreEnv]
  const envPath = `${workspace.projectOutput.dist}/${DEFAULT_ENV_FILE}`

  const saveEnvContent = Object.entries(saveAllEnv)
    .filter(([key]) => {
      // ignore all env in saveIgnoreEnv
      return !saveIgnoreEnv.includes(key)
    })
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')

  const envMap = new Map(Object.entries(allEnv).map(([key, value]) => [key, value]))

  process.env.SANITY_STUDIO_API_TOKEN = allEnv.SANITY_STUDIO_API_TOKEN
  process.env.SANITY_STUDIO_DATASET = allEnv.SANITY_STUDIO_DATASET
  process.env.SANITY_STUDIO_PROJECT_ID = allEnv.SANITY_STUDIO_PROJECT_ID

  return {
    env: { ...allEnv, ...envs },
    configProvider: ConfigProvider.fromMap(envMap).pipe(ConfigProvider.orElse(() => ConfigProvider.fromEnv())),
    save: Effect.withSpan(fs.writeFileString(envPath, saveEnvContent), 'environment.saveAsFile'),
  }
})

export interface LoadEnvOptions {
  workspace: Workspace
}

export const loadEnv = Effect.fn('environment.loadEnv')(function* ({ workspace }: LoadEnvOptions) {
  const path = yield* Path.Path
  const envPath = `${workspace.projectOutput.dist}/${DEFAULT_ENV_FILE}`
  const fileEnv = yield* Effect.sync(
    () =>
      dotenv.config({
        envKeysFile: path.join(workspace.root, '.env.keys'),
        path: envPath,
        quiet: true,
        ignore: ['MISSING_ENV_FILE'],
        processEnv: {},
      }).parsed || {},
  ).pipe(Effect.withSpan('dotenv.load'))

  let githubEnv: Record<string, string> = {}
  if (process.env.CI && process.env.GITHUB_REPO) {
    const { context } = yield* Effect.promise(() => import('@actions/github'))

    githubEnv = {
      GITHUB_SHA: context.sha,
      GITHUB_OWNER: context.repo.owner,
      GITHUB_REPO: context.repo.repo,
      GITHUB_BRANCH: context.ref,
    }
  }

  const allEnv = {
    ...fileEnv,
    ...githubEnv,
  }

  const envMap = new Map(Object.entries(allEnv).map(([key, value]) => [key, value]))

  process.env.SANITY_STUDIO_API_TOKEN = allEnv.SANITY_STUDIO_API_TOKEN
  process.env.SANITY_STUDIO_DATASET = allEnv.SANITY_STUDIO_DATASET
  process.env.SANITY_STUDIO_PROJECT_ID = allEnv.SANITY_STUDIO_PROJECT_ID

  return {
    env: allEnv,
    configProvider: ConfigProvider.fromMap(envMap).pipe(ConfigProvider.orElse(() => ConfigProvider.fromEnv())),
  }
})
