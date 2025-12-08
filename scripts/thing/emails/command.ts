import { Command } from '@effect/cli'
import { Effect } from 'effect'
import { emailCwdOption, emailStageOption } from './options'
import { EmailBuildSubcommand, EmailDeploySubcommand } from './domain'
import * as Emails from './subcommand'
import * as Workspace from '../workspace'
import type { Workspace as WorkspaceModel } from '../workspace'

const withWorkspace = <R, E>(cwd: string, f: (workspace: WorkspaceModel) => Effect.Effect<void, E, R>) =>
  Effect.gen(function* () {
    const workspace = yield* Workspace.make(cwd)
    return yield* f(workspace)
  })

const emailBuildCommand = Command.make('build', { cwd: emailCwdOption }, (config) =>
  withWorkspace(config.cwd, (workspace) => Emails.build(workspace, EmailBuildSubcommand({ cwd: config.cwd }))),
)

const emailDeployCommand = Command.make('deploy', { cwd: emailCwdOption, stage: emailStageOption }, (config) =>
  withWorkspace(config.cwd, (workspace) =>
    Emails.deploy(
      workspace,
      EmailDeploySubcommand({
        cwd: config.cwd,
        stage: config.stage,
      }),
    ),
  ),
)

const emailCommand = Command.make('email').pipe(Command.withSubcommands([emailBuildCommand, emailDeployCommand]))

export { emailCommand }
