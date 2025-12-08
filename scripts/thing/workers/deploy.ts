import { Cause, Effect, Exit, pipe } from 'effect'
import { Deployment } from '../deployment'
import { BuildWorkersParameters, type BuildWorkersTarget, type DeploySubcommand } from '../domain'
import { DatabaseMigrateDeploySubcommand } from '../database/domain'
import { EmailDeploySubcommand } from '../emails/domain'
import { Git } from '../git'
import { Github } from '../github'
import { Notification } from '../notification'
import { Workspace } from '../workspace'
import * as Database from '../database/subcommand'
import * as Email from '../emails/subcommand'

export const start = Effect.fn('workers.deploy-start')(function* (
  subcommand: DeploySubcommand,
  buildTarget: BuildWorkersTarget,
) {
  const workspace = yield* Workspace
  const parameters = yield* BuildWorkersParameters
  const deployment = yield* Deployment
  const notification = yield* Notification
  const git = yield* Git
  const github = yield* Github

  const [branch, lastCommit] = yield* Effect.all([git.branch, git.lastCommit], {
    concurrency: 'unbounded',
  })

  yield* Effect.annotateCurrentSpan({
    projectName: workspace.projectName,
    target: buildTarget._tag,
    stage: buildTarget.stage,
    runtime: buildTarget.runtime,
    isCI: !!process.env.CI,
    branch,
    lastCommit,
  })

  const tags = `Workers on ${parameters.target.runtime}`

  const environment = parameters.target.stage === 'production' ? 'production' : 'preview'
  const nodeEnv = parameters.nodeEnv
  const summary = {
    description: `Deploy ${workspace.projectName} (${tags})`,
  }

  const githubDeployment = yield* github.createDeployment({
    description: summary.description,
    stage: buildTarget.stage,
    environment,
  })

  const fail = (message: string) =>
    Effect.all(
      [
        Effect.logInfo('Deploy failed'),
        notification.failed({
          projectName: workspace.projectName,
          branch,
          hash: lastCommit.sha,
          message: lastCommit.message,
          environment,
          stage: buildTarget.stage,
          error: message,
          nodeEnv,
        }),
        githubDeployment.update({
          description: summary.description,
          state: 'failure',
        }),
        githubDeployment.summary({
          description: summary.description,
          state: 'failure',
          message,
        }),
      ],
      {
        concurrency: 'unbounded',
      },
    ).pipe(Effect.asVoid, Effect.orDie)

  const deployDB = Database.existDatabase(workspace).pipe(
    Effect.if({
      onFalse: () => Effect.void,
      onTrue: () =>
        Database.deploy(
          workspace,
          DatabaseMigrateDeploySubcommand({
            cwd: subcommand.cwd,
            // TODO
            database: '',
          }),
        ).pipe(Effect.tap(() => Effect.logInfo('Database deployed successfully'))),
    }),
  )

  const deployEmails = Email.existEmailProject(workspace).pipe(
    Effect.if({
      onFalse: () => Effect.void,
      onTrue: () => Email.deploy(workspace, EmailDeploySubcommand({ cwd: subcommand.cwd, stage: buildTarget.stage })),
    }),
  )

  const deployApp = deployment.deploy.pipe(Effect.tap(() => Effect.logInfo('Application deployed successfully')))

  const outputExit = yield* pipe(
    deployDB,
    Effect.zipRight(deployEmails),
    Effect.zipRight(deployApp),
    Effect.tap(({ logUrl, branchUrls, previewUrls, state }) =>
      Effect.all(
        [
          githubDeployment.update({
            description: summary.description,
            state,
            logUrl,
          }),
          githubDeployment.summary({
            description: summary.description,
            state,
            previewUrls,
            branchUrls,
          }),
          notification.success({
            projectName: workspace.projectName,
            environment,
            stage: buildTarget.stage,
            branch,
            hash: lastCommit.sha,
            message: lastCommit.message,
            previewUrls,
            branchUrls,
            logUrl,
            nodeEnv,
          }),
        ],
        {
          concurrency: 'unbounded',
        },
      ),
    ),
    Effect.exit,
  )

  yield* Exit.match(outputExit, {
    onFailure(cause) {
      return fail(Cause.pretty(cause))
    },
    onSuccess() {
      return Effect.logInfo('Deploy successful')
    },
  })
})
