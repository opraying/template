import * as Rpc from '@effect/rpc/Rpc'
import * as RpcClient from '@effect/rpc/RpcClient'
import * as RpcGroup from '@effect/rpc/RpcGroup'
import * as RpcSerialization from '@effect/rpc/RpcSerialization'
import { CloudflareBindings } from '@xstack/cloudflare/bindings'
import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import * as Option from 'effect/Option'
import * as Schema from 'effect/Schema'
import * as RpcClient_ from './Client'

export const SerializationLive = RpcSerialization.layerMsgPack

export class SyncServerError extends Schema.TaggedError<SyncServerError>('SyncServerError')('SyncServerError', {
  message: Schema.String,
  reason: Schema.Defect,
}) {}

export class SyncServerRpcs extends RpcGroup.make(
  Rpc.make('Write', {
    payload: Schema.Struct({ data: Schema.Uint8ArrayFromSelf }),
    success: Schema.Struct({
      response: Schema.Uint8ArrayFromSelf,
      changes: Schema.Array(Schema.Uint8ArrayFromSelf),
    }),
    error: SyncServerError,
  }),
  Rpc.make('RequestChanges', {
    payload: Schema.Struct({ startSequence: Schema.Number }),
    success: Schema.Struct({
      changes: Schema.Array(Schema.Uint8ArrayFromSelf),
    }),
    error: SyncServerError,
  }),
  Rpc.make('Destroy', {
    success: Schema.Void,
    error: SyncServerError,
  }),
) {}

const Client = RpcClient.make(SyncServerRpcs).pipe(
  Effect.provide(pipe(RpcClient_.layerProtocolSocket(), Layer.provide(SerializationLive))),
)

export interface SyncServerConfig {
  binding: string
  rpcPath: string
}
export const SyncServerConfig = Context.GenericTag<SyncServerConfig>(
  '@xstack/event-log-server/RpcClient/SyncServerConfig',
)

export class SyncServerClient extends Context.Tag('@xstack/event-log-server/RpcClient/SyncServerClient')<
  SyncServerClient,
  {
    write: (data: Uint8Array<ArrayBufferLike>) => Effect.Effect<
      {
        readonly response: Uint8Array<ArrayBufferLike>
        readonly changes: readonly Uint8Array<ArrayBufferLike>[]
      },
      SyncServerError
    >
    requestChanges: (
      startSequence: number,
    ) => Effect.Effect<{ readonly changes: readonly Uint8Array<ArrayBufferLike>[] }, SyncServerError>
  }
>() {
  static Live = Layer.scoped(
    this,
    Effect.gen(function* () {
      const config = yield* SyncServerConfig
      const binding = yield* CloudflareBindings.use((_) => _.getFetcher(config.binding)).pipe(
        Effect.flatMap(
          Option.match({
            onNone: () => Effect.dieMessage(`No binding found for ${config.binding}`),
            onSome: Effect.succeed,
          }),
        ),
      )

      const rpcClientRef = yield* RpcClient_.makeFetchFromWebsocket(binding.fetch, Client, {
        rpcPath: config.rpcPath,
      })

      const write = Effect.fnUntraced(function* (data: Uint8Array<ArrayBufferLike>) {
        const client = yield* rpcClientRef.get

        return yield* client.Write({ data }).pipe(Effect.orDie)
      }, Effect.scoped)

      const requestChanges = Effect.fnUntraced(function* (startSequence: number) {
        const client = yield* rpcClientRef.get
        return yield* client.RequestChanges({ startSequence }).pipe(Effect.orDie)
      }, Effect.scoped)

      return {
        write,
        requestChanges,
      }
    }),
  )
}
