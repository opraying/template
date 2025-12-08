import { Config, Context, Data, Effect, Layer, String, type Redacted } from 'effect'
import type { Stage } from './domain'
import { Git } from './git'

export interface GithubOptions {
  readonly token: Redacted.Redacted<string>
}

export class GithubError extends Data.TaggedError('GithubError')<{
  readonly reason: unknown
}> {}

// 完成
type DeploymentStatusFinish = {
  description: string
  logUrl: string
  state: 'success'
}

// 进行中
type DeploymentStatusInProgress = {
  description: string
  logUrl?: string | undefined
  state: 'queued' | 'pending' | 'in_progress' | 'failure' | 'error'
}

type UpdateDeploymentStatusParams = DeploymentStatusFinish | DeploymentStatusInProgress

// 成功
interface DeploymentSuccess {
  state: 'success'
  description: string
  branchUrls: string[]
  previewUrls: string[]
}
// 失败
interface DeploymentFailed {
  state: 'failure'
  description: string
  message: string
}
type FinishDeploymentParams = DeploymentSuccess | DeploymentFailed

interface CreateDeploymentParams {
  description: string
  stage: Stage
  environment: 'production' | 'preview'
}

const GitConfig = Config.all({
  GITHUB_TOKEN: Config.string('GITHUB_TOKEN'),
  GITHUB_OWNER: Config.string('GITHUB_OWNER'),
  GITHUB_REPO: Config.string('GITHUB_REPO'),
  GITHUB_SHA: Config.string('GITHUB_SHA'),
})

export class Github extends Context.Tag('@thing/github')<
  Github,
  {
    createDeployment: (params: CreateDeploymentParams) => Effect.Effect<{
      deploymentId: string
      update: (_: UpdateDeploymentStatusParams) => Effect.Effect<void>
      summary: (_: FinishDeploymentParams) => Effect.Effect<void>
    }>
  }
>() {
  static Live = Layer.effect(
    this,
    Effect.gen(function* () {
      yield* Effect.logInfo('Use octokit')

      const { GITHUB_OWNER, GITHUB_REPO, GITHUB_SHA, GITHUB_TOKEN } = yield* GitConfig

      const { summary } = yield* Effect.promise(() => import('@actions/core'))
      const { getOctokit } = yield* Effect.promise(() => import('@actions/github'))
      const octokit = getOctokit(GITHUB_TOKEN)
      const rest = octokit.rest

      type Endpoints = typeof rest

      const request = <A>(f: (_: Endpoints) => Promise<A>) =>
        Effect.tryPromise({
          try: () => f(rest),
          catch: (reason) => new GithubError({ reason }),
        })

      const createPageDeployment = (...args: Parameters<typeof octokit.rest.repos.createDeployment>) =>
        request((_) => _.repos.createDeployment(...args)).pipe(
          Effect.andThen((_) => {
            if (_.status === 201) {
              return Effect.succeed(_.data)
            }

            return Effect.fail(new GithubError({ reason: _.data.message }))
          }),
          Effect.orDie,
        )

      const createDeployment = Effect.fn('github.deployment.create')(function* ({
        description,
        environment,
        stage,
      }: CreateDeploymentParams) {
        const deployment = yield* createPageDeployment({
          owner: GITHUB_OWNER,
          ref: GITHUB_SHA,
          repo: GITHUB_REPO,
          description,
          environment: stage,
          production_environment: stage === 'production',
          auto_merge: false,
          required_contexts: [],
        })

        const deploymentId = deployment.id

        return {
          deploymentId: deploymentId.toString(),

          update: Effect.fn('github.deployment.update')(function* (params: UpdateDeploymentStatusParams) {
            yield* request((_) =>
              _.repos.createDeploymentStatus({
                owner: GITHUB_OWNER,
                repo: GITHUB_REPO,
                deployment_id: deploymentId,
                description,
                state: params.state,
                log_url: params.logUrl || '',
                environment: stage,
                auto_inactive: false,
              }),
            ).pipe(Effect.orDie)
          }),

          summary: Effect.fn('github.deployment.summary')(function* (params: FinishDeploymentParams) {
            const msg = formatSummary({
              jobName: params.description,
              lastCommit: GITHUB_SHA,
              stage,
              environment,
              status: params.state,
              message: params.state === 'success' ? '' : params.message,
              previewUrls: params.state === 'success' ? params.previewUrls : [],
              branchUrls: params.state === 'success' ? params.branchUrls : [],
            })

            if (process.env.GITHUB_STEP_SUMMARY) {
              yield* Effect.promise(() =>
                summary
                  .addRaw(msg)
                  .write()
                  .then(() => {}),
              )

              return
            }

            yield* Effect.logInfo(msg)
          }),
        }
      })

      return Github.of({
        createDeployment,
      })
    }),
  )

  static Local = Layer.effect(
    this,
    Effect.gen(function* () {
      const git = yield* Git

      const createDeployment = Effect.fn('github.deployment.create')(function* ({
        description,
        environment,
        stage,
      }: CreateDeploymentParams) {
        const id = 'mock github deployment id'
        const lastCommit = yield* git.lastCommit

        const msg = String.stripMargin(`
          |
          |Id:           ${id}
          |Description:  ${description}
          |Stage:        ${stage}
          |Environment:  ${environment}`)

        yield* Effect.logInfo(`Create github deployment${msg}`)

        return {
          deploymentId: id,

          update: Effect.fn('github.deployment.update')(function* (params: UpdateDeploymentStatusParams) {
            const msg = String.stripMargin(`
              |State:        ${params.state}
              |Description:  ${description}
              |Stage:        ${stage}
              |Environment:  ${environment}
              |LogUrl:       ${params.logUrl}`)

            yield* Effect.logInfo(`Update github deployment${msg}`)
          }),

          summary: Effect.fn('github.deployment.summary')(function* (params: FinishDeploymentParams) {
            const msg = formatSummary({
              jobName: params.description,
              status: params.state,
              lastCommit: lastCommit.sha,
              stage,
              environment,
              message: params.state === 'success' ? '' : params.message,
              previewUrls: params.state === 'success' ? params.previewUrls : [],
              branchUrls: params.state === 'success' ? params.branchUrls : [],
            })

            yield* Effect.logInfo(`Finish github deployment${msg}`)
          }),
        }
      })

      return Github.of({
        createDeployment,
      })
    }),
  ).pipe(Layer.provide(Git.Local))

  static Default = Layer.suspend(() => {
    return process.env.CI && process.env.GITHUB_REPO ? Github.Live : Github.Local
  })
}

const formatSummary = ({
  environment,
  jobName,
  lastCommit,
  message,
  branchUrls,
  previewUrls,
  stage,
  status,
}: {
  jobName: string
  status: 'success' | 'failure' | 'canceled' | 'skipped' | 'active' | 'idle'
  stage: Stage
  environment: 'production' | 'preview'
  message: string
  lastCommit: string
  branchUrls?: string[]
  previewUrls?: string[]
}) => {
  let statusText = '✅ Deployment succeeded'

  if (status === 'failure') {
    statusText = '🚫 Deployment failed'
  } else if (status === 'canceled') {
    statusText = '🚫 Deployment canceled'
  } else if (status === 'skipped') {
    statusText = '🚫 Deployment skipped'
  } else if (status === 'active' || status === 'idle') {
    statusText = '🚀 Deployment in progress'
  }

  // markdown
  let msg = `
# ${jobName}
| Name                    | Result |
| ----------------------- | -
| **Status**:             | ${statusText}
| **Last commit:**        | ${lastCommit}
| **Stage**:              | ${stage}
| **Environment**:        | ${environment}`

  if (message) {
    msg += `
| **Message**:            | ${message}`
  }

  if (previewUrls) {
    msg += `
| **Preview URL**:        | ${previewUrls.join('\n')}`
  }

  if (branchUrls) {
    msg += `
| **Branch Preview URL**: | ${branchUrls.join('\n')}`
  }

  return msg
}
