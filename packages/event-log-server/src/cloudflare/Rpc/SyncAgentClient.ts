import * as Rpc from '@effect/rpc/Rpc'
import * as RpcClient from '@effect/rpc/RpcClient'
import * as RpcGroup from '@effect/rpc/RpcGroup'
import * as RpcSerialization from '@effect/rpc/RpcSerialization'
import { CloudflareBindings } from '@xstack/cloudflare/bindings'
import * as EventJournal from '@xstack/event-log/EventJournal'
import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import * as Option from 'effect/Option'
import * as Schema from 'effect/Schema'
import * as RpcClient_ from './Client'

export const SerializationLive = RpcSerialization.layerMsgPack

export class SyncAgentClientRpcs extends RpcGroup.make(
  Rpc.make('Write', {
    payload: Schema.Struct({
      remoteId: EventJournal.RemoteId,
      change: Schema.Uint8ArrayFromSelf,
    }),
  }),
  Rpc.make('Destroy', {
    success: Schema.Void,
  }),
) {}

const Client = RpcClient.make(SyncAgentClientRpcs).pipe(
  Effect.provide(pipe(RpcClient_.layerProtocolSocket(), Layer.provide(SerializationLive))),
)

export interface SyncAgentClientConfig {
  binding: string
  rpcPath: string
}
export const SyncAgentClientConfig = Context.GenericTag<SyncAgentClientConfig>(
  '@xstack/event-log-server/RpcClient/SyncAgentClientConfig',
)

export class SyncAgentClient extends Context.Tag('@xstack/event-log-server/RpcClient/SyncAgentClient')<
  SyncAgentClient,
  {
    write: (id: typeof EventJournal.RemoteId.Type, chunk: Uint8Array<ArrayBufferLike>) => Effect.Effect<void, never>
  }
>() {
  static Live = Layer.scoped(
    this,
    Effect.gen(function* () {
      const config = yield* SyncAgentClientConfig
      const binding = yield* CloudflareBindings.use((_) => _.getFetcher(config.binding)).pipe(
        Effect.flatMap(
          Option.match({
            onNone: () => Effect.dieMessage(`No binding found for ${config.binding}`),
            onSome: Effect.succeed,
          }),
        ),
      )

      const rpcClientRef = yield* RpcClient_.makeFetchFromWebsocket(binding.fetch, Client, { rpcPath: config.rpcPath })

      const write = Effect.fn(function* (
        remoteId: typeof EventJournal.RemoteId.Type,
        chunk: Uint8Array<ArrayBufferLike>,
      ) {
        const client = yield* rpcClientRef.get
        return yield* client.Write({ remoteId, change: chunk }).pipe(Effect.orDie)
      }, Effect.scoped)

      return {
        write,
      }
    }),
  )
}
