import * as Reactivity from '@effect/experimental/Reactivity'
import { WriteUnknownError } from '@xstack/event-log/Error'
import type * as Event from '@xstack/event-log/Event'
import type * as EventGroup from '@xstack/event-log/EventGroup'
import * as EventJournal from '@xstack/event-log/EventJournal'
import * as EventLogConfig from '@xstack/event-log/EventLogConfig'
import { SyncEvents } from '@xstack/event-log/Schema'
import type { EventLogRemote } from '@xstack/event-log/Types'
import { EventEmitter } from '@xstack/event-log/Utils'
import * as Chunk from 'effect/Chunk'
import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Exit from 'effect/Exit'
import * as FiberMap from 'effect/FiberMap'
import * as FiberRef from 'effect/FiberRef'
import { identity, pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import * as Option from 'effect/Option'
import { type Pipeable, pipeArguments } from 'effect/Pipeable'
import * as Predicate from 'effect/Predicate'
import * as Queue from 'effect/Queue'
import type * as Record from 'effect/Record'
import * as Schema from 'effect/Schema'
import type * as Scope from 'effect/Scope'
import type * as Types from 'effect/Types'

/**
 * @since 1.0.0
 * @category schema
 */
export const SchemaTypeId: unique symbol = Symbol.for('@xstack/event-log/EventLog/EventLogSchema')

/**
 * @since 1.0.0
 * @category schema
 */
export type SchemaTypeId = typeof SchemaTypeId

/**
 * @since 1.0.0
 * @category schema
 */
export const isEventLogSchema = (u: unknown): u is EventLogSchema<any> => Predicate.hasProperty(u, SchemaTypeId)

/**
 * @since 1.0.0
 * @category schema
 */
export interface EventLogSchema<Groups extends EventGroup.EventGroup.Any> {
  new (_: never): {}
  readonly [SchemaTypeId]: SchemaTypeId
  readonly groups: ReadonlyArray<Groups>
}

/**
 * @since 1.0.0
 * @category schema
 */
export const schema = <Groups extends ReadonlyArray<EventGroup.EventGroup.Any>>(
  ...groups: Groups
): EventLogSchema<Groups[number]> => {
  function EventLog() {}
  EventLog[SchemaTypeId] = SchemaTypeId
  EventLog.groups = groups
  return EventLog as any
}

/**
 * @since 1.0.0
 * @category handlers
 */
export const HandlersTypeId: unique symbol = Symbol.for('@xstack/event-log/EventLog/Handlers')

/**
 * @since 1.0.0
 * @category handlers
 */
export type HandlersTypeId = typeof HandlersTypeId

/**
 * Represents a handled `EventGroup`.
 *
 * @since 1.0.0
 * @category handlers
 */
export interface Handlers<R, Events extends Event.Event.Any = never> extends Pipeable {
  readonly [HandlersTypeId]: {
    _Endpoints: Types.Covariant<Events>
  }
  readonly group: EventGroup.EventGroup.AnyWithProps
  readonly handlers: Record.ReadonlyRecord<string, Handlers.Item<R>>

  /**
   * Add the implementation for an `Event` to a `Handlers` group.
   */
  handle<Tag extends Events['tag'], R1>(
    name: Tag,
    handler: (options: {
      readonly payload: Event.Event.PayloadWithTag<Events, Tag>
      readonly entry: EventJournal.Entry
      readonly conflicts: Array<{
        readonly entry: EventJournal.Entry
        readonly payload: Event.Event.PayloadWithTag<Events, Tag>
      }>
    }) => Effect.Effect<Event.Event.SuccessWithTag<Events, Tag>, Event.Event.ErrorWithTag<Events, Tag>, R1>,
  ): Handlers<R | R1, Event.Event.ExcludeTag<Events, Tag>>
}

/**
 * @since 1.0.0
 * @category handlers
 */
export declare namespace Handlers {
  /**
   * @since 1.0.0
   * @category handlers
   */
  export interface Any {
    readonly [HandlersTypeId]: any
  }

  /**
   * @since 1.0.0
   * @category handlers
   */
  export type Item<R> = {
    readonly event: Event.Event.AnyWithProps
    readonly handler: (options: {
      readonly payload: any
      readonly entry: EventJournal.Entry
      readonly conflicts: Array<{
        readonly entry: EventJournal.Entry
        readonly payload: any
      }>
    }) => Effect.Effect<any, R>
  }

  /**
   * @since 1.0.0
   * @category handlers
   */
  export type ValidateReturn<A> = A extends
    | Handlers<infer _R, infer _Events>
    | Effect.Effect<Handlers<infer _R, infer _Events>, infer _EX, infer _RX>
    ? [_Events] extends [never]
      ? A
      : `Event not handled: ${Event.Event.Tag<_Events>}`
    : `Must return the implemented handlers`

  /**
   * @since 1.0.0
   * @category handlers
   */
  export type Error<A> = A extends Effect.Effect<Handlers<infer _R, infer _Events>, infer _EX, infer _RX> ? _EX : never

  /**
   * @since 1.0.0
   * @category handlers
   */
  export type Context<A> =
    A extends Handlers<infer _R, infer _Events>
      ? _R | Event.Event.Context<_Events>
      : A extends Effect.Effect<Handlers<infer _R, infer _Events>, infer _EX, infer _RX>
        ? _R | _RX | Event.Event.Context<_Events>
        : never
}

const handlersProto = {
  [HandlersTypeId]: {
    _Endpoints: identity,
  },
  handle<Tag extends string, R1>(
    this: Handlers<any, any>,
    tag: Tag,
    handler: (payload: any) => Effect.Effect<any, R1>,
  ): Handlers<any, any> {
    return makeHandlers({
      group: this.group,
      handlers: {
        ...this.handlers,
        [tag]: {
          event: this.group.events[tag],
          handler,
        },
      },
    })
  },
  pipe() {
    return pipeArguments(this, arguments)
  },
}

export const makeHandlers = <Events extends Event.Event.Any>(options: {
  readonly group: EventGroup.EventGroup.AnyWithProps
  readonly handlers: Record.ReadonlyRecord<string, Handlers.Item<any>>
}): Handlers<never, Events> => Object.assign(Object.create(handlersProto), options)

/**
 * @since 1.0.0
 * @category compaction
 */
export const groupCompaction = <Events extends Event.Event.Any, R>(
  group: EventGroup.EventGroup<Events>,
  effect: (options: {
    readonly primaryKey: string
    readonly entries: Array<EventJournal.Entry>
    readonly events: Array<Event.Event.TaggedPayload<Events>>
    readonly write: <Tag extends Event.Event.Tag<Events>>(
      tag: Tag,
      payload: Event.Event.PayloadWithTag<Events, Tag>,
    ) => Effect.Effect<void>
  }) => Effect.Effect<void, never, R>,
): Effect.Effect<void, never, R | Registry | Event.Event.Context<Events> | Scope.Scope> =>
  Effect.flatMap(Registry, (_) => _.groupCompaction(group, effect))

export const groupCompactionLayer = <Events extends Event.Event.Any, R>(
  group: EventGroup.EventGroup<Events>,
  effect: (options: {
    readonly primaryKey: string
    readonly entries: Array<EventJournal.Entry>
    readonly events: Array<Event.Event.TaggedPayload<Events>>
    readonly write: <Tag extends Event.Event.Tag<Events>>(
      tag: Tag,
      payload: Event.Event.PayloadWithTag<Events, Tag>,
    ) => Effect.Effect<void>
  }) => Effect.Effect<void, never, R>,
): Layer.Layer<never, never, Registry | R | Event.Event.Context<Events>> =>
  groupCompaction(group, effect).pipe(Layer.scopedDiscard)

/**
 * @since 1.0.0
 * @category reactivity
 */
export const groupReactivity = <Events extends Event.Event.Any>(
  group: EventGroup.EventGroup<Events>,
  keys: { readonly [Tag in Event.Event.Tag<Events>]?: ReadonlyArray<string> } | ReadonlyArray<string>,
): Layer.Layer<never, never, Registry> =>
  Layer.scopedDiscard(Effect.flatMap(Registry, (_) => _.groupReactivity(group, keys)))

/**
 * @since 1.0.0
 * @category layers
 */
export class Registry extends Context.Tag('@xstack/event-log/Registry')<
  Registry,
  {
    readonly handlers: Effect.Effect<Record.ReadonlyRecord<string, Handlers.Item<any>>>
    readonly registerHandler: (handlers: Effect.Effect<Handlers.Any>) => Effect.Effect<void>

    readonly compactors: Effect.Effect<
      Map<
        string,
        {
          readonly events: ReadonlySet<string>
          readonly effect: (options: {
            readonly entries: ReadonlyArray<EventJournal.Entry>
            readonly write: (entry: EventJournal.Entry) => Effect.Effect<void>
          }) => Effect.Effect<void>
        }
      >
    >
    readonly registerCompaction: (options: {
      readonly events: ReadonlyArray<string>
      readonly effect: (options: {
        readonly entries: ReadonlyArray<EventJournal.Entry>
        readonly write: (entry: EventJournal.Entry) => Effect.Effect<void>
      }) => Effect.Effect<void>
    }) => Effect.Effect<void, never, Scope.Scope>
    readonly groupCompaction: <Events extends Event.Event.Any, R>(
      group: EventGroup.EventGroup<Events>,
      effect: (options: {
        readonly primaryKey: string
        readonly entries: Array<EventJournal.Entry>
        readonly events: Array<Event.Event.TaggedPayload<Events>>
        readonly write: <Tag extends Event.Event.Tag<Events>>(
          tag: Tag,
          payload: Event.Event.PayloadWithTag<Events, Tag>,
        ) => Effect.Effect<void>
      }) => Effect.Effect<void, never, R>,
    ) => Effect.Effect<void, never, Scope.Scope | R | Event.Event.Context<Events>>

    readonly reactivityKeys: Effect.Effect<Record<string, readonly string[]>>
    readonly registerReactivity: (
      keys: Record<string, ReadonlyArray<string>>,
    ) => Effect.Effect<void, never, Scope.Scope>
    readonly groupReactivity: <Events extends Event.Event.Any>(
      group: EventGroup.EventGroup<Events>,
      keys: { readonly [Tag in Event.Event.Tag<Events>]?: ReadonlyArray<string> } | ReadonlyArray<string>,
    ) => Effect.Effect<void>
  }
>() {
  /**
   * @since 1.0.0
   */
  static Default = Layer.effect(
    Registry,
    Effect.gen(function* () {
      const items: Record<string, Handlers.Item<any>> = {}
      const reactivityKeys: Record<string, ReadonlyArray<string>> = {}
      const compactors = new Map<
        string,
        {
          readonly events: ReadonlySet<string>
          readonly effect: (options: {
            readonly entries: ReadonlyArray<EventJournal.Entry>
            readonly write: (entry: EventJournal.Entry) => Effect.Effect<void>
          }) => Effect.Effect<void>
        }
      >()

      const handleRegisterLaterSet = new Set<Effect.Effect<void>>()

      const registerHandler_ = (handlers: Effect.Effect<Handlers<any, never>>) => {
        handleRegisterLaterSet.add(
          handlers.pipe(
            Effect.tap((handlers) => {
              for (const tag in handlers.handlers) {
                items[tag] = handlers.handlers[tag]
              }
            }),
          ),
        )
      }

      const registerHandler = (handlers: Effect.Effect<Handlers<any, never>>) =>
        Effect.sync(() => registerHandler_(handlers))

      const getHandlers = Effect.gen(function* () {
        if (handleRegisterLaterSet.size === 0) {
          return items
        }

        yield* Effect.all(Array.from(handleRegisterLaterSet), { discard: true })
        handleRegisterLaterSet.clear()

        return items
      })

      const registerCompaction = (options: {
        readonly events: ReadonlyArray<string>
        readonly effect: (options: {
          readonly entries: ReadonlyArray<EventJournal.Entry>
          readonly write: (entry: EventJournal.Entry) => Effect.Effect<void>
        }) => Effect.Effect<void>
      }) =>
        Effect.acquireRelease(
          Effect.sync(() => {
            const events = new Set(options.events)
            const compactor = {
              events,
              effect: options.effect,
            }
            for (const event of options.events) {
              compactors.set(event, compactor)
            }
          }),
          () =>
            Effect.sync(() => {
              for (const event of options.events) {
                compactors.delete(event)
              }
            }),
        )

      const groupCompaction = <Events extends Event.Event.Any, R>(
        group: EventGroup.EventGroup<Events>,
        effect: (options: {
          readonly primaryKey: string
          readonly entries: Array<EventJournal.Entry>
          readonly events: Array<Event.Event.TaggedPayload<Events>>
          readonly write: <Tag extends Event.Event.Tag<Events>>(
            tag: Tag,
            payload: Event.Event.PayloadWithTag<Events, Tag>,
          ) => Effect.Effect<void>
        }) => Effect.Effect<void, never, R>,
      ) =>
        Effect.gen(function* () {
          const context = yield* Effect.context<R | Event.Event.Context<Events>>()

          yield* registerCompaction({
            events: Object.keys(group.events),
            effect: Effect.fnUntraced(function* ({ entries, write }) {
              const writePayload = (timestamp: number, tag: string, payload: any) =>
                Effect.gen(function* () {
                  const event = group.events[tag] as any as Event.Event.AnyWithProps
                  const entry = new EventJournal.Entry(
                    {
                      id: EventJournal.makeEntryId({ msecs: timestamp }),
                      event: tag,
                      payload: yield* Schema.encode(event.payloadMsgPack)(payload).pipe(
                        Effect.locally(FiberRef.currentContext, context),
                        Effect.orDie,
                      ) as Effect.Effect<Uint8Array>,
                      primaryKey: event.primaryKey(payload),
                    },
                    { disableValidation: true },
                  )
                  yield* write(entry)
                })

              const byPrimaryKey = new Map<
                string,
                {
                  readonly entries: Array<EventJournal.Entry>
                  readonly taggedPayloads: Array<{
                    readonly _tag: string
                    readonly payload: any
                  }>
                }
              >()
              for (const entry of entries) {
                const payload = yield* Schema.decodeUnknown((group.events[entry.event] as any).payloadMsgPack)(
                  entry.payload,
                ).pipe(Effect.locally(FiberRef.currentContext, context)) as Effect.Effect<any>

                if (byPrimaryKey.has(entry.primaryKey)) {
                  const record = byPrimaryKey.get(entry.primaryKey)!
                  record.entries.push(entry)
                  record.taggedPayloads.push({
                    _tag: entry.event,
                    payload,
                  })
                } else {
                  byPrimaryKey.set(entry.primaryKey, {
                    entries: [entry],
                    taggedPayloads: [{ _tag: entry.event, payload }],
                  })
                }
              }

              for (const [primaryKey, { entries, taggedPayloads }] of byPrimaryKey) {
                yield* effect({
                  primaryKey,
                  entries,
                  events: taggedPayloads as any,
                  write(tag, payload) {
                    return writePayload(entries[0].createdAtMillis, tag, payload)
                  },
                }).pipe(Effect.locally(FiberRef.currentContext, context)) as Effect.Effect<void>
              }
            }),
          })
        })

      const registerReactivity_ = (keys: Record<string, ReadonlyArray<string>>) => Object.assign(reactivityKeys, keys)

      const registerReactivity = (keys: Record<string, ReadonlyArray<string>>) =>
        Effect.sync(() => registerReactivity_(keys))

      const groupReactivity = <Events extends Event.Event.Any>(
        group: EventGroup.EventGroup<Events>,
        keys: { readonly [Tag in Event.Event.Tag<Events>]?: ReadonlyArray<string> } | ReadonlyArray<string>,
      ) =>
        Effect.sync(() => {
          if (!Array.isArray(keys)) {
            registerReactivity_(keys as any)
            return
          }
          const obj: Record<string, ReadonlyArray<string>> = {}
          for (const tag in group.events) {
            obj[tag] = keys
          }
          registerReactivity_(obj)
        })

      return {
        handlers: getHandlers,
        registerHandler,

        compactors: Effect.sync(() => compactors),
        registerCompaction,
        groupCompaction,

        reactivityKeys: Effect.sync(() => reactivityKeys),
        registerReactivity,
        groupReactivity,
      } as unknown as Context.Tag.Service<Registry>
    }),
  )
}

export class EventWriter extends Context.Tag('@xstack/event-log/EventWriter')<
  EventWriter,
  {
    readonly write: <
      Groups extends EventGroup.EventGroup.Any,
      Tag extends Event.Event.Tag<EventGroup.EventGroup.Events<Groups>>,
    >(options: {
      readonly schema: EventLogSchema<Groups>
      readonly event: Tag
      readonly payload: Event.Event.PayloadWithTag<EventGroup.EventGroup.Events<Groups>, Tag>
    }) => Effect.Effect<void>
  }
>() {}

/**
 * @since 1.0.0
 * @category tags
 */
export class EventLog extends Context.Tag('@xstack/event-log/EventLog')<
  EventLog,
  {
    readonly write: <
      Groups extends EventGroup.EventGroup.Any,
      Tag extends Event.Event.Tag<EventGroup.EventGroup.Events<Groups>>,
    >(options: {
      readonly schema: EventLogSchema<Groups>
      readonly event: Tag
      readonly payload: Event.Event.PayloadWithTag<EventGroup.EventGroup.Events<Groups>, Tag>
    }) => Effect.Effect<
      Event.Event.SuccessWithTag<EventGroup.EventGroup.Events<Groups>, Tag>,
      Event.Event.ErrorWithTag<EventGroup.EventGroup.Events<Groups>, Tag> | EventJournal.EventJournalError
    >
    readonly registerRemote: (remote: EventLogRemote) => Effect.Effect<void, never, Scope.Scope>
    readonly removeRemote: (remoteId: EventJournal.RemoteId) => Effect.Effect<void, never, Scope.Scope>

    readonly entries: Effect.Effect<ReadonlyArray<EventJournal.Entry>, EventJournal.EventJournalError>
    readonly destroy: Effect.Effect<void, EventJournal.EventJournalError>
    readonly events: EventEmitter
  }
>() {}

const make = Effect.gen(function* () {
  const { writeInterval } = yield* EventLogConfig.EventLogConfig.pipe(Effect.orDie)

  // Create an event queue for subsequent events
  let eventQueue: Array<{
    schema: any
    event: string
    payload: any
  }> = []

  const eventWriter = EventWriter.of({
    write: (writeOptions) =>
      Effect.sync(() => {
        eventQueue.push(writeOptions)
      }),
  })

  const registry = yield* Registry
  const handlers = yield* registry.handlers.pipe(Effect.provideService(EventWriter, eventWriter))
  const compactors = yield* registry.compactors
  const reactivityKeys = yield* registry.reactivityKeys

  const reactivity = yield* Reactivity.Reactivity
  const journal = yield* EventJournal.EventJournal
  const remotes = yield* FiberMap.make<EventJournal.RemoteId>()

  const journalSemaphore = yield* Effect.makeSemaphore(1)
  const syncingSemaphore = yield* Effect.makeSemaphore(1)

  const events = new EventEmitter()

  const context = yield* Effect.context<never>()

  const writeFn: <
    Groups extends EventGroup.EventGroup.Any,
    Tag extends Event.Event.Tag<EventGroup.EventGroup.Events<Groups>>,
  >(options: {
    readonly schema: EventLogSchema<Groups>
    readonly event: Tag
    readonly payload: Event.Event.PayloadWithTag<EventGroup.EventGroup.Events<Groups>, Tag>
  }) => Effect.Effect<
    Schema.Schema.Type<Event.Event.SuccessSchema<Extract<EventGroup.EventGroup.Events<Groups>, { readonly tag: Tag }>>>,
    | Schema.Schema.Type<Event.Event.ErrorSchema<Extract<EventGroup.EventGroup.Events<Groups>, { readonly tag: Tag }>>>
    | EventJournal.EventJournalError,
    never
  > = Effect.fnUntraced(function* <
    Groups extends EventGroup.EventGroup.Any,
    Tag extends Event.Event.Tag<EventGroup.EventGroup.Events<Groups>>,
  >(options: {
    readonly schema: EventLogSchema<Groups>
    readonly event: Tag
    readonly payload: Event.Event.PayloadWithTag<EventGroup.EventGroup.Events<Groups>, Tag>
  }) {
    const handler = handlers[options.event]

    if (!handler) {
      yield* Effect.logWarning(`Event handler not found for: "${options.event}"`)
    }

    const payload = yield* Effect.orDie(
      Schema.encode(handlers[options.event].event.payloadMsgPack as unknown as Schema.Schema<Uint8Array>)(
        options.payload,
      ),
    )

    return yield* journal.write<
      Event.Event.SuccessWithTag<EventGroup.EventGroup.Events<Groups>, Tag>,
      Event.Event.ErrorWithTag<EventGroup.EventGroup.Events<Groups>, Tag> | EventJournal.EventJournalError,
      never
    >({
      event: options.event,
      primaryKey: handler.event.primaryKey(options.payload),
      payload,
      effect: (entry) =>
        // Locally created event writes are considered conflict-free and are processed directly.
        pipe(
          handler.handler({
            payload: options.payload,
            entry,
            conflicts: [],
          }),
          Effect.tap(() => {
            const keys: Record<string, string[]> = {}

            if (reactivityKeys[entry.event]) {
              for (const key of reactivityKeys[entry.event]) {
                keys[key] = [entry.primaryKey]
              }
            }

            reactivity.unsafeInvalidate(keys)
          }),
          Effect.mapInputContext(() => context),
        ),
    })
  })

  const write: <
    Groups extends EventGroup.EventGroup.Any,
    Tag extends Event.Event.Tag<EventGroup.EventGroup.Events<Groups>>,
  >(options: {
    readonly schema: EventLogSchema<Groups>
    readonly event: Tag
    readonly payload: Event.Event.PayloadWithTag<EventGroup.EventGroup.Events<Groups>, Tag>
  }) => Effect.Effect<
    Schema.Schema.Type<Event.Event.SuccessSchema<Extract<EventGroup.EventGroup.Events<Groups>, { readonly tag: Tag }>>>,
    | Schema.Schema.Type<Event.Event.ErrorSchema<Extract<EventGroup.EventGroup.Events<Groups>, { readonly tag: Tag }>>>
    | EventJournal.EventJournalError,
    never
  > = <
    Groups extends EventGroup.EventGroup.Any,
    Tag extends Event.Event.Tag<EventGroup.EventGroup.Events<Groups>>,
  >(options: {
    readonly schema: EventLogSchema<Groups>
    readonly event: Tag
    readonly payload: Event.Event.PayloadWithTag<EventGroup.EventGroup.Events<Groups>, Tag>
  }) =>
    Effect.withSpan(journalSemaphore.withPermits(1)(writeFn(options)), 'EventLog.write', {
      attributes: { event: options.event },
    })

  const syncWithLoggingAndSemaphore = <E, R>(effect: Effect.Effect<Exit.Exit<void, any>, E, R>) => {
    const effectWithLogging = pipe(
      Effect.sync(() => events.emit('sync-event', SyncEvents.SyncStart)),
      Effect.zipRight(effect),
      Effect.tap((exit) =>
        Effect.fork(Effect.delay(150)(Effect.sync(() => events.emit('sync-event', SyncEvents.SyncEnd(exit))))),
      ),
      Effect.catchAll((e) =>
        Effect.sync(() =>
          events.emit(
            'sync-event',
            SyncEvents.SyncEnd(
              Exit.fail(
                new WriteUnknownError({
                  message: typeof e === 'string' ? e : String(e),
                  cause: typeof e === 'object' ? (e as any).cause : undefined,
                }),
              ),
            ),
          ),
        ),
      ),
    )

    return pipe(
      effectWithLogging,
      syncingSemaphore.withPermitsIfAvailable(1),
      Effect.tap(
        Option.match({
          onNone: () => effect,
          onSome: () => Effect.void,
        }),
      ),
      Effect.ignore,
    )
  }

  const runRemote = (remote: EventLogRemote) =>
    Effect.gen(function* () {
      const startSequence = yield* journal.nextRemoteSequence(remote.id)
      const changes = yield* remote.changes(startSequence)

      /**
       * 收到远端的Change数据将其更新到本地
       */
      yield* pipe(
        changes.takeAll,
        Effect.flatMap(([entries]) =>
          journal
            .writeFromRemote({
              remoteId: remote.id,
              entries: Chunk.toReadonlyArray(entries),
              effect: Effect.fnUntraced(function* ({ entry, conflicts }) {
                const handler = handlers[entry.event]
                if (!handler) {
                  yield* Effect.logWarning(`Event handler not found for: "${entry.event}"`)
                  return
                }

                const decodePayload = Schema.decode(
                  handlers[entry.event].event.payloadMsgPack as unknown as Schema.Schema<any>,
                )

                const decodedConflicts: Array<{
                  entry: EventJournal.Entry
                  payload: any
                }> = Array.from({ length: conflicts.length })
                for (let i = 0; i < conflicts.length; i++) {
                  decodedConflicts[i] = {
                    entry: conflicts[i],
                    payload: yield* decodePayload(conflicts[i].payload),
                  }
                }
                yield* handler.handler({
                  payload: yield* decodePayload(entry.payload),
                  entry,
                  conflicts: decodedConflicts,
                })
                if (reactivityKeys[entry.event]) {
                  for (const key of reactivityKeys[entry.event]) {
                    reactivity.unsafeInvalidate({
                      [key]: [entry.primaryKey],
                    })
                  }
                }
              }, Effect.tapErrorCause(Effect.logError)),
              compact:
                compactors.size > 0
                  ? (remoteEntries) =>
                      Effect.gen(function* () {
                        let unprocessed = remoteEntries as Array<EventJournal.RemoteEntry>
                        const brackets: Array<[Array<EventJournal.Entry>, Array<EventJournal.RemoteEntry>]> = []
                        let uncompacted: Array<EventJournal.Entry> = []
                        let uncompactedRemote: Array<EventJournal.RemoteEntry> = []
                        while (true) {
                          let i = 0
                          // Start processing remote unprocessed data
                          for (; i < unprocessed.length; i++) {
                            const remoteEntry = unprocessed[i]
                            // Add unregistered types to the non-compacted list.
                            if (!compactors.has(remoteEntry.entry.event)) {
                              uncompacted.push(remoteEntry.entry)
                              uncompactedRemote.push(remoteEntry)
                              continue
                            }
                            if (uncompacted.length > 0) {
                              brackets.push([uncompacted, uncompactedRemote])
                              uncompacted = []
                              uncompactedRemote = []
                            }

                            const compactor = compactors.get(remoteEntry.entry.event)!
                            const entry = remoteEntry.entry
                            const entries = [entry]
                            const remoteEntries = [remoteEntry]
                            const compacted: Array<EventJournal.Entry> = []
                            const currentEntries = unprocessed
                            unprocessed = []
                            for (let j = i + 1; j < currentEntries.length; j++) {
                              const nextRemoteEntry = currentEntries[j]
                              if (!compactor.events.has(nextRemoteEntry.entry.event)) {
                                unprocessed.push(nextRemoteEntry)
                                continue
                              }
                              entries.push(nextRemoteEntry.entry)
                              remoteEntries.push(nextRemoteEntry)
                            }
                            yield* compactor.effect({
                              entries,
                              write(entry) {
                                return Effect.sync(() => {
                                  compacted.push(entry)
                                })
                              },
                            })
                            brackets.push([compacted, remoteEntries])
                            break
                          }
                          if (i === unprocessed.length) {
                            brackets.push([unprocessed.map((_) => _.entry), unprocessed])
                            break
                          }
                        }
                        return brackets
                      })
                  : undefined,
            })
            .pipe(
              Effect.tap(() => {
                if (eventQueue.length > 0) {
                  return Effect.forEach(
                    eventQueue,
                    (e) => {
                      return writeFn(e as any).pipe(Effect.catchAllCause(Effect.logError))
                    },
                    { discard: true },
                  ).pipe(
                    Effect.tap(() => {
                      eventQueue = []
                    }),
                  )
                }

                return Effect.void
              }),
              Effect.exit,
              syncWithLoggingAndSemaphore,
              journalSemaphore.withPermits(1),
            ),
        ),
        Effect.forever,
        Effect.catchAllCause(Effect.logError),
        Effect.fork,
      )

      // Write local uncommitted changes to the remote.
      const write = journal
        .withRemoteUncommited(remote.id, (entries) => remote.write(entries))
        .pipe(syncWithLoggingAndSemaphore)

      yield* Effect.addFinalizer(() => write)
      yield* write
      yield* Queue.takeBetween(yield* journal.changes, 1, Number.MAX_SAFE_INTEGER).pipe(
        Effect.zipRight(Effect.sleep(writeInterval)),
        Effect.zipRight(write),
        Effect.forever,
        Effect.catchAllCause(Effect.logError),
        Effect.ignore,
      )
    }).pipe(Effect.scoped, Effect.interruptible)

  return EventLog.of({
    write: write as any,
    entries: journal.entries,
    registerRemote: (remote) =>
      Effect.acquireRelease(FiberMap.run(remotes, remote.id, runRemote(remote)), () =>
        FiberMap.remove(remotes, remote.id),
      ),
    removeRemote: (remoteId) => FiberMap.remove(remotes, remoteId),
    destroy: journal.destroy,
    events,
  })
})

/**
 * @since 1.0.0
 * @category layers
 */
export const layer: Layer.Layer<EventLog, never, EventJournal.EventJournal | Registry | Reactivity.Reactivity> =
  Layer.scoped(EventLog, make)

/**
 * @since 1.0.0
 * @category client
 */
export const makeClient = <Groups extends EventGroup.EventGroup.Any>(
  schema: EventLogSchema<Groups>,
): Effect.Effect<
  <Tag extends Event.Event.Tag<EventGroup.EventGroup.Events<Groups>>>(
    event: Tag,
    payload: Event.Event.PayloadWithTag<EventGroup.EventGroup.Events<Groups>, Tag>,
  ) => Effect.Effect<
    Event.Event.SuccessWithTag<EventGroup.EventGroup.Events<Groups>, Tag>,
    Event.Event.ErrorWithTag<EventGroup.EventGroup.Events<Groups>, Tag> | EventJournal.EventJournalError
  >,
  never,
  EventLog
> =>
  Effect.gen(function* () {
    const log = yield* EventLog

    return <Tag extends Event.Event.Tag<EventGroup.EventGroup.Events<Groups>>>(
      event: Tag,
      payload: Event.Event.PayloadWithTag<EventGroup.EventGroup.Events<Groups>, Tag>,
    ): Effect.Effect<
      Event.Event.SuccessWithTag<EventGroup.EventGroup.Events<Groups>, Tag>,
      Event.Event.ErrorWithTag<EventGroup.EventGroup.Events<Groups>, Tag> | EventJournal.EventJournalError
    > => log.write({ schema, event, payload })
  })
