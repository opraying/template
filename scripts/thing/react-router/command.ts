import type { Stage } from '../domain'
import { BuildReactRouterTarget } from './domain'
import * as ReactRouterSubcommand from './subcommand'
import type { BuildSubcommand, DeploySubcommand, PreviewSubcommand, ServeSubcommand } from '../domain'
import type { BuildReactRouterTarget as BuildReactRouterTargetType } from './domain'
import type { Workspace as WorkspaceModel } from '../workspace'

interface ReactRouterTargetOptions {
  readonly isSpaMode: boolean
  readonly isDesktop: boolean
}

const createReactRouterTarget = (stage: Stage, options: ReactRouterTargetOptions): BuildReactRouterTargetType =>
  BuildReactRouterTarget({
    runtime: 'cloudflare-workers',
    options: {
      isSpaMode: options.isSpaMode,
      isDesktop: options.isDesktop,
    },
    stage,
  })

const runServe = (workspace: WorkspaceModel, subcommand: ServeSubcommand) =>
  ReactRouterSubcommand.serve(workspace, subcommand)

const runBuild = (workspace: WorkspaceModel, subcommand: BuildSubcommand) =>
  ReactRouterSubcommand.build(workspace, subcommand)

const runDeploy = (workspace: WorkspaceModel, subcommand: DeploySubcommand, target: BuildReactRouterTargetType) =>
  ReactRouterSubcommand.deploy(workspace, subcommand, target)

const runPreview = (workspace: WorkspaceModel, subcommand: PreviewSubcommand, target: BuildReactRouterTargetType) =>
  ReactRouterSubcommand.preview(workspace, subcommand, target)

export { createReactRouterTarget, runBuild, runDeploy, runPreview, runServe }
