import {
  CommandHandle,
  type CommandRequest,
  type CommandRequestHandle,
  EventHandle,
  type EventRequest,
  type EventRequestHandle,
  type Plan,
} from '@xstack/fx/worker/scheduler/handle'
import * as Context from 'effect/Context'
import * as Deferred from 'effect/Deferred'
import * as Effect from 'effect/Effect'
import * as FiberMap from 'effect/FiberMap'
import * as FiberSet from 'effect/FiberSet'
import * as Layer from 'effect/Layer'
import * as PubSub from 'effect/PubSub'
import type { Request } from 'effect/Request'
import * as Schedule from 'effect/Schedule'
import * as String from 'effect/String'

/**
 * 需要一个 Manager 来管理 Plan 的生命周期
 *
 * 生命周期
 *
 * - 初始化  (监听事件 event，注册 command handle 等)
 * - 后台   （后台任务）
 * - 可见   （立即执行任务）
 * - 卸载    (清理资源)
 */

export interface EventPubSub {}
export const EventPubSub = Context.GenericTag<EventPubSub, PubSub.PubSub<any>>('@fx:worker:scheduler-event-pubsub')
export const EventPubSubLive = Layer.effect(EventPubSub, PubSub.unbounded())

const make = Effect.gen(function* () {
  const _pubSub = yield* EventPubSub
  const initDeferred = yield* Deferred.make<boolean>()
  const fiberSet = yield* FiberSet.make()
  const backgroundFiberMap = yield* FiberMap.make<string>()
  const context = yield* Effect.context<never>()

  const plans: Plan[] = []
  const commandHandle = new CommandHandle()
  const eventHandle = new EventHandle()

  const register = <T extends Plan>(plan: T) =>
    Effect.sync(() => {
      plans.push(plan as unknown as Plan)
    })

  const handle = <T extends CommandRequestHandle<any>>(handle: T) =>
    Effect.sync(() => {
      commandHandle.set(handle)
    })

  const invoke = <T extends CommandRequest, A extends Request.Success<T>, E extends Request.Error<T>>(
    request: T,
  ): Effect.Effect<A, E, never> =>
    Deferred.await(initDeferred).pipe(
      Effect.zipRight(commandHandle.invoke<T, A, E>(request).pipe(Effect.provide(context))),
    )

  const on = <T extends EventRequestHandle<any>>(handle: T) =>
    Effect.sync(() => {
      eventHandle.set(handle)
    })

  const emit = <T extends EventRequest>(request: T): Effect.Effect<void> =>
    Deferred.await(initDeferred).pipe(Effect.zipRight(eventHandle.invoke<T>(request)), Effect.provide(context))

  const run = Effect.gen(function* () {
    if (yield* Deferred.isDone(initDeferred)) {
      return
    }

    // Register the event/command handle
    yield* Effect.forEach(plans, (plan) =>
      Effect.all(
        [
          Effect.forEach(plan.commands, (command) => handle(command)),
          Effect.forEach(plan.events, (event) => on(event)),
        ],
        { concurrency: 'unbounded', discard: true },
      ),
    ).pipe(Effect.withSpan('plan-manager.register'))

    const planName = (name: string) => String.snakeToKebab(String.pascalToSnake(name))

    // Run the immediate plan
    yield* Effect.forEach(
      plans,
      (plan) => plan.immediate.pipe(Effect.provide(context), Effect.withLogSpan(`${planName(plan.name)}.immediate`)),
      {
        concurrency: 5,
        discard: true,
      },
    ).pipe(Effect.withSpan('plan-manager.run-immediate'))

    // Run the background plan
    yield* Effect.forEach(
      plans,
      (plan) =>
        FiberMap.run(
          backgroundFiberMap,
          plan.name,
          plan.background.pipe(
            Effect.provide(context),
            Effect.withLogSpan(`${planName(plan.name)}.background`),
            Effect.forkDaemon,
          ),
        ),
      {
        concurrency: 5,
        discard: true,
      },
    ).pipe(Effect.withSpan('plan-manager.run-background'))

    // Release the init deferred
    yield* Deferred.succeed(initDeferred, true)

    // start heartcheck
    yield* Effect.sleep('1 second').pipe(
      Effect.zipRight(
        // TODO: check all background fiber
        Effect.void.pipe(
          Effect.repeat({
            schedule: Schedule.spaced('5 second'),
          }),
        ),
      ),
      Effect.withSpan('plan-manager.heartcheck'),
      Effect.forkDaemon,
      FiberSet.run(fiberSet),
    )
  }).pipe(Effect.withSpan('plan-manager.run'))

  return {
    register,
    handle,
    invoke,
    on,
    emit,
    run,
  } as const
})

export class SchedulerManager extends Context.Tag('@fx:worker:scheduler:scheduler-manger')<
  SchedulerManager,
  Effect.Effect.Success<typeof make>
>() {
  static Live = Layer.scoped(this, make)
}
