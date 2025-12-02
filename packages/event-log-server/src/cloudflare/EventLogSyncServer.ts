/// <reference types="@cloudflare/workers-types" />

import * as FetchHttpClient from '@effect/platform/FetchHttpClient'
import * as SqliteClient from '@effect/sql-sqlite-do/SqliteClient'
import * as CloudflareBindings from '@xstack/cloudflare/bindings'
import * as CacheStorage from '@xstack/cloudflare/cache-storage'
import { makeConfigProvider } from '@xstack/cloudflare/config-provider'
import * as CloudflareContext from '@xstack/cloudflare/execution-context'
import * as RpcServer from '@xstack/cloudflare/rpc-server'
import { ToManyRequests } from '@xstack/event-log/Error'
import * as EventLogRemote from '@xstack/event-log/EventLogRemote'
import type * as EventLogServer from '@xstack/event-log/EventLogServer'
import { ConnectedDevice } from '@xstack/event-log/Schema'
import * as SqlEventLogServer from '@xstack/event-log/SqlEventLogServer'
import * as Utils from '@xstack/event-log/Utils'
import * as DurableObject from '@xstack/event-log-server/cloudflare/DurableObjectUtils'
import {
  EventLogDurableObject,
  WebsocketTag,
  type WriteResult,
} from '@xstack/event-log-server/cloudflare/EventLogDurableObject'
import { SyncAgentClient, SyncAgentClientConfig } from '@xstack/event-log-server/cloudflare/Rpc/SyncAgentClient'
import { SerializationLive, SyncServerError, SyncServerRpcs } from '@xstack/event-log-server/cloudflare/Rpc/SyncServer'
import type { SyncStats } from '@xstack/event-log-server/schema'
import { withGlobalLogLevel } from '@xstack/server/logger'
import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Either from 'effect/Either'
import { flow, pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import * as Option from 'effect/Option'
import * as ParseResult from 'effect/ParseResult'
import * as Schema from 'effect/Schema'
import type { Mutable } from 'effect/Types'

type DirectMessageHandler = {
  readonly write: (chunk: Uint8Array<ArrayBufferLike>) => Effect.Effect<WriteResult>
  readonly requestChanges: (startSequence: number) => Effect.Effect<WriteResult>
}
const DirectMessageHandler = Context.GenericTag<DirectMessageHandler>('@cloudflare/direct-message-handler')

const SyncServerRpcLive = SyncServerRpcs.toLayer(
  Effect.gen(function* () {
    const state = yield* DurableObject.StorageObjectState
    const directMessageHandler = yield* DirectMessageHandler

    return {
      Write: Effect.fnUntraced(function* (_: { data: Uint8Array<ArrayBufferLike> }) {
        const res = yield* directMessageHandler.write(_.data)

        if (!res.success) {
          return yield* new SyncServerError({
            message: 'Failed to write data',
            reason: res.error,
          })
        }

        return {
          response: res.response,
          changes: res.changes,
        }
      }),
      RequestChanges: Effect.fnUntraced(function* (_: { startSequence: number }) {
        const res = yield* directMessageHandler.requestChanges(_.startSequence)

        if (!res.success) {
          return yield* new SyncServerError({
            message: 'Failed to write data',
            reason: res.error,
          })
        }

        return {
          changes: res.changes,
        }
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

const WebsocketTags = {
  Sync: WebsocketTag,
  Rpc: 'Rpc',
}

class SyncSessionState extends Schema.Class<SyncSessionState>('SyncSessionState')({
  userAgent: Schema.String,
  quit: Schema.Boolean.pipe(Schema.optionalWith({ exact: true, default: () => false })),
  ...ConnectedDevice.fields,
}) {
  get sessionId() {
    return `${this.type}::${this.os}`
  }

  static decode = Schema.decodeUnknownSync(SyncSessionState)

  static encode = Schema.encodeUnknownSync(SyncSessionState)
}

class RpcClientState extends Schema.Class<RpcClientState>('RpcClientState')({
  clientId: Schema.Number.pipe(
    Schema.optionalWith({
      exact: true,
      default: () => Math.round(Math.random() * 100000),
    }),
  ),
  quit: Schema.Boolean.pipe(Schema.optionalWith({ exact: true, default: () => false })),
}) {
  static decode = Schema.decodeUnknownSync(RpcClientState)

  static encode = Schema.encodeUnknownSync(RpcClientState)
}

export declare namespace SyncDurableServer {
  export type Options = {
    syncPath: string
    rpcPath: string
    layer: Layer.Layer<never>
    hibernatableWebSocketEventTimeout: number
    resetOnStartup: boolean
    syncAgentClientBinding: string | undefined
  }
}

export abstract class SyncDurableServer extends EventLogDurableObject {
  public options: SyncDurableServer.Options

  private rpcServer: ReturnType<ReturnType<typeof RpcServer.make>>

  private syncSessions: Map<WebSocket, Mutable<SyncSessionState>>

  private rpcClients: Map<WebSocket, Mutable<RpcClientState>>

  constructor(context: DurableObjectState, env: any, options: SyncDurableServer.Options) {
    // console.log("------------------ Sync Server Waked -------------------")

    const WithBaseLayer = flow(
      Layer.provideMerge(options.layer),
      Layer.provideMerge(
        Layer.mergeAll(
          CloudflareBindings.CloudflareBindings.fromEnv(env),
          CloudflareContext.CloudflareExecutionContext.fromContext(context, env),
          CacheStorage.fromGlobalCaches,
          Layer.setConfigProvider(makeConfigProvider(env)),
        ),
      ),
      Layer.provide(withGlobalLogLevel(env)),
      Layer.tapErrorCause(Effect.logError),
      Layer.orDie,
    )

    const StorageLive = pipe(
      SqlEventLogServer.layerStorageScoped({ sqlBatchSize: 32 }),
      Layer.provideMerge(SqliteClient.layer({ db: context.storage.sql })),
      WithBaseLayer,
    )

    super({
      ctx: context,
      env,
      storageLayer: StorageLive,
      config: {
        hibernatableWebSocketEventTimeout: options.hibernatableWebSocketEventTimeout,
      },
    })

    this.options = options

    const RpcServerLive = pipe(
      Layer.mergeAll(SyncServerRpcLive, SerializationLive),
      Layer.provide(Layer.succeed(DurableObject.StorageObjectState, context)),
      Layer.provide(
        Layer.succeed(DirectMessageHandler, {
          write: (chunk) => Effect.promise(() => this.runtime.runPromise(this.handleDirectMessage(chunk))),
          requestChanges: (startSequence) =>
            Effect.promise(() => this.runtime.runPromise(this.requestChanges(startSequence))),
        }),
      ),
      WithBaseLayer,
    )

    const make = RpcServer.make(SyncServerRpcs, RpcServerLive, {
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

    this.rpcServer = make({ disableTracing: true, concurrency: 'unbounded' })

    this.syncSessions = new Map()

    this.ctx.getWebSockets(WebsocketTags.Sync).forEach((websocket) => {
      this.syncSessions.set(websocket, SyncSessionState.decode(websocket.deserializeAttachment()))
    })

    this.rpcClients = new Map()

    this.ctx.getWebSockets(WebsocketTags.Rpc).forEach((websocket) => {
      this.rpcClients.set(websocket, RpcClientState.decode(websocket.deserializeAttachment()))
    })
  }

  /**
   * on initialize
   */
  abstract onInitialize(): Promise<void>

  /**
   * initialize
   */
  override async initialize(): Promise<void> {
    await this.onInitialize()

    if (this.options.resetOnStartup) {
      const identity = this.getIdentity()
      try {
        await this.ctx.storage.deleteAll()
        await this.ctx.storage.deleteAlarm()
        await this.ctx.storage.sync()
      } finally {
        Option.match(identity, {
          onNone: () => {},
          onSome: (_) => {
            this.ensure({ identity: _ })
          },
        })
      }
    }
  }

  /**
   * Get sync stats
   */
  abstract getSyncStats(): Promise<SyncStats>

  /**
   * Get sync client count
   */
  async getSyncClientCount(): Promise<number> {
    return Array.from(this.ctx.getWebSockets(WebsocketTags.Sync)).length
  }

  /**
   * set sync session
   */
  private setSyncSession(ws: WebSocket, meta: SyncSessionState): void {
    this.syncSessions.set(ws, meta)
    ws.serializeAttachment(SyncSessionState.encode(meta))
  }

  /**
   * Get the identity of the durable object
   */
  abstract getIdentity(): Option.Option<DurableObject.DurableObjectIdentitySchema>

  /**
   * ensure the identity is valid
   */
  abstract ensure(options: { identity: DurableObject.DurableObjectIdentitySchema }): void

  /**
   * Limit the request
   */
  abstract limit(): Effect.Effect<boolean, never, any>

  /**
   * Limit the write request
   */
  abstract writeLimit(): Effect.Effect<boolean, never, any>

  /**
   * on request
   */
  override onRequest(request: Request, [_clientWebsocket, serverWebsocket]: [WebSocket, WebSocket]): void {
    const sessionId = crypto.randomUUID()
    const userAgent = request.headers.get('user-agent') || ''
    const deviceInfo = Utils.detectDevice(userAgent) as {
      type: any
      os: any
      browser: any
    }

    this.setSyncSession(
      serverWebsocket,
      SyncSessionState.make({
        ...deviceInfo,
        id: sessionId,
        userAgent,
      }),
    )

    this.broadcastConnectedDevices()
  }

  /**
   * broadcast connected devices
   */
  private broadcastConnectedDevices(): void {
    const allSessionsMeta = Array.from(this.syncSessions.values())
    const websockets = this.ctx.getWebSockets(WebsocketTags.Sync)

    for (const websocket of websockets) {
      const currentSession = this.syncSessions.get(websocket)
      if (!currentSession) {
        continue
      }

      const otherSessions = allSessionsMeta
        .filter((meta) => meta !== currentSession)
        .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime())

      const sortedSessions = [currentSession, ...otherSessions]

      const devices = sortedSessions.map((meta) => new ConnectedDevice(meta))

      const message = new EventLogRemote.ConnectedDevices({
        devices: devices,
      })
      const encodedMessage = EventLogRemote.encodeResponse(message)

      websocket.send(encodedMessage)
    }
  }

  /**
   * on write entries
   */
  override async onWriteEntries(ws: WebSocket, _entries: ReadonlyArray<EventLogServer.PersistedEntry>): Promise<void> {
    const meta = this.syncSessions.get(ws)
    if (meta) {
      this.setSyncSession(
        ws,
        SyncSessionState.make({
          ...meta,
          lastSeenAt: new Date(),
        }),
      )
    }
  }

  /**
   * broadcast changes
   */
  override broadcastChanges(changes: ReadonlyArray<Uint8Array<ArrayBuffer>>): Effect.Effect<void> {
    if (!this.options.syncAgentClientBinding) {
      return Effect.void
    }

    return Effect.gen(this, function* () {
      const client = yield* SyncAgentClient

      yield* Effect.forEach(changes, (chunk) => client.write(this.remoteId, chunk), { discard: true })

      // only dev, broadcast changes to nodejs
      // yield* Effect.promise(() => fetch("http://localhost:9995/sync", { method: "post", body: changes[0] })).pipe(
      //   Effect.ignore,
      // )
    }).pipe(
      Effect.provide(SyncAgentClient.Live),
      Effect.provideService(SyncAgentClientConfig, {
        binding: this.options.syncAgentClientBinding,
        rpcPath: this.options.rpcPath,
      }),
      Effect.provideServiceEffect(
        FetchHttpClient.RequestInit,
        Effect.sync(() => {
          const headers = pipe(
            Option.map(this.getIdentity(), (_) => _.toHeaders()),
            Option.getOrElse(() => new Headers()),
          )

          return { headers }
        }),
      ),
    )
  }

  /**
   * fetch
   */
  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url)

    // ----- Event log sync -----

    if (pathname.startsWith(this.options.syncPath)) {
      return super.fetch(request)
    }

    // ---- RPC ----

    if (pathname.startsWith(this.options.rpcPath)) {
      const headersEither = DurableObject.DurableObjectIdentitySchema.fromHeaders(request.headers)

      if (Either.isLeft(headersEither)) {
        const error = headersEither.left
        const errorString = ParseResult.TreeFormatter.formatErrorSync(error)

        return new Response(errorString, { status: 400 })
      }

      const webSocketPair = new WebSocketPair()
      const [websocketClient, websocketServer] = Object.values(webSocketPair)

      const rpcClientState = RpcClientState.make()
      websocketServer.serializeAttachment(RpcClientState.encode(rpcClientState))
      this.rpcClients.set(websocketServer, rpcClientState)

      this.ctx.acceptWebSocket(websocketServer, [WebsocketTags.Rpc])

      return new Response(null, {
        status: 101,
        webSocket: websocketClient,
      })
    }

    return new Response(null, { status: 404 })
  }

  /**
   * on websocket message
   */
  override onWebSocketMessage(
    ws: WebSocket,
    message: string | ArrayBuffer,
  ): Effect.Effect<void, never, EventLogServer.Storage> {
    const syncSessionState = this.syncSessions.get(ws)
    const superOnWebsocketMessage = super.onWebSocketMessage.bind(this)

    const reject = (
      fn: (_: typeof EventLogRemote.ProtocolRequest.Type) => typeof EventLogRemote.ProtocolResponse.Type,
    ) => {
      const req = EventLogRemote.decodeRequest(Utils.toUint8Array(message))
      ws.send(EventLogRemote.encodeResponse(fn(req)))
    }

    if (!syncSessionState || syncSessionState.quit) {
      ws.close(1011, 'WebSocket broken.')
      return Effect.void
    }

    return Effect.gen(this, function* () {
      const identity = this.getIdentity()

      if (Option.isNone(identity)) {
        ws.close(1008, 'Invalid identity')
        return
      }

      const limitResult = yield* this.limit()

      if (!limitResult) {
        reject((req) => {
          const id = req._tag === 'WriteEntries' ? req.id : undefined

          return new EventLogRemote.Error({
            error: new ToManyRequests({ message: 'Too many requests' }),
            id,
          })
        })
        return
      }

      yield* superOnWebsocketMessage(ws, message)
    })
  }

  /**
   * on rpc socket message
   */
  async onRpcSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const rpcClientState = this.rpcClients.get(ws)
    if (!rpcClientState || rpcClientState.quit) {
      ws.close(1011, 'WebSocket broken.')
      return
    }

    const data = Utils.toUint8Array(message)

    await this.rpcServer.send(rpcClientState.clientId, data)
  }

  /**
   * web socket message
   */
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const tags = this.ctx.getTags(ws)

    await Utils.whenTags(tags, [
      [[WebsocketTags.Sync], () => this.runtime.runPromise(this.onWebSocketMessage(ws, message))],
      [[WebsocketTags.Rpc], () => this.onRpcSocketMessage(ws, message)],
    ])
  }

  /**
   * web socket error
   */
  override async webSocketError(ws: WebSocket, _error: Error): Promise<void> {
    const tags = this.ctx.getTags(ws)

    await Utils.whenTags(tags, [
      [
        [WebsocketTags.Sync],
        async () => {
          const syncSessionState = this.syncSessions.get(ws)
          if (syncSessionState) {
            syncSessionState.quit = true
          }

          this.syncSessions.delete(ws)
        },
      ],
      [
        [WebsocketTags.Rpc],
        async () => {
          const rpcClientState = this.rpcClients.get(ws)
          if (rpcClientState) {
            rpcClientState.quit = true
            this.rpcServer.close(rpcClientState.clientId)
          }
          this.rpcClients.delete(ws)

          if (this.rpcClients.size === 0) {
            await this.rpcServer.dispose()
          }
        },
      ],
    ])
  }

  /**
   * web socket close
   */
  override async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    const tags = this.ctx.getTags(ws)

    await Utils.whenTags(tags, [
      [
        [WebsocketTags.Sync],
        async () => {
          const syncSessionState = this.syncSessions.get(ws)
          if (syncSessionState) {
            syncSessionState.quit = true
          }
          this.syncSessions.delete(ws)

          this.broadcastConnectedDevices()

          await super.webSocketClose(ws, code, reason)
        },
      ],
      [
        [WebsocketTags.Rpc],
        async () => {
          const rpcClientState = this.rpcClients.get(ws)
          if (rpcClientState) {
            rpcClientState.quit = true
            this.rpcServer.close(rpcClientState.clientId)
          }
          this.rpcClients.delete(ws)

          if (this.rpcClients.size === 0) {
            await this.rpcServer.dispose()
          }
        },
      ],
    ])

    ws.close()
  }

  /**
   * destroy
   */
  async destroy(): Promise<void> {
    try {
      this.ctx.getWebSockets().forEach((ws) => {
        ws.close(1000)
      })
    } catch {}

    try {
      await this.ctx.storage.deleteAll()
      await this.ctx.storage.deleteAlarm()
      await this.ctx.storage.sync()
    } catch {}

    this.ctx.abort()
  }
}
