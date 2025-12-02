import * as EventLog from '@xstack/event-log/EventLog'
import * as EventLogWorkerPool from '@xstack/event-log/Pool'
import * as EventLogSchema from '@xstack/event-log/Schema'
import { EventEmitter } from '@xstack/event-log/Utils'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'

export const EventLogWorker = Layer.effect(
  EventLog.EventLog,
  Effect.gen(function* () {
    const workerPool = yield* EventLogWorkerPool.WorkerPool

    return EventLog.EventLog.of({
      write: (options) =>
        workerPool
          .executeEffect(new EventLogSchema.EventLogWriteRequest({ event: options.event, payload: options.payload }))
          .pipe(Effect.orDie),

      destroy: Effect.void,

      entries: workerPool.executeEffect(new EventLogSchema.EventLogEntriesRequest({})).pipe(Effect.orDie),

      registerRemote: () => Effect.void,

      removeRemote: () => Effect.void,

      events: new EventEmitter(),
    })
  }),
)
