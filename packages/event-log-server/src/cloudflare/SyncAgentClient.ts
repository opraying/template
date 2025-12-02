/// <reference types="@cloudflare/workers-types" />

import { DurableObject } from 'cloudflare:workers'
import * as Reactivity from '@effect/experimental/Reactivity'
import * as FetchHttpClient from '@effect/platform/FetchHttpClient'
import * as SqlDo from '@effect/sql-sqlite-do/SqliteClient'
import * as CloudflareBindings from '@xstack/cloudflare/bindings'
import * as CacheStorage from '@xstack/cloudflare/cache-storage'
import { makeConfigProvider } from '@xstack/cloudflare/config-provider'
import * as CloudflareContext from '@xstack/cloudflare/execution-context'
import * as RpcServer from '@xstack/cloudflare/rpc-server'
import { CryptoLive } from '@xstack/event-log/CryptoWeb'
import { SettingsEvents } from '@xstack/event-log/DefaultEvents/Settings'
import type * as EventJournal from '@xstack/event-log/EventJournal'
import type { RemoteId } from '@xstack/event-log/EventJournal'
import * as EventLog from '@xstack/event-log/EventLog'
import * as EventLogConfig from '@xstack/event-log/EventLogConfig'
import * as EventLogEncryption from '@xstack/event-log/EventLogEncryption'
import * as EventLogRemote from '@xstack/event-log/EventLogRemote'
import * as EventLogStatesWorker from '@xstack/event-log/EventLogStatesWorker'
import * as Events from '@xstack/event-log/Events'
import * as Identity from '@xstack/event-log/Identity'
import * as IdentityStorage from '@xstack/event-log/IdentityStorage'
import { Default as IdentityLayer } from '@xstack/event-log/IdentityWorker'
import * as Migrator from '@xstack/event-log/Migrator'
import * as SqlEventJournal from '@xstack/event-log/SqlEventJournal'
import type { EventEmitter } from '@xstack/event-log/Utils'
import * as Utils from '@xstack/event-log/Utils'
import * as DurableObjectUtils from '@xstack/event-log-server/cloudflare/DurableObjectUtils'
import { SerializationLive, SyncAgentClientRpcs } from '@xstack/event-log-server/cloudflare/Rpc/SyncAgentClient'
import { SyncServerClient, SyncServerConfig } from '@xstack/event-log-server/cloudflare/Rpc/SyncServer'
import { SqlProxyLive, SyncStorageProxyConfig } from '@xstack/event-log-server/cloudflare/Rpc/SyncStorageProxy'
import * as SyncAgentClient from '@xstack/event-log-server/cloudflare/SyncAgentClient'
import { LoggerLive, withGlobalLogLevel } from '@xstack/server/logger'
import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Either from 'effect/Either'
import { flow, pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import * as ManagedRuntime from 'effect/ManagedRuntime'
import * as Option from 'effect/Option'
import * as ParseResult from 'effect/ParseResult'
import * as Runtime from 'effect/Runtime'
import * as Schema from 'effect/Schema'
import type * as Scope from 'effect/Scope'
import * as String from 'effect/String'
import type { Mutable } from 'effect/Types'

type Handle = (
  onRequest: (remoteId: typeof EventJournal.RemoteId.Type, chunk: Uint8Array<ArrayBufferLike>) => Effect.Effect<void>,
) => Effect.Effect<void, never, Scope.Scope>

export class SynAgentClientServerDataSources extends Context.Tag('@xstack/event-log/SynAgentClientServerDataSources')<
  SynAgentClientServerDataSources,
  Handle
>() {
  static fromEmitter(emitter: EventEmitter) {
    return Layer.scoped(
      this,
      Effect.gen(function* () {
        const handle = Effect.fnUntraced(function* (
          onRequest: (
            remoteId: typeof EventJournal.RemoteId.Type,
            chunk: Uint8Array<ArrayBufferLike>,
          ) => Effect.Effect<void>,
        ) {
          const runtime = yield* Effect.runtime<never>()
          const runFork = Runtime.runFork(runtime)

          const handleRequest = (_: [typeof EventJournal.RemoteId.Type, Uint8Array]) => runFork(onRequest(_[0], _[1]))

          emitter.on('request', handleRequest)

          yield* Effect.addFinalizer(() => Effect.sync(() => emitter.off('request', handleRequest)))
        })

        return handle
      }),
    )
  }
}

export interface EventLogNotify {
  notify: (remoteId: typeof EventJournal.RemoteId.Type, chunk: Uint8Array<ArrayBufferLike>) => Effect.Effect<void>
}
export const EventLogNotify = Context.GenericTag<EventLogNotify>('@xstack/event-log/EventLog/EventLogNotify')

const makeEventLogServerProxy = <A>(layer: Layer.Layer<A, never, SyncAgentClient.SynAgentClientServerDataSources>) => {
  let initialized = false
  const emitter = new Utils.EventEmitter()

  const Live: Layer.Layer<never> = layer.pipe(
    Layer.provide(SyncAgentClient.SynAgentClientServerDataSources.fromEmitter(emitter)),
  )

  let runtime = ManagedRuntime.make(Live)

  const init = async () => {
    await runtime.runtime()
    initialized = true
  }

  const send = async (remoteId: Uint8Array<ArrayBufferLike>, chunk: Uint8Array<ArrayBufferLike>) => {
    if (!initialized) {
      await init()
    }
    emitter.emit('request', [remoteId, chunk])
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

  return { init, send, dispose }
}

// oxlint-disable-next-line no-unused-vars
class AgentId extends Schema.NonEmptyString.pipe(
  Schema.compose(Schema.Trim),
  Schema.transform(Schema.String, {
    decode(a) {
      // Convert any string format to kebab-case (xxx-xxx)
      return a
        .replace(/([a-z])([A-Z])/g, '$1-$2') // camelCase to kebab-case
        .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2') // PascalCase to kebab-case
        .replace(/_/g, '-') // snake_case to kebab-case
        .replace(/\s+/g, '-') // spaces to hyphens
        .toLowerCase() // ensure lowercase
        .replace(/-+/g, '-') // remove duplicate hyphens
        .replace(/^-|-$/g, '') // remove leading/trailing hyphens
    },
    encode(a) {
      return a
    },
  }),
) {
  static Array = Schema.Array(this)

  static decode = Schema.decodeSync(AgentId.Array)
}

const EventLogIdentityLive = IdentityLayer.pipe(
  Layer.provide([CryptoLive, IdentityStorage.Live, FetchHttpClient.layer]),
)

const EventLogEncryptionLive = EventLogEncryption.layerSubtle.pipe(Layer.provide(CryptoLive))

const SqlDoLive = Layer.unwrapEffect(
  Effect.gen(function* () {
    const db = yield* DurableObjectUtils.DoSqlStorage
    return SqlDo.layer({
      db,
      transformQueryNames: String.camelToSnake,
      transformResultNames: String.snakeToCamel,
    })
  }),
)

const EventLogSqlEventJournalLive = SqlEventJournal.layer({
  sqlBatchSize: 32,
}).pipe(Layer.provide(SqlDoLive), Layer.orDie)

const EventLogLive = pipe(
  EventLog.layer,
  Layer.provide([EventLogSqlEventJournalLive, Reactivity.layer]),
  Layer.provide(Reactivity.layer),
)

const EventLogStatesLive = EventLogStatesWorker.EventLogStates.Default.pipe(
  Layer.provide([EventLogIdentityLive, EventLogLive, Reactivity.layer]),
)

const WebsocketTags = {
  Sync: 'SyncClient',
  Rpc: 'Rpc',
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

const EventLogSyncAgentLive = Layer.scopedDiscard(
  Effect.gen(function* () {
    const identity = yield* Identity.Identity
    const { incoming, outgoing } = yield* EventLogRemote.RemoteEventSources

    yield* EventLogConfig.EventLogMnemonic.pipe(
      Effect.flatMap((mnemonic) => identity.importFromMnemonic(mnemonic)),
      Effect.orDie,
    )

    const { register } = yield* EventLogRemote.init

    const syncServerClient = yield* SyncServerClient

    // Send the message back to the sync server
    yield* outgoing.listen((data) => {
      if (data._tag === 'RequestChanges') {
        return syncServerClient.requestChanges(data.startSequence).pipe(Effect.map((result) => result.changes))
      }

      return EventLogRemote.batchWrite(data, (chunk) =>
        syncServerClient.write(chunk).pipe(
          Effect.flatMap((result) =>
            Effect.gen(function* () {
              yield* incoming.publish([EventLogRemote.decodeResponse(result.response), result.response])

              yield* Effect.forEach(
                result.changes,
                (chunk) => incoming.publish([EventLogRemote.decodeResponse(chunk), chunk]),
                { discard: true },
              )
            }),
          ),
        ),
      )
    })

    let flag = false

    // Sync Agent received data
    yield* Effect.flatMap(SyncAgentClient.SynAgentClientServerDataSources, (handle) =>
      handle((remoteId, chunk) => {
        const handler = incoming.publish([EventLogRemote.decodeResponse(chunk), chunk])
        if (!flag) {
          flag = true
          return register(remoteId).pipe(Effect.zipRight(handler))
        }
        return handler
      }),
    )
  }),
).pipe(
  Layer.provide([
    EventLogIdentityLive,
    EventLogEncryptionLive,
    EventLogRemote.RemoteEventSources.Default,
    EventLogStatesLive,
    EventLogLive,
    SyncServerClient.Live,
  ]),
)

const SyncAgentServerLive = Layer.mergeAll(
  Reactivity.layer,
  EventLogIdentityLive,
  EventLogEncryptionLive,
  EventLogSyncAgentLive,
)

class DurableState extends Schema.Class<DurableState>('DurableState')({
  identity: DurableObjectUtils.DurableObjectIdentitySchema.pipe(
    Schema.Option,
    Schema.optionalWith({ exact: true, default: () => Option.none() }),
  ),
}) {
  static json = Schema.parseJson(DurableState)

  static decode(_: string) {
    return Schema.decodeSync(DurableState.json)(_)
  }

  static encode(_: typeof DurableState.Type) {
    return Schema.encodeSync(DurableState.json)(_)
  }
}

const SyncAgentClientRpcLive = SyncAgentClientRpcs.toLayer(
  Effect.gen(function* () {
    const state = yield* DurableObjectUtils.StorageObjectState
    const notify = yield* SyncAgentClient.EventLogNotify

    return {
      Write: Effect.fnUntraced(function* (payload: {
        remoteId: typeof RemoteId.Type
        change: Uint8Array<ArrayBufferLike>
      }) {
        return yield* notify.notify(payload.remoteId, payload.change)
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

export declare namespace SyncAgentClientDurableObject {
  export type Options = {
    rpcPath: string
    syncServerBinding: string
    syncProxyStorageBinding: string
    resetOnStartup: boolean
    hibernatableWebSocketEventTimeout: number
    layer: Layer.Layer<never>
    schemaSql: string
    migrations: Record<string, string>
    events: ReadonlyArray<Events.EventLogClient.Any>
  }
}

abstract class SyncAgentClientDurableObject extends DurableObject {
  private options: SyncAgentClientDurableObject.Options

  private state!: DurableState

  private eventLogServer: ReturnType<typeof makeEventLogServerProxy>

  private rpcServer: ReturnType<ReturnType<typeof RpcServer.make>>

  private rpcClients: Map<WebSocket, Mutable<RpcClientState>>

  constructor(ctx: DurableObjectState, env: any, options: SyncAgentClientDurableObject.Options) {
    // console.log("------------ Sync Agent Client Server Waked ------------")

    super(ctx, env)

    this.options = options

    this.ctx.setHibernatableWebSocketEventTimeout(this.options.hibernatableWebSocketEventTimeout)

    const WithBaseLayer = flow(
      Layer.provideMerge(options.layer),
      Layer.provideMerge(
        Layer.mergeAll(
          CloudflareBindings.CloudflareBindings.fromEnv(env),
          CloudflareContext.CloudflareExecutionContext.fromContext(this.ctx, env),
          CacheStorage.fromGlobalCaches,
          Layer.setConfigProvider(
            makeConfigProvider(env, () => [
              ['NAMESPACE', 'template'],
              ['SYNC.URL', 'http://localhost'],
              ['MNEMONIC', 'they sea craft payment ticket bind vague believe visit lady knife fox'],
            ]),
          ),
        ),
      ),
      Layer.provide([LoggerLive, withGlobalLogLevel(env)]),
      Layer.tapErrorCause(Effect.logError),
      Layer.orDie,
    )

    const DurableObjectIdentityLive = Layer.effect(
      FetchHttpClient.RequestInit,
      Effect.sync(() => {
        const headers = this.state.identity.pipe(
          Option.map((_) => _.toHeaders()),
          Option.getOrElse(() => new Headers()),
        )

        return { headers }
      }),
    )

    const MigratorLive = Migrator.fromRecord(() => ({
      schemaSql: this.options.schemaSql,
      migrations: this.options.migrations,
    }))

    const SqliteLive = pipe(
      Layer.effectDiscard(
        Effect.gen(function* () {
          const migrator = yield* Migrator.Migrator

          yield* migrator.start
        }),
      ),
      Layer.provide(MigratorLive),
      Layer.provideMerge(SqlProxyLive),
      Layer.provide(DurableObjectIdentityLive),
    )

    const EventLogServerLive = pipe(
      SyncAgentServerLive,
      Layer.provide(
        Layer.succeed(SyncServerConfig, {
          binding: this.options.syncServerBinding,
          rpcPath: this.options.rpcPath,
        }),
      ),
      Layer.provide(Events.register(SettingsEvents, ...this.options.events)),
      Layer.provide(DurableObjectIdentityLive),
      Layer.provideMerge(SqliteLive),
      Layer.provide(
        Layer.succeed(SyncStorageProxyConfig, {
          binding: this.options.syncProxyStorageBinding,
          rpcPath: this.options.rpcPath,
        }),
      ),
      Layer.provide(Layer.succeed(DurableObjectUtils.DoSqlStorage, ctx.storage.sql)),
      WithBaseLayer,
    )

    this.eventLogServer = makeEventLogServerProxy(EventLogServerLive)

    const RpcServerLive = pipe(
      Layer.mergeAll(SyncAgentClientRpcLive, SerializationLive),
      Layer.provide(Layer.succeed(DurableObjectUtils.StorageObjectState, ctx)),
      Layer.provide(
        Layer.succeed(SyncAgentClient.EventLogNotify, {
          notify: (remoteId, chunk) => Effect.promise(() => this.eventLogServer.send(remoteId, chunk)),
        }),
      ),
      WithBaseLayer,
    )

    const makeRpcServer = RpcServer.make(SyncAgentClientRpcs, RpcServerLive, {
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

    this.rpcServer = makeRpcServer({ disableTracing: true, concurrency: 'unbounded' })

    this.rpcClients = new Map()

    this.ctx.getWebSockets(WebsocketTags.Rpc).forEach((websocket) => {
      this.rpcClients.set(websocket, RpcClientState.decode(websocket.deserializeAttachment()))
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
    const value = await this.ctx.storage.get<string>('_state').catch(() => '')

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

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const { pathname } = url

    if (pathname.startsWith(this.options.rpcPath)) {
      const headersEither = DurableObjectUtils.DurableObjectIdentitySchema.fromHeaders(request.headers)

      if (Either.isLeft(headersEither)) {
        const error = headersEither.left
        const errorString = ParseResult.TreeFormatter.formatErrorSync(error)

        return new Response(errorString, { status: 400 })
      }

      const identity = headersEither.right

      this.ensure({ identity })

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

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const tags = this.ctx.getTags(ws)

    await Utils.whenTags(tags, [
      [
        [WebsocketTags.Rpc],
        async () => {
          const rpcClientState = this.rpcClients.get(ws)
          if (!rpcClientState || rpcClientState.quit) {
            ws.close(1011, 'WebSocket broken.')
            return
          }

          const data = Utils.toUint8Array(message)

          await this.rpcServer.send(rpcClientState.clientId, data)
        },
      ],
    ])
  }

  override async webSocketError(ws: WebSocket, _error: Error): Promise<void> {
    const tags = this.ctx.getTags(ws)

    await Utils.whenTags(tags, [
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

  override async webSocketClose(ws: WebSocket, _code: number, _reason: string): Promise<void> {
    const tags = this.ctx.getTags(ws)

    await Utils.whenTags(tags, [
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
}

export const makeDurableObject = (options: {
  rpcPath?: string | undefined
  syncProxyStorageBinding: string
  syncServerBinding: string
  resetOnStartup?: boolean | undefined
  hibernatableWebSocketEventTimeout?: number | undefined
  layer?: Layer.Layer<never> | undefined
  schemaSql?: string | undefined
  migrations?: Record<string, string> | undefined
  events: ReadonlyArray<Events.EventLogClient.Any>
}) => {
  class SyncAgentClientDurableObjectServer extends SyncAgentClientDurableObject {
    constructor(state: DurableObjectState, env: any) {
      super(state, env, {
        rpcPath: options.rpcPath ?? '/rpc',
        syncServerBinding: options.syncServerBinding,
        syncProxyStorageBinding: options.syncProxyStorageBinding,
        resetOnStartup: options.resetOnStartup ?? false,
        hibernatableWebSocketEventTimeout: options.hibernatableWebSocketEventTimeout ?? 5000,
        layer: options.layer ?? Layer.empty,
        schemaSql: options.schemaSql ?? '',
        migrations: options.migrations ?? {},
        events: options.events,
      })
    }

    async onInitialize(): Promise<void> {}
  }

  return SyncAgentClientDurableObjectServer
}

export const makeWorker = (options: {
  rpcPath?: string | undefined
  durableObjectPrefix?: string | undefined
  durableObjectBinding: string
}) => {
  return {
    fetch(request: Request, env: Record<string, any>) {
      const url = new URL(request.url)
      const { pathname } = url

      const rpcPath = options?.rpcPath ?? '/rpc'
      const durableObjectPrefix = options?.durableObjectPrefix ?? 'sync-agent-client'
      const durableObjectBinding = options.durableObjectBinding

      if (pathname.startsWith(rpcPath)) {
        const headers = request.headers
        const upgradeHeader = headers.get('Upgrade')

        if (!upgradeHeader || upgradeHeader !== 'websocket') {
          return new Response(null, {
            status: 426,
            statusText: 'Durable Object expected Upgrade: websocket',
          })
        }

        const identityEither = DurableObjectUtils.DurableObjectIdentitySchema.fromHeaders(headers)

        if (Either.isLeft(identityEither)) {
          const error = identityEither.left
          const errorString = ParseResult.TreeFormatter.formatErrorSync(error)
          return new Response(errorString, { status: 400 })
        }

        const identity = identityEither.right
        const durableObjectIdentity = `${identity.id()}::${durableObjectPrefix}`

        const doNamespace = env[durableObjectBinding] as DurableObjectNamespace
        const durableObjectId = doNamespace.idFromName(durableObjectIdentity)
        const stub = doNamespace.get(durableObjectId) as unknown as SyncAgentClientDurableObject

        return stub.fetch(request)
      }

      return new Response(null, { status: 404 })
    },
  } satisfies ExportedHandler<any>
}
