import { Context, Data, type Effect } from 'effect'

export class DeploymentOutput extends Data.TaggedClass('DeploymentOutput')<{
  previewUrls: string[]
  branchUrls: string[]
  logUrl: string
  state: 'success'
}> {}

export interface DeploymentSummary {
  description: string
}

export interface Deployment {
  build: Effect.Effect<void>
  deploy: Effect.Effect<DeploymentOutput>
}
export const Deployment = Context.GenericTag<Deployment>('@thing:deployment')
