import { SqliteRunError } from '@xstack/sqlite/schema'
import * as Cause from 'effect/Cause'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import type * as ParseResult from 'effect/ParseResult'
import type * as Request from 'effect/Request'
import * as Runtime from 'effect/Runtime'
import * as Schema from 'effect/Schema'

type ConstructType<A> = A extends { new (...args: any[]): infer R } ? R : never

type ArrToUnion<A> = A extends readonly (infer F)[] ? ConstructType<F> : never
type ExtractFromUnion<A> =
  A extends Schema.Union<infer A> ? ArrToUnion<A> : A extends Schema.Schema.Any ? A['Type'] : never

type TaggedRequestIns<T> = T extends { success: any; failure: any }
  ? {
      success: T['success']['Type']
      failure: ExtractFromUnion<T['failure']>
    }
  : never

type Constructor<T> = new (...args: any) => T
type TaggedReq = Constructor<Request.Request<any, any>> & { _tag: string }

const Req = Schema.Struct({
  id: Schema.Number,
  type: Schema.Literal('req'),
  data: Schema.Any,
})
const encodeReq = Schema.encodeUnknownSync(Req)

const Ack = Schema.Struct({
  id: Schema.Number,
  type: Schema.Literal('ack'),
  data: Schema.Exit({
    defect: Schema.Never,
    failure: SqliteRunError,
    // Already serialized so no longer needed
    success: Schema.Any,
  }),
})
const encodeAck = Schema.encodeUnknownSync(Ack)

const decodeMessage = Schema.decodeUnknownSync(Schema.Union(Req, Ack))

export const createBroadcastChannel = (name: string, whenOpen: <A, E>(_: Effect.Effect<A, E>) => Effect.Effect<A, E>) =>
  Effect.gen(function* () {
    let currentId = 1
    const pending = new Map<number, (effect: Exit.Exit<any, any>) => void>()
    const handles = new Map<TaggedReq, (_: any) => Effect.Effect<any, any>>()
    const channel = new BroadcastChannel(name)

    const ensureCause = (_: unknown) => (Cause.isCause(_) ? _ : Cause.fail(_))
    const handleError =
      <A>(encoder: (u: unknown) => Effect.Effect<Schema.WithResult.Failure<A>, ParseResult.ParseError>) =>
      (cause: Cause.Cause<any>) =>
        encoder(Cause.squash(cause)).pipe(
          Effect.catchAllCause((_) => Effect.failCause(ensureCause(_))),
          Effect.flatMap((_) => Effect.failCause(ensureCause(_))),
        )
    const encodeFinalResult =
      <A>(
        successEncoder: (u: unknown) => Effect.Effect<Schema.WithResult.Success<A>, ParseResult.ParseError>,
        failureEncoder: (u: unknown) => Effect.Effect<Schema.WithResult.Failure<A>, ParseResult.ParseError>,
      ) =>
      (exit: Exit.Exit<any, any>) =>
        (Exit.isSuccess(exit)
          ? successEncoder(exit.value).pipe(Effect.catchAllCause(handleError(failureEncoder)))
          : handleError(failureEncoder)(exit.cause)) as Effect.Effect<
          Schema.WithResult.Success<A>,
          Schema.WithResult.Failure<A> | ParseResult.ParseError
        >

    const message = {
      postMessage: <A extends Schema.WithResult.Any>(message: A, options: { discard: boolean } = { discard: false }) =>
        whenOpen(
          Effect.async<Schema.WithResult.Success<A>, Schema.WithResult.Failure<A> | ParseResult.ParseError>(
            (resume) => {
              const id = currentId++

              if (!options.discard) {
                const successSchema = Schema.decodeUnknown(
                  Schema.successSchema(message) as Schema.Schema<Schema.WithResult.Success<A>>,
                )
                const failureSchema = Schema.decodeUnknown(
                  Schema.failureSchema(message) as Schema.Schema<Schema.WithResult.Failure<A>>,
                )

                const getFinalExit = encodeFinalResult(successSchema, failureSchema)
                pending.set(id, (exit) => resume(getFinalExit(exit)))
              }

              try {
                channel.postMessage(encodeReq({ type: 'req', id, data: message }))
              } catch {}

              if (options.discard) {
                resume(Effect.succeed(Exit.void as any))
              }
            },
          ),
        ),
      handle: <A extends TaggedReq>(
        schema: A,
        handle: (
          _: ConstructorParameters<A>[0],
        ) => Effect.Effect<TaggedRequestIns<A>['success'], TaggedRequestIns<A>['failure']>,
      ) => {
        handles.set(schema, handle)
      },
      close: Effect.sync(() => {
        currentId = 1
        pending.clear()
        handles.clear()
        channel.close()
      }),
    }

    const runtime = yield* Effect.runtime<never>()
    const runFork = Runtime.runFork(runtime)

    const ack = <T>(id: number, data?: T) =>
      Effect.sync(() => channel.postMessage(encodeAck({ type: 'ack', id, data })))

    const handleMessage = Effect.fn(function* (id: number, type: string, data: any) {
      if (type === 'req') {
        const found = Array.from(handles.entries()).find(([k]) => k._tag === data._tag)
        if (!found) {
          return yield* ack(id, Exit.void)
        }

        const handle = found[1]
        if (!handle) {
          return yield* ack(id, Exit.void)
        }

        const exit = yield* Effect.exit(handle(data))
        return yield* ack(id, exit)
      }

      if (type === 'ack') {
        const resume = pending.get(id)
        if (!resume) return
        resume(data)
      }
    })

    channel.onmessage = (event) => {
      if (!event.data) return

      const message = decodeMessage(event.data)

      runFork(whenOpen(handleMessage(message.id, message.type, message.data)))
    }

    return message
  })

export type SchemaBroadcastChannel = Effect.Effect.Success<ReturnType<typeof createBroadcastChannel>>
