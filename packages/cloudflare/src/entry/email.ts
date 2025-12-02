import type { ExecutionContext, ForwardableEmailMessage } from '@cloudflare/workers-types'
import { CloudflareBindings } from '@xstack/cloudflare/bindings'
import * as CacheStorage from '@xstack/cloudflare/cache-storage'
import { makeConfigProvider } from '@xstack/cloudflare/config-provider'
import { CloudflareExecutionContext } from '@xstack/cloudflare/execution-context'
import { EmailEvent } from '@xstack/cloudflare/email'
import { withGlobalLogLevel } from '@xstack/server/logger'
import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import * as ManagedRuntime from 'effect/ManagedRuntime'

export class CloudflareEmailHandle extends Context.Tag('@cloudflare:email-handle')<
  CloudflareEmailHandle,
  {
    layer: Layer.Layer<never, never, never>
    handle: (event: EmailEvent) => Effect.Effect<void, never, never>
  }
>() {
  static async run(
    event: ForwardableEmailMessage,
    env: any,
    context: ExecutionContext,
    layer: Layer.Layer<CloudflareEmailHandle, never, never>,
  ) {
    const Live = pipe(
      Layer.unwrapEffect(Effect.map(CloudflareEmailHandle, (_) => _.layer)),
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
      const emailEvent = EmailEvent.of({
        raw: event.raw as any,
        headers: event.headers as any,
        rawSize: event.rawSize,
        setReject: (reason) =>
          Effect.withSpan(
            Effect.sync(() => event.setReject(reason)),
            'Email.reject',
            {
              attributes: {
                reason,
              },
            },
          ),
        forward: (rcptTo, headers) =>
          Effect.withSpan(
            Effect.promise(() => {
              if (headers) {
                return event.forward(rcptTo, headers as any)
              }
              return event.forward(rcptTo)
            }),
            'Email.forward',
            {
              attributes: {
                rcptTo,
                headers,
              },
            },
          ),
        reply: (message) =>
          Effect.withSpan(
            Effect.promise(() => event.reply(message)),
            'Email.reply',
            {
              attributes: {
                from: message.from,
                to: message.to,
              },
            },
          ),
      })

      const { handle } = yield* CloudflareEmailHandle

      yield* handle(emailEvent).pipe(Effect.provideService(EmailEvent, emailEvent), Effect.withSpan('Email.handle'))
    })

    await runtime.runPromise(program).finally(() => {
      try {
        context.waitUntil(runtime.dispose())
      } catch {}
    })
  }

  static make = <A>(
    layer: Layer.Layer<A, never, never>,
    handle: (event: EmailEvent) => Effect.Effect<void, never, A | EmailEvent>,
  ) =>
    Layer.succeed(CloudflareEmailHandle, {
      layer,
      handle: handle as any,
    })
}
