import type * as Rpc from '@effect/rpc/Rpc'
import type * as RpcGroup from '@effect/rpc/RpcGroup'
import { type FromClientEncoded, type FromServerEncoded, ResponseDefectEncoded } from '@effect/rpc/RpcMessage'
import * as RpcSerialization from '@effect/rpc/RpcSerialization'
import * as RpcServer from '@effect/rpc/RpcServer'
import { EventEmitter } from '@xstack/event-log/Utils'
import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import { constVoid, pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import * as Mailbox from 'effect/Mailbox'
import * as ManagedRuntime from 'effect/ManagedRuntime'
import * as Runtime from 'effect/Runtime'
import * as Scope from 'effect/Scope'

const makeSocketProtocol = Effect.gen(function* () {
  const serialization = yield* RpcSerialization.RpcSerialization
  const disconnects = yield* Mailbox.make<number>()
  const clientIds = new Set<number>()

  let writeSend!: (clientId: number, message: FromServerEncoded) => Effect.Effect<void>
  let writeRequest!: (clientId: number, message: FromClientEncoded) => Effect.Effect<void>

  const onSocket = Effect.fnUntraced(function* (event: EventEmitter) {
    const runtime = yield* Effect.runtime()
    const runFork = Runtime.runFork(runtime)
    const parser = serialization.unsafeMake()

    const writeRaw = (clientId: number, data: Uint8Array<ArrayBufferLike> | string | undefined) =>
      Effect.sync(() => event.emit('response', [clientId, data]))

    writeSend = (clientId: number, response: FromServerEncoded) => {
      try {
        return Effect.orDie(writeRaw(clientId, parser.encode(response)))
      } catch (cause) {
        return Effect.orDie(writeRaw(clientId, parser.encode(ResponseDefectEncoded(cause))))
      }
    }

    const onRequest = ([clientId, data]: [number, Uint8Array]) => {
      clientIds.add(clientId)

      try {
        const decoded = parser.decode(data) as ReadonlyArray<FromClientEncoded>
        if (decoded.length === 0) return
        let i = 0

        runFork(
          Effect.whileLoop({
            while: () => i < decoded.length,
            body: () => writeRequest(clientId, decoded[i++]),
            step: constVoid,
          }),
        )
      } catch (cause) {
        runFork(writeRaw(clientId, parser.encode(ResponseDefectEncoded(cause))))
      }
    }

    event.on('request', onRequest)

    const onEnd = ([clientId]: [number]) => {
      clientIds.delete(clientId)
      Effect.runFork(disconnects.offer(clientId))
    }

    event.on('close', onEnd)

    return () => {
      event.off('request', onRequest)
      event.off('close', onEnd)
    }
  })

  const protocol = yield* RpcServer.Protocol.make((writeRequest_) => {
    writeRequest = writeRequest_
    return Effect.succeed({
      disconnects,
      clientIds: Effect.succeed(clientIds),
      send: (clientId, response) => writeSend(clientId, response),
      end: (_clientId) => Effect.void,
      initialMessage: Effect.succeedNone,
      supportsAck: true,
      supportsTransferables: false,
      supportsSpanPropagation: true,
    })
  })

  return { protocol, onSocket } as const
})

const SocketProtocol = Context.GenericTag<Effect.Effect.Success<typeof makeSocketProtocol>>(
  '@xstack/event-log-server/RpcServer/SocketProtocol',
)

const layerWebsocketHttpApp = <Rpcs extends Rpc.Any>(
  group: RpcGroup.RpcGroup<Rpcs>,
  options?:
    | {
        readonly disableTracing?: boolean | undefined
        readonly spanPrefix?: string | undefined
        readonly concurrency?: number | 'unbounded' | undefined
      }
    | undefined,
) =>
  Layer.scoped(
    SocketProtocol,
    Effect.gen(function* () {
      const socketProtocol = yield* makeSocketProtocol
      const scope = yield* Effect.scope

      yield* RpcServer.make(group, options).pipe(
        Effect.provideService(RpcServer.Protocol, socketProtocol.protocol),
        Effect.forkScoped,
        Effect.provideService(Scope.Scope, scope),
      )

      return socketProtocol
    }),
  )

export const make = <Rpcs extends Rpc.Any, LA = never>(
  group: RpcGroup.RpcGroup<Rpcs>,
  layer: Layer.Layer<RpcSerialization.RpcSerialization | Rpc.ToHandler<Rpcs> | LA, never, never>,
  config: {
    onWrite: (clientId: number, bytes: Uint8Array<ArrayBufferLike> | string) => void
  },
) => {
  return (
    options?:
      | {
          readonly disableTracing?: boolean | undefined
          readonly spanPrefix?: string | undefined
          readonly concurrency?: number | 'unbounded' | undefined
        }
      | undefined,
  ) => {
    let initialized = false
    const emitter = new EventEmitter()

    const Live: Layer.Layer<never> = pipe(
      Layer.scopedDiscard(
        Effect.gen(function* () {
          const { onSocket } = yield* SocketProtocol
          const cleanup = yield* onSocket(emitter)

          const onResponse = (data: [number, Uint8Array | string]) => config.onWrite(data[0], data[1])
          emitter.on('response', onResponse)

          yield* Effect.addFinalizer(() => {
            emitter.off('response', onResponse)
            return Effect.sync(() => cleanup)
          })
        }),
      ),
      Layer.provide(layerWebsocketHttpApp(group, options)),
      Layer.provide(layer),
      Layer.tapErrorCause(Effect.logError),
      Layer.orDie,
    )

    let runtime = ManagedRuntime.make(Live)

    const init = async () => {
      await runtime.runtime()
      initialized = true
    }

    const close = (id: number) => {
      emitter.emit('close', [id])
    }

    const send = async (id: number, bytes: Uint8Array<ArrayBufferLike>) => {
      if (!initialized) {
        await init()
      }
      emitter.emit('request', [id, bytes])
    }

    const dispose = async () => {
      initialized = false

      try {
        await runtime.dispose()
      } catch {
        // ignore
      }

      runtime = ManagedRuntime.make(Live)
    }

    return { init, dispose, send, close }
  }
}
