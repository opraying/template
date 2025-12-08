/// <reference lib="webworker" />

import * as WorkerRunner from '@xstack/fx/worker/runner'
import type { ResourcePlan } from '@xstack/fx/worker/scheduler/handle'
import { SchedulerManager } from '@xstack/fx/worker/scheduler/manager'
import type * as SchedulerSchema from '@xstack/fx/worker/scheduler/schema'
import * as Effect from 'effect/Effect'
import * as Scope from 'effect/Scope'

export const workerHandles = (
  plans: ResourcePlan<Effect.Effect<void, never, never>, Effect.Effect<void, never, never>>[],
) =>
  WorkerRunner.handler<SchedulerSchema.WorkerMessage>((scope) => ({
    InitScheduler: () =>
      Effect.gen(function* () {
        const manager = yield* SchedulerManager

        yield* Effect.forEach(plans, (plan) => manager.register(plan), {
          concurrency: 'unbounded',
        })

        yield* manager.run
      }).pipe(Effect.provideService(Scope.Scope, scope)) as Effect.Effect<void>,

    SchedulerCommand: (request) =>
      Effect.gen(function* () {
        const manager = yield* SchedulerManager
        return yield* manager.invoke(request.command)
      }).pipe(Effect.provideService(Scope.Scope, scope)),

    SchedulerEvent: (request) =>
      Effect.gen(function* () {
        const manager = yield* SchedulerManager
        return yield* manager.emit(request.event)
      }).pipe(Effect.provideService(Scope.Scope, scope)),
  }))
