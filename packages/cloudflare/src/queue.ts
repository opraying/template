import type { Queue as CFQueue, Message, QueueRetryOptions } from '@cloudflare/workers-types'
import {
  ATTR_DB_NAMESPACE,
  ATTR_DB_OPERATION_NAME,
  ATTR_DB_SYSTEM,
} from '@opentelemetry/semantic-conventions/incubating'
import { CloudflareBindings } from '@xstack/cloudflare/bindings'
import {
  DB_NAME,
  QUEUE_ATTRS,
  Queue,
  type QueueMessageSendRequest,
  type QueueSendBatchOptions,
  QueueSendError,
  type QueueSendOptions,
} from '@xstack/server/queue'
import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import { type LazyArg, pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import * as Option from 'effect/Option'
import * as RcRef from 'effect/RcRef'
import type * as Schema from 'effect/Schema'

export class MessageStatusCount {
  succeeded = 0
  failed = 0
  readonly total: number

  constructor(total: number) {
    this.total = total
  }

  ack() {
    this.succeeded = this.succeeded + 1
  }

  retry() {
    this.failed = this.failed + 1
  }

  toAttributes() {
    return {
      'queue.messages_count': this.total,
      'queue.messages_success': this.succeeded,
      'queue.messages_failed': this.failed,
      'queue.batch_success': this.succeeded === this.total,
    }
  }
}

export type QueueEventMessage<T> = {
  readonly id: string
  readonly timestamp: Date
  readonly body: T
  readonly attempts: number
}

export interface QueueEvent {
  readonly queue: string
  readonly messages: Effect.Effect<Message<unknown>[]>
  process: {
    <A = unknown, E = any>(
      effect: (message: QueueEventMessage<A>) => Effect.Effect<void, E, never>,
    ): Effect.Effect<QueueEventMessage<A>[], never>
    <A = unknown, I = unknown, E = any>(
      schema: Schema.Schema<A, I>,
      effect: (message: QueueEventMessage<A>) => Effect.Effect<void, E, never>,
    ): Effect.Effect<QueueEventMessage<A>[], never>
  }
  ackAll: Effect.Effect<void>
  retryAll: (options?: QueueRetryOptions) => void
}
export const QueueEvent = Context.GenericTag<QueueEvent>('@cloudflare:queue-event')

const DB_SYSTEM = 'Cloudflare Queue'

const make = Effect.fn(function* (bindingName: LazyArg<string>) {
  const acquire = CloudflareBindings.use((bindings) => bindings.getQueue(bindingName())).pipe(
    Effect.flatMap(
      Option.match({
        onNone: () => Effect.dieMessage(`Queue ${bindingName} not found`),
        onSome: Effect.succeed,
      }),
    ),
  )
  const queueRef = yield* RcRef.make({ acquire, idleTimeToLive: 100 })

  const catcher = (cause: any) => new QueueSendError({ message: 'queue send error', cause })

  const wrap =
    <A, Args extends any[]>(f: (_: CFQueue) => (...args: Args) => Promise<A>, operation: string) =>
    (...args: Args) => {
      const spanName = `Queue.${operation}`
      const baseAttributes = {
        [ATTR_DB_OPERATION_NAME]: operation,
        [ATTR_DB_SYSTEM]: DB_SYSTEM,
        [ATTR_DB_NAMESPACE]: DB_NAME,
        binding_type: 'Queue',
      } as Record<string, any>

      if (operation === 'send') {
        baseAttributes[QUEUE_ATTRS.CONTENT_TYPE] = args[1].contentType
        baseAttributes[QUEUE_ATTRS.DELAY] = args[1].delaySeconds
      } else if (operation === 'sendBatch') {
        baseAttributes[QUEUE_ATTRS.BATCH_SIZE] = args[0].length
        baseAttributes[QUEUE_ATTRS.DELAY] = args[1]?.delaySeconds
      }

      return pipe(
        queueRef,
        Effect.flatMap((queue) =>
          Effect.tryPromise({
            try: () => f(queue).apply(queue, args),
            catch: catcher,
          }),
        ),
        Effect.withSpan(spanName, {
          attributes: baseAttributes,
        }),
        Effect.scoped,
      )
    }

  const send = <T = unknown>(message: T, options?: QueueSendOptions) => wrap((_) => _.send, 'send')(message, options)

  const sendBatch = <T = unknown>(messages: Iterable<QueueMessageSendRequest<T>>, options?: QueueSendBatchOptions) =>
    wrap((_) => _.sendBatch, 'sendBatch')(messages, options)

  return {
    send,
    sendBatch,
  }
})

export const Default = Layer.scoped(
  Queue,
  make(() => 'Queue'),
)

export const fromName = (bindingName: LazyArg<string>) => Layer.scoped(Queue, make(bindingName))
