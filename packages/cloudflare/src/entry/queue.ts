import type { ExecutionContext, Message, MessageBatch } from '@cloudflare/workers-types'
import { CloudflareBindings } from '@xstack/cloudflare/bindings'
import * as CacheStorage from '@xstack/cloudflare/cache-storage'
import { makeConfigProvider } from '@xstack/cloudflare/config-provider'
import { CloudflareExecutionContext } from '@xstack/cloudflare/execution-context'
import { MessageStatusCount, QueueEvent, type QueueEventMessage } from '@xstack/cloudflare/queue'
import { withGlobalLogLevel } from '@xstack/server/logger'
import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import * as ManagedRuntime from 'effect/ManagedRuntime'
import * as Schema from 'effect/Schema'
import * as Struct from 'effect/Struct'

export class CloudflareQueueHandle extends Context.Tag('@cloudflare:queue-handle')<
  CloudflareQueueHandle,
  {
    layer: Layer.Layer<never, never, never>
    handle: (event: QueueEvent) => Effect.Effect<void, never, never>
  }
>() {
  static async run(
    batch: MessageBatch<unknown>,
    env: any,
    context: ExecutionContext,
    layer: Layer.Layer<CloudflareQueueHandle, never, never>,
  ) {
    const Live = pipe(
      Layer.unwrapEffect(Effect.map(CloudflareQueueHandle, (_) => _.layer)),
      Layer.provideMerge(
        Layer.mergeAll(
          layer,
          CloudflareBindings.fromEnv(env),
          CloudflareExecutionContext.fromContext(context, env),
          CacheStorage.fromGlobalCaches,
          Layer.setConfigProvider(makeConfigProvider(env)),
        ),
      ),
      Layer.provide(withGlobalLogLevel(env)),
    )

    const runtime = ManagedRuntime.make(pipe(Live, Layer.tapErrorCause(Effect.logError), Layer.orDie))

    const program = Effect.gen(function* () {
      let messages = batch.messages as Message<any>[]
      const statusCount = new MessageStatusCount(messages.length)
      const clock = yield* Effect.clock

      const process: {
        <A = unknown, E = any>(
          effect: (message: QueueEventMessage<A>) => Effect.Effect<void, E, never>,
        ): Effect.Effect<QueueEventMessage<A>[], never>;
        <A = unknown, I = unknown, E = any>(
          schema: Schema.Schema<A, I>,
          effect: (message: QueueEventMessage<A>) => Effect.Effect<void, E, never>,
        ): Effect.Effect<QueueEventMessage<A>[], never>
      } = Effect.fn(function* (
        self: Schema.Schema<any, any>,
        that: (message: QueueEventMessage<any>) => Effect.Effect<void, any, never>,
      ) {
        type Msg = QueueEventMessage<any>

        let handle: (message: Msg) => Effect.Effect<void, any, never>

        if (Schema.isSchema(self)) {
          // self -> schema, that -> handle
          const decode = Schema.decodeUnknown(self as Schema.Schema.AnyNoContext)

          handle = (message: Msg) =>
            pipe(
              decode(message.body),
              Effect.flatMap((body) =>
                that({
                  ...message,
                  body,
                }),
              ),
            )
        } else {
          // self -> handle
          handle = self
        }

        const { successes, failures } = yield* Effect.reduce(
          messages as Message<any>[],
          {
            successes: [] as Msg[],
            failures: [] as Msg[],
          },
          (acc, message) => {
            const msg = Struct.omit(message, 'ack', 'retry')

            return pipe(
              handle(msg),
              Effect.tap(() => {
                message.ack()
                statusCount.ack()

                acc.successes.push(msg)

                return Effect.currentSpan.pipe(
                  Effect.tap((_) =>
                    _.event('messageAck', clock.unsafeCurrentTimeNanos(), {
                      'queue.message_id': message.id,
                      'queue.message_timestamp': message.timestamp.toISOString(),
                    }),
                  ),
                )
              }),
              Effect.catchAll(() => {
                message.retry()
                statusCount.retry()
                acc.failures.push(msg)

                return Effect.currentSpan.pipe(
                  Effect.tap((_) =>
                    _.event('messageRetry', clock.unsafeCurrentTimeNanos(), {
                      'queue.message_id': message.id,
                      'queue.message_timestamp': message.timestamp.toISOString(),
                    }),
                  ),
                )
              }),
              Effect.as(acc),
            )
          },
        )

        const ids = successes.map((_) => _.id)
        messages = messages.filter((m) => !ids.includes(m.id))

        yield* Effect.annotateCurrentSpan(statusCount.toAttributes())

        return { successes, failures }
      }) as any

      const queueEvent = QueueEvent.of({
        messages: Effect.sync(() => messages),
        process,
        queue: batch.queue,
        ackAll: Effect.withSpan(
          Effect.sync(() => batch.ackAll()),
          'Queue.ackAll',
          {
            attributes: {
              'queue.name': batch.queue,
              'queue.messages_count': batch.messages.length,
            },
          },
        ),
        retryAll: (options) =>
          Effect.withSpan(
            Effect.sync(() => batch.retryAll(options)),
            'Queue.retryAll',
            {
              attributes: {
                delaySeconds: options?.delaySeconds,
              },
            },
          ),
      })

      const { handle } = yield* CloudflareQueueHandle

      yield* handle(queueEvent).pipe(
        Effect.provideService(QueueEvent, queueEvent),
        Effect.withSpan(`Queue.${batch.queue}`),
      )
    })

    await runtime.runPromise(program).finally(() => {
      try {
        context.waitUntil(runtime.dispose())
      } catch {}
    })
  }

  static make = <A>(
    layer: Layer.Layer<A, never, never>,
    handle: (event: QueueEvent) => Effect.Effect<void, never, A | QueueEvent>,
  ) =>
    Layer.succeed(CloudflareQueueHandle, {
      layer,
      handle: handle as any,
    })
}
