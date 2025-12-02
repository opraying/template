import * as EventLogWorkerPool from '@xstack/event-log/Pool'
import * as WorkerPool from '@xstack/fx/worker/pool'
import { CoreWorkerPool } from '@xstack/fx/worker/pool'
import * as SqliteWorkerPool from '@xstack/sqlite/pool'
import * as Context from 'effect/Context'
import { flow } from 'effect/Function'
import * as Layer from 'effect/Layer'
import type * as Schema from 'effect/Schema'

export const make = <I extends Schema.TaggedRequest.All>(workerFactory: (name: string) => Worker) =>
  class extends Context.Tag(CoreWorkerPool.key)<any, CoreWorkerPool<I>>() {
    static Live = Layer.scoped(
      CoreWorkerPool,
      WorkerPool.make({
        size: 1,
        concurrency: 99,
        workerFactory: (id) => {
          const workerType = WorkerPool.getWorkerType()
          return workerFactory(`${workerType}-${id}`)
        },
      }),
    ).pipe(
      Layer.map((context) =>
        flow(
          Context.add(SqliteWorkerPool.WorkerPool, Context.get(context, CoreWorkerPool)),
          Context.add(EventLogWorkerPool.WorkerPool, Context.get(context, CoreWorkerPool)),
        )(context),
      ),
      Layer.orDie,
    )
  }
