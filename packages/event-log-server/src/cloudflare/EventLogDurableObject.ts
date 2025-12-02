/// <reference types="@cloudflare/workers-types" />

import { DurableObject } from 'cloudflare:workers'
import * as EventJournal from '@xstack/event-log/EventJournal'
import * as EventLogRemote from '@xstack/event-log/EventLogRemote'
import * as EventLogServer from '@xstack/event-log/EventLogServer'
import { toUint8Array } from '@xstack/event-log/Utils'
import * as Cause from 'effect/Cause'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import type * as Layer from 'effect/Layer'
import * as ManagedRuntime from 'effect/ManagedRuntime'

interface WriteStats {
  count: number
  lastFlushTime: number
}

export interface RequestProcessingResult {
  success: boolean
  response?: Uint8Array<ArrayBufferLike> | undefined
  sequenceNumbers?: number[] | undefined
  changes?: ReadonlyArray<Uint8Array<ArrayBufferLike>> | undefined
  entries?: ReadonlyArray<EventLogServer.PersistedEntry> | undefined
  error?: Error | unknown
}

export type WriteResult =
  | {
      success: false
      error?: Error | unknown
    }
  | {
      success: true
      response: Uint8Array<ArrayBufferLike>
      changes: ReadonlyArray<Uint8Array<ArrayBufferLike>>
    }

export const WebsocketTag = 'EventLogSync'
const STORAGE_STATS_KEY = 'write_stats'
const REMOTE_ID_KEY = 'remote_id'

export abstract class EventLogDurableObject extends DurableObject {
  private readonly FLUSH_INTERVAL = 5000

  public readonly runtime: ManagedRuntime.ManagedRuntime<EventLogServer.Storage, never>

  private writeStats: WriteStats = {
    count: 0,
    lastFlushTime: Date.now(),
  }

  public remoteId!: typeof EventJournal.RemoteId.Type

  private chunks = new Map<
    number,
    {
      readonly parts: Array<Uint8Array>
      count: number
      bytes: number
    }
  >()

  constructor(options: {
    readonly ctx: DurableObjectState
    readonly env: any
    readonly storageLayer: Layer.Layer<EventLogServer.Storage>
    readonly config: {
      hibernatableWebSocketEventTimeout?: number | undefined
    }
  }) {
    super(options.ctx as any, options.env)

    this.ctx.setHibernatableWebSocketEventTimeout(options.config.hibernatableWebSocketEventTimeout ?? 5000)

    this.ctx.storage.sql.exec('PRAGMA foreign_keys = OFF;')

    this.runtime = ManagedRuntime.make(options.storageLayer)

    this.ctx.blockConcurrencyWhile(async () => {
      await this.internalState()
    })
  }

  /**
   * initialize
   */
  abstract initialize(): Promise<void>

  /**
   * internal state
   */
  private async internalState() {
    const stats = await this.ctx.storage.get<{
      count: number
      lastFlushTime: number
    }>(STORAGE_STATS_KEY)

    if (stats) {
      this.writeStats = stats
    } else {
      this.writeStats = {
        count: 0,
        lastFlushTime: Date.now(),
      }
      this.persistStats()
    }

    const remoteId = await this.ctx.storage.get<typeof EventJournal.RemoteId.Type>(REMOTE_ID_KEY)
    if (remoteId) {
      this.remoteId = remoteId
    }

    await this.initialize()
  }

  /**
   * persist stats
   */
  private persistStats(): void {
    this.ctx.waitUntil(this.ctx.storage.put(STORAGE_STATS_KEY, this.writeStats))
  }

  /**
   * Accumulate write entries count and flush if interval passed
   */
  private logWriteStats(count: number): void {
    const now = Date.now()
    const timeDiff = now - this.writeStats.lastFlushTime

    this.writeStats.count += count

    if (timeDiff >= this.FLUSH_INTERVAL) {
      this.writeStats.lastFlushTime = now
      this.persistStats()
    }
  }

  /**
   * get write stats
   */
  public getWriteStats(): WriteStats {
    return this.writeStats
  }

  /**
   * on request
   */
  abstract onRequest(request: Request, websocketPair: [WebSocket, WebSocket]): void

  async fetch(request: Request): Promise<Response> {
    const webSocketPair = new WebSocketPair()
    const [websocketClient, websocketServer] = Object.values(webSocketPair)

    this.ctx.acceptWebSocket(websocketServer, [WebsocketTag])

    this.ctx.waitUntil(
      pipe(
        Effect.sync(() => this.remoteId),
        Effect.filterOrElse(
          (localRemoteId) => typeof localRemoteId !== 'undefined',
          () => Effect.flatMap(EventLogServer.Storage, (storage) => storage.getId),
        ),
        Effect.tap((remoteId) =>
          Effect.sync(() => {
            const id = EventJournal.RemoteId.make(remoteId)

            this.remoteId = id
            this.ctx.storage.put(REMOTE_ID_KEY, id)

            websocketServer.send(
              EventLogRemote.encodeResponse(
                new EventLogRemote.Hello({
                  remoteId: id,
                }),
              ),
            )

            this.onRequest(request, [websocketClient, websocketServer])
          }),
        ),
        Effect.catchAllCause((_cause) => Effect.void),
        this.runtime.runPromise,
      ),
    )

    return new Response(null, {
      status: 101,
      webSocket: websocketClient,
    })
  }

  /**
   * Limit the request
   */
  abstract limit(): Effect.Effect<boolean, never, any>

  /**
   * Limit the write request
   */
  abstract writeLimit(): Effect.Effect<boolean, never, any>

  /**
   * On write entries
   */
  abstract onWriteEntries(ws: WebSocket, entries: ReadonlyArray<EventLogServer.PersistedEntry>): Promise<void>

  /**
   * Broadcast changes
   */
  abstract broadcastChanges(changes: ReadonlyArray<Uint8Array<ArrayBufferLike>>): Effect.Effect<void>

  /**
   * Broadcast changes to clients
   */
  private broadcastChangesToClients(
    changes: ReadonlyArray<Uint8Array<ArrayBufferLike>>,
    ws?: WebSocket | undefined,
  ): void {
    for (const peer of this.ctx.getWebSockets(WebsocketTag)) {
      if (ws && peer === ws) continue
      for (const change of changes) {
        peer.send(change)
      }
    }
  }

  /**
   * Pure request processing logic - only handles request data
   */
  private handleRequest(
    request: typeof EventLogRemote.ProtocolRequest.Type,
    options: {
      shouldCheckPolicy: boolean
    },
  ): Effect.Effect<RequestProcessingResult, never, EventLogServer.Storage> {
    switch (request._tag) {
      case 'WriteEntries': {
        return Effect.gen(this, function* () {
          if (options.shouldCheckPolicy) {
            const canWrite = yield* this.writeLimit()
            if (!canWrite) {
              const response = EventLogRemote.encodeResponse(
                new EventLogRemote.Ack({
                  id: request.id,
                  sequenceNumbers: [],
                }),
              )
              return { success: false, response, sequenceNumbers: [] }
            }
          }

          const storage = yield* EventLogServer.Storage
          const entries = request.encryptedEntries.map(
            ({ encryptedEntry, entryId }) =>
              new EventLogServer.PersistedEntry({
                entryId,
                iv: request.iv,
                encryptedEntry,
                encryptedDEK: request.encryptedDEK,
              }),
          )
          const encryptedEntries = yield* storage.write(entries)

          const sequenceNumbers = encryptedEntries.map((_) => _.sequence)

          const response = EventLogRemote.encodeResponse(
            new EventLogRemote.Ack({
              id: request.id,
              sequenceNumbers,
            }),
          )

          this.logWriteStats(entries.length)

          const changes = EventLogRemote.splitChangesResponse(encryptedEntries)

          return {
            success: true,
            response,
            sequenceNumbers,
            changes,
            entries,
          }
        })
      }
      case 'ChunkedMessage': {
        const data = EventLogRemote.ChunkedMessage.join(this.chunks, request)
        if (!data) return Effect.succeed({ success: true })
        return this.handleRequest(EventLogRemote.decodeRequest(data), options)
      }
      case 'RequestChanges': {
        return this.requestChanges(request.startSequence)
      }
      default:
        return Effect.succeed({
          success: false,
          error: `Unknown request type: ${(request as any)._tag}`,
        })
    }
  }

  /**
   * Request changes
   */
  public requestChanges(startSequence: number): Effect.Effect<WriteResult, never, EventLogServer.Storage> {
    return Effect.gen(this, function* () {
      const storage = yield* EventLogServer.Storage
      const entries = yield* storage.entries(startSequence)
      if (entries.length === 0) return { success: true, response: new Uint8Array(), changes: [] }
      const changes = EventLogRemote.splitChangesResponse(entries)
      return { success: true, response: new Uint8Array(), changes }
    })
  }

  /**
   * WebSocket message handler
   */
  private handleWebSocketRequest(
    ws: WebSocket,
    request: typeof EventLogRemote.ProtocolRequest.Type,
  ): Effect.Effect<void, never, EventLogServer.Storage> {
    return Effect.gen(this, function* () {
      const result = yield* this.handleRequest(request, { shouldCheckPolicy: true })

      if (request._tag === 'WriteEntries' || request._tag === 'ChunkedMessage') {
        if (result.response) ws.send(result.response)

        if (result.changes) {
          this.broadcastChangesToClients(result.changes, ws)

          yield* this.broadcastChanges(result.changes).pipe(
            Effect.catchAllCause(Effect.logError),
            Effect.catchAllDefect(Effect.logError),
          )
        }
      }

      if (request._tag === 'RequestChanges') {
        if (result.changes) {
          for (const change of result.changes) {
            ws.send(change)
          }
        }
      }

      if (request._tag === 'Ping') {
        return
      }

      if (request._tag === 'StopChanges') {
        return
      }
    }).pipe(
      Effect.catchAllCause((cause) => Effect.logError('WebSocket request handling error:', cause)),
      Effect.catchAllDefect((cause) => Effect.logError('WebSocket request handling error:', cause)),
    )
  }

  /**
   * Handle message directly without WebSocket dependency and policy checks
   */
  public handleDirectMessage(
    message: Uint8Array<ArrayBufferLike>,
  ): Effect.Effect<WriteResult, never, EventLogServer.Storage> {
    return Effect.gen(this, function* () {
      try {
        const request = EventLogRemote.decodeRequest(message)
        const result = yield* this.handleRequest(request, { shouldCheckPolicy: true })

        if (!result.success) {
          return {
            success: false,
            error: result.error,
          }
        }

        if (request._tag === 'WriteEntries' || request._tag === 'ChunkedMessage') {
          if (result.changes) {
            this.broadcastChangesToClients(result.changes)

            // await this.broadcastChanges(result.changes).pipe(this.runtime.runPromise)
          }
        }

        return {
          success: result.success,
          response: result.response ?? new Uint8Array(),
          changes: result.changes ?? [],
        }
      } catch (error) {
        return {
          success: false,
          error: error,
        }
      }
    })
  }

  /**
   * on web socket message
   */
  onWebSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Effect.Effect<void, never, EventLogServer.Storage> {
    try {
      const data = EventLogRemote.decodeRequest(toUint8Array(message))
      return this.handleWebSocketRequest(ws, data)
    } catch {
      return Effect.void
    }
  }

  /**
   * on web socket error
   */
  async webSocketError(_ws: WebSocket, error: Error): Promise<void> {
    console.warn(Cause.pretty(Cause.fail(error)))
  }

  /**
   * on web socket close
   */
  async webSocketClose(_ws: WebSocket, _code: number, _reason: string): Promise<void> {
    if (this.writeStats.count > 0) {
      this.persistStats()
    }
  }
}

export interface CheckResult {
  passed: boolean
  code?: number | undefined
  reason?: string | undefined
}
