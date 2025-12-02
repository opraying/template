import type * as Event from '@xstack/event-log/Event'
import type * as EventGroup from '@xstack/event-log/EventGroup'
import type * as EventJournal from '@xstack/event-log/EventJournal'
import * as EventLog from '@xstack/event-log/EventLog'
import * as Arr from 'effect/Array'
import * as Effect from 'effect/Effect'
import * as Effectable from 'effect/Effectable'
import { pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import type * as Schema from 'effect/Schema'

type ArrayOrOne<T> = Array<T> | T

/**
 * @category type ids
 * @since 1.0.0
 */
export const TypeId: unique symbol = Symbol.for('@xstack/event-log/EventLogClientEvents')

/**
 * @category type ids
 * @since 1.0.0
 */
export type TypeId = typeof TypeId

/**
 * Creates an event log factory with the specified group and options
 * @param group - Function to create the event group
 * @param options - Configuration options for reactivity, compaction and handlers
 */
export const make = <
  Events extends Event.Event.Any,
  Reactivity extends { readonly [Tag in Event.Event.Tag<Events>]?: ReadonlyArray<string> } | ReadonlyArray<string>,
  Compaction extends ArrayOrOne<
    <R = never>(options: {
      readonly primaryKey: string
      readonly entries: Array<EventJournal.Entry>
      readonly events: Array<Event.Event.TaggedPayload<Events>>
      readonly write: <Tag extends Event.Event.Tag<Events>>(
        tag: Tag,
        payload: Event.Event.PayloadWithTag<Events, Tag>,
      ) => Effect.Effect<void>
    }) => Effect.Effect<void, never, R>
  >,
  Return,
>(
  group: EventGroup.EventGroup<Events>,
  options: {
    readonly reactivity?: Reactivity
    readonly compaction?: Compaction
    readonly handlers: (handlers: EventLog.Handlers<never, Events>) => EventLog.Handlers.ValidateReturn<Return>
  },
) => {
  type Client = Effect.Effect.Success<ReturnType<typeof EventLog.makeClient<EventGroup.EventGroup<Events>>>>

  const groupSchema = EventLog.schema(group)

  class EventLogClient extends Effectable.Class<Client, never, EventLog.EventLog> {
    [TypeId]!: {
      events: Events
      reactivity: Reactivity
      compaction: Compaction
      context: EventLog.Handlers.Context<EventLog.Handlers.ValidateReturn<Return>>
    }

    commit(): Effect.Effect<Client, never, EventLog.EventLog> {
      return EventLog.makeClient(groupSchema)
    }

    get schema(): EventLog.EventLogSchema<EventGroup.EventGroup<Events>> {
      return groupSchema
    }

    get group(): EventGroup.EventGroup<Events> {
      return group
    }

    get reactivity(): { readonly [Tag in Event.Event.Tag<Events>]?: ReadonlyArray<string> } | ReadonlyArray<string> {
      return options.reactivity ?? []
    }

    get compaction(): ArrayOrOne<
      <R = never>(options: {
        readonly primaryKey: string
        readonly entries: Array<EventJournal.Entry>
        readonly events: Array<Event.Event.TaggedPayload<Events>>
        readonly write: <Tag extends Event.Event.Tag<Events>>(
          tag: Tag,
          payload: Event.Event.PayloadWithTag<Events, Tag>,
        ) => Effect.Effect<void>
      }) => Effect.Effect<void, never, R>
    > {
      return options.compaction ?? []
    }

    handlers: (handlers: EventLog.Handlers<never, Events>) => EventLog.Handlers.ValidateReturn<Return> =
      options.handlers

    trigger: <Tag extends Event.Event.Tag<Events>>(
      event: Tag,
      payload: Event.Event.PayloadWithTag<Events, Tag>,
    ) => Effect.Effect<
      Schema.Schema.Type<
        Event.Event.SuccessSchema<
          Extract<
            Events,
            {
              readonly tag: Tag
            }
          >
        >
      >,
      | EventJournal.EventJournalError
      | Schema.Schema.Type<
          Event.Event.ErrorSchema<
            Extract<
              Events,
              {
                readonly tag: Tag
              }
            >
          >
        >,
      EventLog.EventLog
    > = <Tag extends Event.Event.Tag<Events>>(event: Tag, payload: Event.Event.PayloadWithTag<Events, Tag>) =>
      Effect.flatMap(EventLog.makeClient(groupSchema), (client) => client(event, payload))
  }

  const client = new EventLogClient()

  function EventLogClientFactory() {}
  Object.assign(EventLogClientFactory, client as any)
  Object.setPrototypeOf(EventLogClientFactory, Object.getPrototypeOf(client))

  return EventLogClientFactory as unknown as EventLogClient & (new () => Effectable.CommitPrimitive)
}

/**
 * Factory function return type that combines event group functionality with client capabilities
 */
interface EventLogClientType<Events extends Event.Event.Any> {
  readonly [TypeId]: {
    events: any
    reactivity: any
    compaction: any
    context: any
  }

  readonly schema: EventLog.EventLogSchema<EventGroup.EventGroup<Events>>

  readonly group: EventGroup.EventGroup<Events>

  readonly reactivity: { readonly [Tag in Event.Event.Tag<Events>]?: ReadonlyArray<string> } | ReadonlyArray<string>

  readonly handlers: (
    handlers: EventLog.Handlers<never, Events>,
  ) => Effect.Effect<EventLog.Handlers<any, never>, any, any>

  readonly compaction: ArrayOrOne<
    (options: {
      readonly primaryKey: string
      readonly entries: Array<EventJournal.Entry>
      readonly events: Array<any>
      readonly write: (tag: any, payload: Event.Event.PayloadWithTag<Events, any>) => Effect.Effect<void>
    }) => Effect.Effect<void, never, any>
  >
}
export declare namespace EventLogClient {
  export type Any = EventLogClientType<any>

  export type Events<A> = A extends EventLogClient.Any ? A[TypeId]['events'] : never

  export type Reactivity<A> = A extends EventLogClient.Any ? A[TypeId]['reactivity'] : never

  export type Compaction<A> = A extends EventLogClient.Any ? A[TypeId]['compaction'] : never

  export type Context<A> = A extends EventLogClient.Any ? A[TypeId]['context'] : never
}

type GetHandlerDeps<T extends Arr.NonEmptyReadonlyArray<EventLogClient.Any>> = EventLogClient.Context<T[number]>

export const register = <
  const A extends Arr.NonEmptyReadonlyArray<EventLogClient.Any>,
  Return extends GetHandlerDeps<A>,
>(
  ...events: A
): Layer.Layer<EventLog.Registry, EventLog.Handlers.Error<Return>, Return> =>
  pipe(
    Layer.effect(
      EventLog.Registry,
      Effect.gen(function* () {
        const registry = yield* EventLog.Registry

        yield* Effect.forEach(
          events as Arr.NonEmptyReadonlyArray<EventLogClient.Any>,
          (item) => {
            const result = item.handlers(
              EventLog.makeHandlers({
                group: item.group,
                handlers: {},
              }),
            )
            const handlers = Effect.isEffect(result) ? (result as any as Effect.Effect<any>) : Effect.succeed(result)

            return Effect.all(
              [
                item.reactivity ? registry.groupReactivity(item.group, item.reactivity) : Effect.void,
                item.compaction
                  ? Effect.forEach(
                      Arr.ensure(item.compaction),
                      (options) => registry.groupCompaction(item.group, options),
                      {
                        concurrency: 'unbounded',
                        discard: true,
                      },
                    )
                  : Effect.void,
                registry.registerHandler(handlers),
              ],
              { discard: true, concurrency: 'unbounded' },
            )
          },
          { discard: true, concurrency: 'unbounded' },
        )

        return registry
      }),
    ),
    Layer.provide(EventLog.Registry.Default),
  )
