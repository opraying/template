/**
 * EventGroup module provides functionality to group related events together.
 * This helps in organizing domain events and managing their implementations.
 */

import * as HttpApiSchema from '@effect/platform/HttpApiSchema'
import type { Event } from '@xstack/event-log/Event'
import * as EventApi from '@xstack/event-log/Event'
import { type Pipeable, pipeArguments } from 'effect/Pipeable'
import * as Predicate from 'effect/Predicate'
import * as Record from 'effect/Record'
import type * as Schema from 'effect/Schema'

/**
 * Unique identifier for EventGroup type
 * @since 1.0.0
 * @category type ids
 */
export const TypeId: unique symbol = Symbol.for('@xstack/event-log/EventGroup')

/**
 * @since 1.0.0
 * @category type ids
 */
export type TypeId = typeof TypeId

/**
 * Type guard to check if a value is an EventGroup
 * @since 1.0.0
 * @category guards
 */
export const isEventGroup = (u: unknown): u is EventGroup.Any => Predicate.hasProperty(u, TypeId)

/**
 * An `EventGroup` is a collection of `Event`s. You can use an `EventGroup` to
 * represent a portion of your domain.
 *
 * The events can be implemented later using the `EventLogBuilder.group` api.
 * This allows for better organization and modularization of domain events.
 *
 * @since 1.0.0
 * @category models
 */
export interface EventGroup<out Events extends Event.Any = never> extends Pipeable {
  new (_: never): {}

  readonly [TypeId]: TypeId
  /** Map of event tags to their corresponding Event definitions */
  readonly events: Record.ReadonlyRecord<string, Events>

  /**
   * Add an `Event` to the `EventGroup`.
   * This allows building up the group incrementally with type safety.
   */
  add<
    Tag extends string,
    Payload extends Schema.Schema.Any = typeof Schema.Void,
    Success extends Schema.Schema.Any = typeof Schema.Void,
    Error extends Schema.Schema.All = typeof Schema.Never,
  >(options: {
    readonly tag: Tag
    readonly primaryKey: (payload: Schema.Schema.Type<Payload>) => string
    readonly payload?: Payload
    readonly success?: Success
    readonly error?: Error
  }): EventGroup<Events | Event<Tag, Payload, Success, Error>>

  /**
   * Add an error schema to all the events in the `EventGroup`.
   * This is useful for handling common error cases across all events.
   */
  addError<Error extends Schema.Schema.Any>(error: Error): EventGroup<Event.AddError<Events, Error>>
}

/**
 * @since 1.0.0
 * @category models
 */
export declare namespace EventGroup {
  /**
   * @since 1.0.0
   * @category models
   */
  export interface Any {
    readonly [TypeId]: TypeId
  }

  /**
   * @since 1.0.0
   * @category models
   */
  export type AnyWithProps = EventGroup<Event.AnyWithProps>

  /**
   * @since 1.0.0
   * @category models
   */
  export type ToService<A> = A extends EventGroup<infer _Events> ? Event.ToService<_Events> : never

  /**
   * @since 1.0.0
   * @category models
   */
  export type Events<Group> = Group extends EventGroup<infer _Events> ? _Events : never

  /**
   * @since 1.0.0
   * @category models
   */
  export type Context<Group> = Event.Context<Events<Group>>
}

const Proto = {
  [TypeId]: TypeId,
  add(
    this: EventGroup.AnyWithProps,
    options: {
      readonly tag: string
      readonly primaryKey: (payload: Schema.Schema.Any) => string
      readonly payload?: Schema.Schema.Any
      readonly success?: Schema.Schema.Any
      readonly error?: Schema.Schema.All
    },
  ) {
    return makeProto({
      events: {
        ...this.events,
        [options.tag]: EventApi.make(options),
      },
    })
  },
  addError(this: EventGroup.AnyWithProps, error: Schema.Schema.Any) {
    return makeProto({
      events: Record.map(this.events, (event) =>
        EventApi.make({
          ...event,
          error: HttpApiSchema.UnionUnify(event.error, error),
        }),
      ),
    })
  },
  pipe() {
    return pipeArguments(this, arguments)
  },
}

const makeProto = <Events extends Event.Any>(options: {
  readonly events: Record.ReadonlyRecord<string, Events>
}): EventGroup<Events> => {
  function EventGroup() {}
  Object.setPrototypeOf(EventGroup, Proto)
  return Object.assign(EventGroup, options) as any
}

/**
 * Creates an empty EventGroup.
 * This is the starting point for building up a group of related events.
 *
 * @example
 * ```ts
 * const userEvents = empty
 *   .add({
 *     tag: "UserCreated",
 *     primaryKey: (payload) => payload.userId,
 *     payload: Schema.struct({ userId: Schema.string })
 *   })
 *   .add({
 *     tag: "UserUpdated",
 *     primaryKey: (payload) => payload.userId,
 *     payload: Schema.struct({ userId: Schema.string, name: Schema.string })
 *   })
 * ```
 *
 * @since 1.0.0
 * @category constructors
 */
export const empty: EventGroup<never> = makeProto({ events: Record.empty() })
