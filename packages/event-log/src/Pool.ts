import type * as EffectWorker from '@effect/platform/Worker'
import type * as EventLogSchema from '@xstack/event-log/Schema'
import * as Context from 'effect/Context'

export interface WorkerPoolEvent extends EffectWorker.SerializedWorkerPool<EventLogSchema.LocalFirstEvent> {}

export const WorkerPool = Context.GenericTag<WorkerPoolEvent>('@local-first:worker-pool')
