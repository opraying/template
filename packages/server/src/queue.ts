import * as Data from 'effect/Data'
import * as Effect from 'effect/Effect'

export const DB_NAME = 'queue'

export const QUEUE_ATTRS = {
  CONTENT_TYPE: 'queue.content_type',
  DELAY: 'queue.delay',
  BATCH_SIZE: 'queue.batch_size',
} as const

export class QueueSendError extends Data.TaggedError('QueueSendError')<{
  message: string
  cause?: Error | unknown | undefined
}> {}

type QueueContentType = 'text' | 'bytes' | 'json'

export interface QueueSendOptions {
  contentType?: QueueContentType
  delaySeconds?: number
}

export interface QueueSendBatchOptions {
  delaySeconds?: number
}
export interface QueueMessageSendRequest<Body = unknown> {
  body: Body
  contentType?: QueueContentType
  delaySeconds?: number
}

/**
 * TODO: A more general definition
 */

export class Queue extends Effect.Tag('@server:queue')<
  Queue,
  {
    readonly send: <T = unknown>(message: T, options?: QueueSendOptions) => Effect.Effect<void, QueueSendError, never>
    readonly sendBatch: <T = unknown>(
      messages: Iterable<QueueMessageSendRequest<T>>,
      options?: QueueSendBatchOptions,
    ) => Effect.Effect<void, QueueSendError, never>
  }
>() {}
