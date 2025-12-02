import type { ExecutionContext, ScheduledController } from '@cloudflare/workers-types'
import { CloudflareBindings } from '@xstack/cloudflare/bindings'
import * as CacheStorage from '@xstack/cloudflare/cache-storage'
import { makeConfigProvider } from '@xstack/cloudflare/config-provider'
import { CloudflareExecutionContext } from '@xstack/cloudflare/execution-context'
import type { QueueEvent } from '@xstack/cloudflare/queue'
import { ScheduledEvent, ScheduledEventSchema } from '@xstack/cloudflare/schedule'
import { withGlobalLogLevel } from '@xstack/server/logger'
import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import * as ManagedRuntime from 'effect/ManagedRuntime'
import * as Schema from 'effect/Schema'

export class CloudflareScheduledHandle extends Context.Tag('@cloudflare:scheduled-handle')<
  CloudflareScheduledHandle,
  {
    layer: Layer.Layer<never, never, never>
    handle: (event: ScheduledEvent) => Effect.Effect<void, never, never>
  }
>() {
  static async run(
    controller: ScheduledController,
    env: any,
    context: ExecutionContext,
    layer: Layer.Layer<CloudflareScheduledHandle, never, never>,
  ) {
    const Live = pipe(
      Layer.unwrapEffect(Effect.map(CloudflareScheduledHandle, (_) => _.layer)),
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

    const decode = Schema.decodeUnknown(ScheduledEventSchema)

    const program = Effect.gen(function* () {
      const decodeData = yield* decode(controller).pipe(Effect.orDie)
      const event: ScheduledEvent = {
        ...decodeData,
        noRetry: Effect.withSpan(
          Effect.sync(() => controller.noRetry()),
          'Scheduled.noRetry',
        ),
      }

      const { handle } = yield* CloudflareScheduledHandle

      yield* handle(event).pipe(Effect.provideService(ScheduledEvent, event), Effect.withSpan('Scheduled.handle'))
    })

    await runtime.runPromise(program).finally(() => {
      try {
        context.waitUntil(runtime.dispose())
      } catch {}
    })
  }

  static make = <A>(
    layer: Layer.Layer<A, never, never>,
    handle: (controller: ScheduledController) => Effect.Effect<void, never, A | QueueEvent>,
  ) =>
    Layer.succeed(CloudflareScheduledHandle, {
      layer,
      handle: handle as any,
    })
}
