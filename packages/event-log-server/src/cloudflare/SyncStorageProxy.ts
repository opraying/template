import { DurableObject } from 'cloudflare:workers'
import { makeConfigProvider } from '@xstack/cloudflare/config-provider'
import * as RpcServer from '@xstack/cloudflare/rpc-server'
import { toUint8Array } from '@xstack/event-log/Utils'
import * as DurableObjectUtils from '@xstack/event-log-server/cloudflare/DurableObjectUtils'
import {
  SerializationLive,
  type SqlExecPayload,
  StorageProxyRpcs,
} from '@xstack/event-log-server/cloudflare/Rpc/SyncStorageProxy'
import { LoggerLive, withGlobalLogLevel } from '@xstack/server/logger'
import * as Effect from 'effect/Effect'
import * as Either from 'effect/Either'
import { pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import * as Option from 'effect/Option'
import * as ParseResult from 'effect/ParseResult'
import * as Schema from 'effect/Schema'
import type { Mutable } from 'effect/Types'

const StorageProxyRpcLive = StorageProxyRpcs.toLayer(
  Effect.gen(function* () {
    const state = yield* DurableObjectUtils.StorageObjectState

    return {
      Exec: Effect.fnUntraced(function* ({ sql, bindings }: typeof SqlExecPayload.Type) {
        const cursor = state.storage.sql.exec(sql, ...bindings)

        const raw = Array.from(cursor.raw()).map((rows) =>
          rows.map((value) => {
            if (value instanceof ArrayBuffer) return new Uint8Array(value)
            return value
          }),
        )

        return {
          columnNames: cursor.columnNames,
          raw,
        }
      }),
      DatabaseInfo: Effect.fnUntraced(function* () {
        const size = state.storage.sql.databaseSize

        return { databaseSize: size }
      }),
      /**
       * clear all data
       */
      Destroy: Effect.fnUntraced(function* () {
        yield* Effect.promise(async () => {
          try {
            state.getWebSockets().forEach((ws) => {
              ws.close(1000)
            })
          } catch {}

          try {
            await state.storage.deleteAll()
            await state.storage.deleteAlarm()
            await state.storage.sync()
          } finally {
            state.abort()
          }
        })
      }),
    }
  }),
)

class DurableState extends Schema.Class<DurableState>('DurableState')({
  identity: DurableObjectUtils.DurableObjectIdentitySchema.pipe(
    Schema.Option,
    Schema.optionalWith({ exact: true, default: () => Option.none() }),
  ),
}) {
  static json = Schema.parseJson(DurableState)

  static encode = Schema.encodeSync(DurableState.json)

  static decode = Schema.decodeSync(DurableState.json)
}

class RpcClientState extends Schema.Class<RpcClientState>('RpcClientState')({
  clientId: Schema.Number.pipe(Schema.optionalWith({ exact: true, default: () => Math.round(Math.random() * 100000) })),
  quit: Schema.Boolean.pipe(Schema.optionalWith({ exact: true, default: () => false })),
}) {
  static decode = Schema.decodeUnknownSync(RpcClientState)

  static encode = Schema.encodeUnknownSync(RpcClientState)
}

export declare namespace StorageProxyDurableServer {
  export type Options = {
    layer: Layer.Layer<never>
    hibernatableWebSocketEventTimeout: number
    resetOnStartup: boolean
  }
}

abstract class StorageProxyDurableObject extends DurableObject {
  private state!: DurableState

  private rpcServer: ReturnType<ReturnType<typeof RpcServer.make>>

  private rpcClients: Map<WebSocket, Mutable<RpcClientState>>

  constructor(ctx: DurableObjectState, env: any, options: StorageProxyDurableServer.Options) {
    // console.log("-------------- Storage Proxy Server Waked --------------")

    super(ctx, env)

    this.ctx.setHibernatableWebSocketEventTimeout(options.hibernatableWebSocketEventTimeout)

    const RpcServerLive = pipe(
      Layer.mergeAll(StorageProxyRpcLive, SerializationLive),
      Layer.provide(Layer.succeed(DurableObjectUtils.StorageObjectState, ctx)),
      Layer.provideMerge(options.layer),
      Layer.provide(Layer.setConfigProvider(makeConfigProvider(env))),
      Layer.provide([LoggerLive, withGlobalLogLevel(env)]),
      Layer.tapErrorCause(Effect.logError),
      Layer.orDie,
    )

    const make = RpcServer.make(StorageProxyRpcs, RpcServerLive, {
      onWrite: (clientId, data) => {
        const ws = Array.from(this.rpcClients.keys()).find((ws) => this.rpcClients.get(ws)?.clientId === clientId)
        if (!ws) {
          console.warn('client not found')
          return
        }
        const clientState = this.rpcClients.get(ws)
        if (clientState?.quit) {
          return
        }

        return ws.send(data)
      },
    })

    this.rpcServer = make({ disableTracing: true })

    this.rpcClients = new Map()

    this.ctx.getWebSockets().forEach((ws) => {
      const state = ws.deserializeAttachment() as RpcClientState
      this.rpcClients.set(ws, state)
    })

    this.ctx.blockConcurrencyWhile(async () => {
      await this.initialize()

      if (options?.resetOnStartup) {
        const state = this.state
        try {
          await this.ctx.storage.deleteAll()
          await this.ctx.storage.deleteAlarm()
          await this.ctx.storage.sync()
        } finally {
          this.updateState(state)
        }
      }
    })
  }

  abstract onInitialize(): Promise<void>

  async initialize() {
    const value = await this.ctx.storage.get<string>('_state').finally(() => '')

    this.state = !value ? DurableState.make() : DurableState.decode(value)

    await this.onInitialize()
  }

  updateState(updates: Partial<DurableState>): void {
    const state = Object.assign({}, this.state, updates)

    this.state = state
    this.ctx.waitUntil(this.ctx.storage.put('_state', DurableState.encode(state)))
  }

  private async ensure(_: { identity: DurableObjectUtils.DurableObjectIdentitySchema }) {
    this.updateState({ identity: Option.fromNullable(_.identity) })
  }

  fetch(request: Request): Response {
    const webSocketPair = new WebSocketPair()
    const [websocketClient, websocketServer] = Object.values(webSocketPair)

    const headersEither = DurableObjectUtils.DurableObjectIdentitySchema.fromHeaders(request.headers)

    if (Either.isLeft(headersEither)) {
      const error = headersEither.left
      const errorString = ParseResult.TreeFormatter.formatErrorSync(error)

      return new Response(errorString, { status: 400 })
    }

    const identity = headersEither.right

    this.ensure({ identity })

    const rpcClientState = RpcClientState.make()
    websocketServer.serializeAttachment(rpcClientState)
    this.rpcClients.set(websocketServer, rpcClientState)

    this.ctx.acceptWebSocket(websocketServer)

    return new Response(null, {
      status: 101,
      webSocket: websocketClient,
    })
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const client = this.rpcClients.get(ws)
    if (!client || client.quit) {
      ws.close(1011, 'WebSocket broken.')
      return
    }

    const data = toUint8Array(message)

    await this.rpcServer.send(client.clientId, data)
  }

  async webSocketError(ws: WebSocket, _error: unknown): Promise<void> {
    const clientState = this.rpcClients.get(ws)
    if (clientState) {
      clientState.quit = true
      this.rpcServer.close(clientState.clientId)
    }
    this.rpcClients.delete(ws)

    if (this.rpcClients.size === 0) {
      await this.rpcServer.dispose()
    }
  }

  async webSocketClose(ws: WebSocket, _code: number, _reason: string, _wasClean: boolean): Promise<void> {
    const clientState = this.rpcClients.get(ws)
    if (clientState) {
      clientState.quit = true
      this.rpcServer.close(clientState.clientId)
    }
    this.rpcClients.delete(ws)

    ws.close()

    // Allow Durable Object to sleep when there is no connection
    if (this.rpcClients.size === 0) {
      this.ctx.waitUntil(this.rpcServer.dispose())
    }
  }
}

export const makeDurableObject = (options?: {
  layer?: Layer.Layer<never> | undefined
  hibernatableWebSocketEventTimeout?: number | undefined
  resetOnStartup?: boolean | undefined
}) => {
  class StorageProxyDurableObjectServer extends StorageProxyDurableObject {
    constructor(ctx: DurableObjectState, env: any) {
      super(ctx, env, {
        layer: options?.layer ?? Layer.empty,
        hibernatableWebSocketEventTimeout: options?.hibernatableWebSocketEventTimeout ?? 5000,
        resetOnStartup: options?.resetOnStartup ?? false,
      })
    }

    async onInitialize(): Promise<void> {}
  }

  return StorageProxyDurableObjectServer
}

export const makeWorker = (options: {
  rpcPath?: string | undefined
  durableObjectPrefix?: string | undefined
  durableObjectBinding: string
}) => {
  return {
    fetch(request, env) {
      const url = new URL(request.url)
      const { pathname } = url

      const rpcPath = options?.rpcPath ?? '/rpc'
      const durableObjectPrefix = options?.durableObjectPrefix ?? 'storage-proxy'
      const durableObjectBinding = options?.durableObjectBinding

      if (pathname.startsWith(rpcPath)) {
        const headers = request.headers
        const upgradeHeader = headers.get('Upgrade')

        if (!upgradeHeader || upgradeHeader !== 'websocket') {
          return new Response(null, { status: 426, statusText: 'Durable Object expected Upgrade: websocket' })
        }

        const identityEither = DurableObjectUtils.DurableObjectIdentitySchema.fromHeaders(headers)

        if (Either.isLeft(identityEither)) {
          const error = identityEither.left
          const errorString = ParseResult.TreeFormatter.formatErrorSync(error)
          return new Response(errorString, { status: 400 })
        }

        const identity = identityEither.right
        const requestHeaders = identity.assignTo(new Headers(headers))
        const durableObjectIdentity = `${identity.id()}::${durableObjectPrefix}`
        const doNamespace = env[durableObjectBinding] as DurableObjectNamespace
        const durableObjectId = doNamespace.idFromName(durableObjectIdentity)
        const stub = doNamespace.get(durableObjectId) as unknown as StorageProxyDurableObject

        return stub.fetch(
          new Request(request.url, {
            method: request.method,
            headers: requestHeaders,
            body: request.body,
            cf: request.cf,
            signal: request.signal,
          } as RequestInit),
        )
      }

      return new Response(null, { status: 404 })
    },
  } satisfies ExportedHandler<any>
}
