import * as FetchHttpClient from '@effect/platform/FetchHttpClient'
import * as RpcClient from '@effect/rpc/RpcClient'
import type * as RpcMessage from '@effect/rpc/RpcMessage'
import * as RpcSerialization from '@effect/rpc/RpcSerialization'
import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import { constVoid, pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import * as Option from 'effect/Option'
import * as RcRef from 'effect/RcRef'
import * as Runtime from 'effect/Runtime'
import type * as Scope from 'effect/Scope'

type ClientWriter = (chunk: Uint8Array<ArrayBufferLike> | string | undefined) => void
type WSSocket = {
  write: ClientWriter
  read: (callback: ClientWriter) => void
}
const WSSocket = Context.GenericTag<WSSocket>('@xstack/event-log-server/RpcClient/WSSocket')

/**
 * @since 1.0.0
 * @category protocol
 */
export const makeProtocolSocket = (): Effect.Effect<
  RpcClient.Protocol['Type'],
  never,
  RpcSerialization.RpcSerialization | WSSocket
> =>
  RpcClient.Protocol.make(
    Effect.fnUntraced(function* (writeResponse) {
      const serialization = yield* RpcSerialization.RpcSerialization
      const { write, read } = yield* WSSocket
      const runtime = yield* Effect.runtime<never>()
      const runFork = Runtime.runFork(runtime)
      const parser = serialization.unsafeMake()

      read((value) => {
        try {
          if (value === undefined) return
          const responses = parser.decode(value) as Array<RpcMessage.FromServerEncoded>
          if (responses.length === 0) return

          let i = 0
          runFork(
            Effect.whileLoop({
              while: () => i < responses.length,
              body: () => writeResponse(responses[i++]),
              step: constVoid,
            }),
          )
        } catch (defect) {
          runFork(writeResponse({ _tag: 'Defect', defect }))
        }
      })

      return {
        send: (request) => Effect.sync(() => write(parser.encode(request))),
        supportsAck: true,
        supportsTransferables: false,
      }
    }),
  )

/**
 * @since 1.0.0
 * @category protocol
 */
export const layerProtocolSocket = (): Layer.Layer<
  RpcClient.Protocol,
  never,
  RpcSerialization.RpcSerialization | WebSocket
> =>
  Layer.effect(RpcClient.Protocol, makeProtocolSocket()).pipe(
    Layer.provide(
      Layer.effect(
        WSSocket,
        Effect.gen(function* () {
          const socket = yield* Websocket

          // Buffer to store messages that arrive before read callback is ready
          const messageBuffer: Array<Uint8Array | string> = []
          let callback: ((chunk: Uint8Array<ArrayBufferLike> | string) => void) | null = null

          socket.onmessage = (event) => {
            if (callback) {
              // If callback is ready, process message immediately
              callback(event.data)
            } else {
              // If callback is not ready, buffer the message
              messageBuffer.push(event.data)
            }
          }

          return WSSocket.of({
            write: (chunk) => {
              if (chunk !== undefined) {
                socket.send(chunk)
              }
            },
            read: (cb) => {
              // Process any buffered messages first
              while (messageBuffer.length > 0) {
                const bufferedMessage = messageBuffer.shift()
                if (bufferedMessage !== undefined) {
                  cb(bufferedMessage)
                }
              }

              // Set the callback for future messages
              callback = cb
            },
          })
        }),
      ),
    ),
  )

export const Websocket = Context.GenericTag<WebSocket>('@xstack/event-log-server/RpcClient/Websocket')

export const makeFetchFromWebsocket = Effect.fn(function* <A>(
  fetch: typeof globalThis.fetch,
  clientFactory: Effect.Effect<A, never, WebSocket | Scope.Scope>,
  options?:
    | {
        rpcPath?: string | undefined
      }
    | undefined,
) {
  const context = yield* Effect.context<never>()

  const getHeaders = pipe(
    Effect.context<never>(),
    Effect.map(Context.getOption(FetchHttpClient.RequestInit)),
    Effect.map((requestInit) =>
      Option.getOrElse(
        Option.map(requestInit, (_) => new Headers(_.headers)),
        () => new Headers(),
      ),
    ),
    Effect.mapInputContext((_: Context.Context<never>) => Context.merge(_, context)),
  )

  const path = options?.rpcPath ?? '/rpc'

  const makeWebsocket = pipe(
    getHeaders,
    Effect.tap((headers) => {
      headers.set('Upgrade', 'websocket')
    }),
    Effect.flatMap((headers) =>
      Effect.promise((signal) => fetch(new Request(`http://localhost${path}`, { headers, signal }))),
    ),
    Effect.flatMap((res) => {
      if (res.status === 426) {
        return Effect.dieMessage(res.statusText)
      }

      if (res.status === 400) {
        return Effect.promise(() => res.text()).pipe(Effect.flatMap((_) => Effect.dieMessage(`Request error\n${_}`)))
      }

      if (!res.webSocket) {
        return Effect.dieMessage('websocket connect failed')
      }

      res.webSocket.accept()
      return Effect.succeed(res.webSocket)
    }),
    Effect.acquireRelease((ws) => Effect.sync(() => ws.close())),
  )

  const acquire = Effect.provideServiceEffect(clientFactory, Websocket, makeWebsocket)

  const clientRef = yield* RcRef.make({ acquire, idleTimeToLive: 3000 })

  return clientRef
})
