/**
 * EventLogRemote module provides functionality for remote event synchronization.
 * Handles WebSocket communication, message chunking, and encrypted event transfer.
 */

import { EncryptedDEK } from '@xstack/event-log/Crypto'
import { type ToManyRequests, WriteTimeoutError } from '@xstack/event-log/Error'
import * as EventJournal from '@xstack/event-log/EventJournal'
import * as EventLog from '@xstack/event-log/EventLog'
import * as EventLogConfig from '@xstack/event-log/EventLogConfig'
import * as EventLogEncryption from '@xstack/event-log/EventLogEncryption'
import * as EventLogStates from '@xstack/event-log/EventLogStates'
import * as Identity from '@xstack/event-log/Identity'
import * as Metrics from '@xstack/event-log/Metrics'
import * as MsgPack from '@xstack/event-log/MsgPack'
import * as EventLogSchema from '@xstack/event-log/Schema'
import { MessageError, type WriteError } from '@xstack/event-log/Types'
import * as Utils from '@xstack/event-log/Utils'
import * as Cause from 'effect/Cause'
import * as Clock from 'effect/Clock'
import * as Context from 'effect/Context'
import * as Deferred from 'effect/Deferred'
import * as Duration from 'effect/Duration'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import type * as Fiber from 'effect/Fiber'
import { constVoid, pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import * as Mailbox from 'effect/Mailbox'
import * as Option from 'effect/Option'
import * as Queue from 'effect/Queue'
import * as Schema from 'effect/Schema'
import * as Scope from 'effect/Scope'
import * as Stream from 'effect/Stream'
import * as SubscriptionRef from 'effect/SubscriptionRef'
import * as Uuid from 'uuid'

const constChunkSize = 800_000 // 800KB, leaving ~248KB for protocol overhead

/**
 * Initial handshake message sent by the server.
 * @since 1.0.0
 * @category protocol
 */
export class Hello extends Schema.TaggedClass<Hello>('@xstack/event-log/EventLogRemote/Hello')('Hello', {
  remoteId: EventJournal.RemoteId,
}) {}

/**
 * Message chunking for large payloads.
 * Handles splitting and reassembly of messages that exceed size limits.
 * @since 1.0.0
 * @category protocol
 */
export class ChunkedMessage extends Schema.TaggedClass<ChunkedMessage>(
  '@xstack/event-log/EventLogRemote/ChunkedMessage',
)('ChunkedMessage', {
  id: Schema.Number,
  part: Schema.Tuple(Schema.Number, Schema.Number),
  data: Schema.Uint8ArrayFromSelf,
}) {
  /**
   * Split a large message into chunks
   * @since 1.0.0
   */
  static split(id: number, data: Uint8Array<ArrayBufferLike>): ReadonlyArray<ChunkedMessage> {
    const parts = Math.ceil(data.byteLength / constChunkSize)
    const result: Array<ChunkedMessage> = Array.from({ length: parts })
    for (let i = 0; i < parts; i++) {
      const start = i * constChunkSize
      const end = Math.min((i + 1) * constChunkSize, data.byteLength)
      result[i] = new ChunkedMessage({ id, part: [i, parts], data: data.subarray(start, end) })
    }
    return result
  }

  /**
   * Reassemble chunks into complete message
   * @since 1.0.0
   */
  static join(
    map: Map<
      number,
      {
        readonly parts: Array<Uint8Array>
        count: number
        bytes: number
      }
    >,
    part: ChunkedMessage,
  ): Uint8Array<ArrayBufferLike> | undefined {
    const [index, total] = part.part
    let entry = map.get(part.id)
    if (!entry) {
      entry = {
        parts: Array.from({ length: total }),
        count: 0,
        bytes: 0,
      }
      map.set(part.id, entry)
    }
    entry.parts[index] = part.data
    entry.count++
    entry.bytes += part.data.byteLength
    if (entry.count !== total) {
      return
    }
    const data = new Uint8Array(entry.bytes)
    let offset = 0
    for (const part of entry.parts) {
      data.set(part, offset)
      offset += part.byteLength
    }
    map.delete(part.id)
    return data
  }
}

/**
 * @since 1.0.0
 * @category protocol
 */
export class WriteEntries extends Schema.TaggedClass<WriteEntries>('@xstack/event-log/EventLogRemote/WriteEntries')(
  'WriteEntries',
  {
    id: Schema.Number,
    iv: Schema.Uint8ArrayFromSelf,
    encryptedEntries: Schema.Array(EventLogEncryption.EncryptedEntry),
    encryptedDEK: EncryptedDEK,
  },
) {}

/**
 * @since 1.0.0
 * @category protocol
 */
export class Ack extends Schema.TaggedClass<Ack>('@xstack/event-log/EventLogRemote/Ack')('Ack', {
  id: Schema.Number,
  sequenceNumbers: Schema.Array(Schema.Number),
}) {}

/**
 * @since 1.0.0
 * @category protocol
 */
export class Error extends Schema.TaggedClass<Error>('@xstack/event-log/EventLogRemote/Error')('Error', {
  error: MessageError,
  id: Schema.Number.pipe(Schema.optional),
}) {}

/**
 * @since 1.0.0
 * @category protocol
 */
export class RequestChanges extends Schema.TaggedClass<RequestChanges>(
  '@xstack/event-log/EventLogRemote/RequestChanges',
)('RequestChanges', {
  startSequence: Schema.Number,
}) {}

/**
 * @since 1.0.0
 * @category protocol
 */
export class Changes extends Schema.TaggedClass<Changes>('@xstack/event-log/EventLogRemote/Changes')('Changes', {
  entries: Schema.Array(EventLogEncryption.EncryptedRemoteEntry),
}) {}

/**
 * @since 1.0.0
 * @category protocol
 */
export class StopChanges extends Schema.TaggedClass<StopChanges>('@xstack/event-log/EventLogRemote/StopChanges')(
  'StopChanges',
  {
    publicKey: Schema.String,
  },
) {}

/**
 * @since 1.0.0
 * @category protocol
 */
export class Ping extends Schema.TaggedClass<Ping>('@xstack/event-log/EventLogRemote/Ping')('Ping', {
  id: Schema.Number,
}) {}

/**
 * @since 1.0.0
 * @category protocol
 */
export class Pong extends Schema.TaggedClass<Pong>('@xstack/event-log/EventLogRemote/Pong')('Pong', {
  id: Schema.Number,
}) {}

/**
 * @since 1.0.0
 * @category protocol
 */
export class ConnectedDevices extends Schema.TaggedClass<ConnectedDevices>(
  '@xstack/event-log/EventLogRemote/ConnectedDevices',
)('ConnectedDevices', {
  devices: Schema.Array(EventLogSchema.ConnectedDevice),
}) {}

/**
 * @since 1.0.0
 * @category protocol
 */
export const ProtocolRequest = Schema.Union(WriteEntries, RequestChanges, StopChanges, ChunkedMessage, Ping)

/**
 * @since 1.0.0
 * @category protocol
 */
export const ProtocolRequestMsgPack = MsgPack.schema(ProtocolRequest)

/**
 * @since 1.0.0
 * @category protocol
 */
export const decodeRequest = Schema.decodeSync(ProtocolRequestMsgPack)

/**
 * @since 1.0.0
 * @category protocol
 */
export const encodeRequest = Schema.encodeSync(ProtocolRequestMsgPack)

/**
 * @since 1.0.0
 * @category protocol
 */
export const ProtocolResponse = Schema.Union(Hello, Ack, Changes, ChunkedMessage, Pong, Error, ConnectedDevices)

/**
 * @since 1.0.0
 * @category protocol
 */
export const ProtocolResponseMsgPack = MsgPack.schema(ProtocolResponse)

/**
 * @since 1.0.0
 * @category protocol
 */
export const decodeResponse = Schema.decodeSync(ProtocolResponseMsgPack)

/**
 * @since 1.0.0
 * @category protocol
 */
export const encodeResponse = Schema.encodeSync(ProtocolResponseMsgPack)

/**
 * Splits large Changes responses into chunks that fit within WebSocket limits
 * @param entries - Array of encrypted remote entries
 * @returns Array of encoded message chunks
 */
export function splitChangesResponse(
  entries: ReadonlyArray<EventLogEncryption.EncryptedRemoteEntry>,
): ReadonlyArray<Uint8Array> {
  let changes = [
    encodeResponse(
      new Changes({
        entries,
      }),
    ),
  ]
  if (changes[0].byteLength > constChunkSize) {
    const randomId = Math.floor(Math.random() * 1_000_000_000)
    changes = ChunkedMessage.split(randomId, changes[0]).map((_) => encodeResponse(_))
  }
  return changes
}

const RemoteIdEquivalence = Option.getEquivalence<EventJournal.RemoteId>((a, b) => {
  return Utils.areArrayBuffersEqual(a, b)
})

export const batchWrite = <E = never>(
  request: typeof ProtocolRequest.Type,
  write: (_: Uint8Array<ArrayBufferLike>) => Effect.Effect<void, E>,
): Effect.Effect<void, E> =>
  Effect.gen(function* () {
    const data = encodeRequest(request)

    if (request._tag !== 'WriteEntries' || data.byteLength <= constChunkSize) {
      yield* Metrics.eventWriteMessageSize(Effect.succeed(data.byteLength))
      return yield* write(data).pipe(
        Effect.annotateSpans({
          'remote.operation': 'write_message',
          'message.type': request._tag,
          'message.size': data.byteLength.toString(),
        }),
        Effect.withSpan('EventLogRemote.writeMessage'),
      )
    }

    const id = request.id
    const parts = ChunkedMessage.split(id, data)

    const batchParts = parts.map((_) => encodeRequest(_))
    const batchPartsSize = batchParts.reduce((acc, _) => acc + _.byteLength, 0)
    yield* Metrics.eventWriteMessageSize(Effect.succeed(batchPartsSize))
    yield* Effect.forEach(batchParts, (i) => write(i), { discard: true, concurrency: 1 }).pipe(
      Effect.annotateSpans({
        'remote.operation': 'write_parts',
        'message.type': request._tag,
        'message.size': batchPartsSize,
      }),
      Effect.withSpan('EventLogRemote.writeBatch'),
    )
  })

type EventSources<A> = {
  publish: (_: A) => Effect.Effect<void, never, never>
  listen: <E = never>(
    fn: (_: A) => Effect.Effect<void, E>,
  ) => Effect.Effect<Fiber.RuntimeFiber<never, never>, E, Scope.Scope>
}

export class RemoteEventSources extends Context.Tag('@xstack/event-log/EventLogRemoteEventSources')<
  RemoteEventSources,
  {
    incoming: EventSources<[typeof ProtocolResponse.Type, Uint8Array]>
    outgoing: EventSources<typeof ProtocolRequest.Type>
  }
>() {
  static Default = Layer.effect(
    this,
    Effect.gen(function* () {
      const make = <A>() =>
        Effect.gen(function* () {
          const queue = yield* Queue.unbounded<A>()

          const publish = (data: A) => Effect.asVoid(queue.offer(data))

          const listen = <E = never>(write: (data: A) => Effect.Effect<void, E, never>) =>
            pipe(
              queue.take,
              Effect.flatMap((data) => write(data)),
              Effect.catchAllCause(Effect.logError),
              Effect.forever,
              Effect.interruptible,
              Effect.forkScoped,
            )

          return {
            publish,
            listen,
          }
        })

      const incoming = yield* make<[typeof ProtocolResponse.Type, Uint8Array]>()
      const outgoing = yield* make<typeof ProtocolRequest.Type>()

      return {
        incoming,
        outgoing,
      }
    }),
  )
}

export const init = Effect.gen(function* () {
  const { runtime } = yield* EventLogConfig.EventLogConfig.pipe(Effect.orDie)

  let pendingCounter = 0
  const pending = new Map<
    number,
    {
      readonly entries: ReadonlyArray<EventJournal.Entry>
      readonly deferred: Deferred.Deferred<void, WriteError>
    }
  >()
  const chunks = new Map<
    number,
    {
      readonly parts: Array<Uint8Array>
      count: number
      bytes: number
    }
  >()
  let registeredRemoteId: EventJournal.RemoteId | undefined
  const scope = yield* Effect.scope
  const remoteLatch = yield* Effect.makeLatch(false)
  const remoteIdRef = yield* SubscriptionRef.make<Option.Option<EventJournal.RemoteId>>(Option.none())
  const log = yield* EventLog.EventLog
  const encryption = yield* EventLogEncryption.EventLogEncryption
  const identity = yield* Identity.Identity
  const { incoming, outgoing } = yield* RemoteEventSources
  const { remoteSyncFlag, localSyncEvent, devicesStatus } = yield* EventLogStates.EventLogStates

  const mailbox = yield* Mailbox.make<EventJournal.RemoteEntry>()

  const write = (request: typeof ProtocolRequest.Type) => remoteLatch.whenOpen(outgoing.publish(request))

  const registerRemote = (remoteId: EventJournal.RemoteId) =>
    log
      .registerRemote({
        id: remoteId,
        write: Effect.fn(
          function* (entries) {
            if (entries.length === 0) {
              return Exit.void
            }

            const startTime = yield* Clock.currentTimeMillis
            const encrypted = yield* encryption.encrypt(identity, entries).pipe(
              Effect.tapErrorCause((cause) =>
                Effect.logError('Failed to encrypt entries').pipe(Effect.annotateLogs({ cause: Cause.pretty(cause) })),
              ),
              Effect.orDie,
            )

            const deferred = yield* Deferred.make<void, WriteError>()
            const id = pendingCounter++
            pending.set(id, {
              entries,
              deferred,
            })

            yield* Effect.annotateCurrentSpan({
              'write.id': id.toString(),
              'entries.count': entries.length.toString(),
            })
            yield* Effect.annotateLogsScoped({
              'write.id': id.toString(),
              'entries.count': entries.length.toString(),
            })

            yield* write(
              new WriteEntries({
                id,
                iv: encrypted.iv,
                encryptedEntries: encrypted.encryptedEntries.map((encryptedEntry, i) => ({
                  entryId: entries[i].id,
                  encryptedEntry,
                })),
                encryptedDEK: encrypted.encryptedDEK,
              }),
            )

            return yield* Deferred.await(deferred).pipe(
              Effect.timeout('2 seconds'),
              Effect.flatMap(() => Clock.currentTimeMillis),
              Effect.catchTag('TimeoutException', (e) => new WriteTimeoutError({ message: e.message })),
              Effect.exit,
              Effect.tap((exit) =>
                Exit.match(exit, {
                  onSuccess: (endTime) => {
                    const duration = endTime - startTime
                    return Effect.all(
                      [Metrics.syncSuccessCount(Effect.succeed(1)), Metrics.syncLatency(Effect.succeed(duration))],
                      { concurrency: 'unbounded', discard: true },
                    )
                  },
                  onFailure: () =>
                    Effect.all([Metrics.syncErrorCount(Effect.succeed(1))], {
                      concurrency: 'unbounded',
                      discard: true,
                    }),
                }),
              ),
              Effect.map(Exit.map(constVoid)),
            )
          },
          Effect.scoped,
          Effect.withSpan('EventLogRemote.writeEntries'),
          Effect.annotateLogs({
            'remote.operation': 'write_entries',
          }),
          Effect.annotateSpans({
            'remote.operation': 'write_entries',
          }),
        ),
        changes: Effect.fn(
          function* (startSequence) {
            yield* Effect.annotateCurrentSpan({
              start_sequence: startSequence.toString(),
            })

            yield* Effect.logDebug(`Requesting changes from remote, id: ${startSequence}`)

            yield* write(
              new RequestChanges({
                startSequence,
              }),
            )

            return mailbox
          },
          Effect.annotateSpans({
            'remote.operation': 'request_changes',
          }),
        ),
      })
      .pipe(
        Effect.annotateLogs({
          runtime: runtime,
        }),
        Effect.annotateSpans({
          runtime: runtime,
        }),
        Scope.extend(scope),
      )

  const handleMessage = (
    res: typeof ProtocolResponse.Type,
    raw: Uint8Array<ArrayBufferLike>,
  ): Effect.Effect<void, ToManyRequests, never> => {
    switch (res._tag) {
      case 'Hello': {
        return SubscriptionRef.set(remoteIdRef, Option.some(res.remoteId)).pipe(
          Effect.zipRight(remoteLatch.open),
          Effect.zipLeft(Metrics.remoteMessageSize(Effect.succeed(raw.byteLength))),
        )
      }

      case 'Ack': {
        return Effect.gen(function* () {
          const entry = pending.get(res.id)
          if (!entry) return
          pending.delete(res.id)
          const { deferred, entries } = entry
          const remoteEntries = res.sequenceNumbers.map((sequenceNumber, i) => {
            const entry = entries[i]
            return new EventJournal.RemoteEntry({
              remoteSequence: sequenceNumber,
              entry,
            })
          })

          // yield* Effect.logDebug(`Processing Ack entries, id: ${res.id}`).pipe(
          //   Effect.annotateLogs({
          //     "entries.count": remoteEntries.length.toString(),
          //   }),
          // )

          yield* Effect.annotateCurrentSpan({
            'write.id': res.id.toString(),
            'entries.count': remoteEntries.length.toString(),
          })

          yield* mailbox.offerAll(remoteEntries)

          yield* Deferred.done(deferred, Exit.void)
        }).pipe(
          Effect.zipLeft(Metrics.remoteMessageSize(Effect.succeed(raw.byteLength))),
          Effect.annotateSpans({
            'remote.operation': 'log_ack',
          }),
        )
      }

      case 'Pong': {
        return Effect.void
      }

      case 'ConnectedDevices': {
        return Effect.gen(function* () {
          yield* devicesStatus.upsert({
            devices: res.devices,
          })
        }).pipe(
          Effect.zipLeft(Metrics.remoteMessageSize(Effect.succeed(raw.byteLength))),
          Effect.annotateSpans({
            'remote.operation': 'update_connected_devices',
          }),
        )
      }

      case 'Changes': {
        return Effect.gen(function* () {
          const entries = yield* encryption.decrypt(identity, res.entries).pipe(
            Effect.tapErrorCause((cause) =>
              Effect.logError('Failed to decrypt entries').pipe(Effect.annotateLogs({ cause: Cause.pretty(cause) })),
            ),
            Effect.catchAllDefect(() => Effect.succeed([] as ReadonlyArray<EventJournal.RemoteEntry>)),
            Effect.catchAllCause(() => Effect.succeed([] as ReadonlyArray<EventJournal.RemoteEntry>)),
          )

          // yield* Effect.logDebug("Received remote changes").pipe(
          //   Effect.annotateLogs({
          //     "entries.count": entries.length.toString(),
          //     runtime: runtime,
          //   }),
          // )

          yield* Effect.annotateCurrentSpan({
            'entries.count': entries.length.toString(),
          })

          yield* mailbox.offerAll(entries)
        }).pipe(
          Effect.zipLeft(Metrics.remoteMessageSize(Effect.succeed(raw.byteLength))),
          Effect.annotateSpans({
            'remote.operation': 'log_changes',
          }),
        )
      }

      case 'ChunkedMessage': {
        const data = ChunkedMessage.join(chunks, res)
        if (!data) return Effect.void

        return handleMessage(decodeResponse(data), raw)
      }

      case 'Error': {
        return Effect.gen(function* () {
          if (res.id) {
            const entry = pending.get(res.id)
            if (!entry) return
            pending.delete(res.id)
            yield* Deferred.fail(entry.deferred, res.error)
            return
          }

          yield* localSyncEvent.failure({
            reason: res.error._tag,
            error: res.error.message,
          })

          yield* Effect.fail(res.error)
        })
      }
    }
  }

  /**
   * 处理收到的消息
   */
  yield* incoming.listen(([message, raw]) =>
    pipe(
      handleMessage(message, raw),
      Effect.timed,
      Effect.onExit(
        Exit.match({
          onFailure: () => Effect.asVoid(Metrics.remoteMessageErrorCount(Effect.succeed(1))),
          onSuccess: ([duration]) =>
            Effect.all(
              [
                Metrics.remoteMessageSuccessCount(Effect.succeed(1)),
                Metrics.remoteMessageLatency(Effect.succeed(Duration.toMillis(duration))),
              ],
              { concurrency: 'unbounded', discard: true },
            ),
        }),
      ),
      Effect.ignore,
      Effect.annotateSpans({
        runtime,
        method: 'handleMessage',
        type: message._tag,
      }),
      Effect.annotateLogs({
        runtime,
        method: 'handleMessage',
        type: message._tag,
      }),
      Effect.withSpan('EventLogRemote.handleMessage'),
      Effect.withLogSpan('@event-log/remote'),
    ),
  )

  if (runtime !== 'workerd') {
    /**
     * 响应同步开关，RemoteId 变化，注册/注销 Remote
     */
    yield* pipe(
      remoteSyncFlag.enabled,
      Stream.changes,
      Stream.flatMap(
        (enable) => {
          /**
           * 当同步开关被关闭时，删除掉已注册的 Remote
           */
          if (!enable) {
            return Stream.fromEffect(
              Effect.gen(function* () {
                yield* Effect.logDebug('Sync disabled, removing remote registration if exists')
                if (registeredRemoteId) {
                  yield* Effect.logDebug('Removing remote registration').pipe(
                    Effect.annotateLogs({ remoteId: Uuid.stringify(registeredRemoteId) }),
                  )
                  yield* log.removeRemote(registeredRemoteId)
                  yield* remoteLatch.close
                  registeredRemoteId = undefined
                }

                yield* devicesStatus.upsert({ devices: [] })

                return
              }),
            )
          }

          /**
           * 当 RemoteID 改变时重新注册 Remote
           */
          return remoteIdRef.changes.pipe(
            Stream.changesWith(RemoteIdEquivalence),
            Stream.tap(
              Effect.fn(function* (idRef) {
                if (registeredRemoteId) {
                  yield* Effect.logDebug('Removing previous remote registration').pipe(
                    Effect.annotateLogs({ remoteId: Uuid.stringify(registeredRemoteId) }),
                  )
                  yield* log.removeRemote(registeredRemoteId)
                  yield* remoteLatch.close
                  registeredRemoteId = undefined
                }

                if (Option.isSome(idRef)) {
                  yield* Effect.logDebug('Registering new remote').pipe(
                    Effect.annotateLogs({ remoteId: Uuid.stringify(idRef.value) }),
                  )
                  yield* registerRemote(idRef.value)
                  registeredRemoteId = idRef.value
                }
              }),
            ),
          )
        },
        { switch: true },
      ),
      Stream.runDrain,
      Effect.interruptible,
      Effect.forkScoped,
    )
  }

  return {
    register: Effect.fnUntraced(function* (remoteId: typeof EventJournal.RemoteId.Type) {
      yield* Effect.logDebug('Registering new remote').pipe(Effect.annotateLogs({ remoteId: Uuid.stringify(remoteId) }))

      yield* SubscriptionRef.set(remoteIdRef, Option.some(remoteId))
      yield* registerRemote(remoteId).pipe()
      registeredRemoteId = remoteId

      yield* remoteLatch.open
    }),
  }
})
