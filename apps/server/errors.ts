import * as Data from 'effect/Data'

export class ContactSendError extends Data.TaggedError('ContactSendError')<{
  readonly message: string
  readonly cause?: Error | undefined
}> {}
