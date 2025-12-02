import { describe, expect, it } from '@effect/vitest'
import { Effect, Layer, TestClock } from 'effect'
import * as Schema from 'effect/Schema'
import { declareCommand, declareEvent, ResourcePlan } from '../src/worker/scheduler/handle'
import { EventPubSubLive, SchedulerManager } from '../src/worker/scheduler/manager'

const TestLive = SchedulerManager.Live.pipe(Layer.provide(EventPubSubLive))

describe('Manager', () => {
  it.effect('register', () =>
    Effect.gen(function* () {
      const manager = yield* SchedulerManager
      const plan = new ResourcePlan('test', {})

      yield* manager.register(plan)
      yield* manager.run

      yield* TestClock.adjust('1 second')
    }).pipe(Effect.provide(TestLive)),
  )

  it.effect('command', () =>
    Effect.gen(function* () {
      const manager = yield* SchedulerManager

      class RequestSchema extends Schema.TaggedRequest<RequestSchema>()('RequestSchema', {
        failure: Schema.Never,
        success: Schema.Struct({
          name: Schema.String,
        }),
        payload: {
          name: Schema.String,
        },
      }) {}

      const cmd = declareCommand(RequestSchema, (input) =>
        Effect.gen(function* () {
          yield* Effect.logDebug('invoke handle', input)

          return {
            name: input.name,
          }
        }),
      )
      const plan = new ResourcePlan('test', {
        commands: [cmd],
      })

      yield* manager.register(plan)
      yield* manager.run

      const res = yield* manager.invoke(new RequestSchema({ name: '123' }))
      expect(res).toEqual({ name: '123' })
    }).pipe(Effect.provide(TestLive)),
  )

  it.effect('event', () =>
    Effect.gen(function* () {
      const manager = yield* SchedulerManager

      class RequestSchema extends Schema.TaggedRequest<RequestSchema>()('RequestSchema', {
        failure: Schema.Never,
        success: Schema.Void,
        payload: {
          name: Schema.String,
        },
      }) {}

      const event = declareEvent(RequestSchema, (input) =>
        Effect.gen(function* () {
          yield* Effect.logDebug('event handle', input)
        }),
      )
      const plan = new ResourcePlan('test', {
        events: [event],
      })

      yield* manager.register(plan)
      yield* manager.run

      yield* manager.emit(new RequestSchema({ name: '123' }))
    }).pipe(Effect.provide(TestLive)),
  )
})
