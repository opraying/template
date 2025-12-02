import * as EventLogStatesWorker from '@xstack/event-log/EventLogStatesWorker'
import * as EventLogWorkerPool from '@xstack/event-log/Pool'
import * as EventLogSchema from '@xstack/event-log/Schema'
import { EventEmitter } from '@xstack/event-log/Utils'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Stream from 'effect/Stream'

export * from '@xstack/event-log/EventLogStatesWorker'

export const layer = Layer.scoped(
  EventLogStatesWorker.EventLogStates,
  Effect.gen(function* () {
    const worker = yield* EventLogWorkerPool.WorkerPool

    const stream = worker.execute(new EventLogSchema.EventLogEventStreamEvent()).pipe(Stream.orDie)
    const events = new EventEmitter()

    yield* stream.pipe(
      Stream.tap((_) => Effect.sync(() => events.emit('sync-event', _))),
      Stream.runDrain,
      Effect.forkScoped,
    )

    const methods = yield* EventLogStatesWorker.make(events)

    return {
      ...methods,
      offer: (_: any) => Effect.succeed(false),
    }
  }).pipe(Effect.withLogSpan('@event-log/states')),
)
