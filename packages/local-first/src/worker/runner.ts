import type * as EffectWorkerRunner from '@effect/platform/WorkerRunner'
import { BasicLive } from '@xstack/preset-web/browser-worker'
import * as LocalFirstSyncWorker from '@xstack/event-log/Worker'
import * as WorkerRunner from '@xstack/fx/worker/runner'
import type { ResourcePlan } from '@xstack/fx/worker/scheduler/handle'
import * as SchedulerWorkerRunner from '@xstack/fx/worker/scheduler/runner'
import { WorkerMessage } from '@xstack/local-first/worker/schema'
import * as SqliteWorker from '@xstack/sqlite/worker'
import type * as Effect from 'effect/Effect'
import type * as Layer from 'effect/Layer'
import * as Schema from 'effect/Schema'
import type * as Scope from 'effect/Scope'

export const run = <
  R,
  A extends Schema.TaggedRequest.All,
  I,
  Handlers_ extends EffectWorkerRunner.SerializedRunner.Handlers<A>,
  Handlers extends Array<(scope: Scope.CloseableScope) => Partial<Omit<Handlers_, WorkerMessage['_tag']>>>,
>({
  schema,
  layer,
  handlers,
  plans,
}: {
  schema?: Schema.Union<Schema.Schema.AnyNoContext[]>
  layer: Layer.Layer<R, never, Scope.Scope>
  handlers?: Handlers
  plans?: ResourcePlan<Effect.Effect<void, never, never>, Effect.Effect<void, never, never>>[]
}) => {
  // skip in main thread
  if (typeof window !== 'undefined') return

  const workerMessageSchema = schema ? Schema.Union(...WorkerMessage.members, ...schema.members) : WorkerMessage

  WorkerRunner.run<R, A, I, Handlers_, any, never>(
    workerMessageSchema,
    layer,
    [
      SqliteWorker.workerHandles(),
      LocalFirstSyncWorker.workerHandles(),
      SchedulerWorkerRunner.workerHandles(plans || []),
      ...(handlers ?? []),
    ] as unknown as Handlers,
    {
      layer: BasicLive,
    },
  )
}
