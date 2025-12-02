import { Context, Data, type Effect } from 'effect'

export class NotificationSendError extends Data.TaggedError('NotificationSendError')<{
  readonly cause?: Error | undefined
}> {}

export interface SendParams {
  branch: string
  branchUrls: string[]
  hash: string
  logUrl: string
  message: string
  previewUrls: string[]
  projectName: string
  stage: string
  environment: string
  nodeEnv: string
}

export interface SendFailedParams {
  branch: string
  hash: string
  message: string
  projectName: string
  stage: string
  environment: string
  error: string
  nodeEnv: string
}

export interface Notification {
  success: (payload: SendParams) => Effect.Effect<void, NotificationSendError>
  failed: (payload: SendFailedParams) => Effect.Effect<void, NotificationSendError>
}
export const Notification = Context.GenericTag<Notification>('@thing:notification')
