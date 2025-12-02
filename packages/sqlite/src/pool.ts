import type * as EffectWorker from '@effect/platform/Worker'
import type * as SqliteSchema from '@xstack/sqlite/schema'
import * as Context from 'effect/Context'

export interface WorkerPoolEvent extends EffectWorker.SerializedWorkerPool<SqliteSchema.SqliteEvent> {}

export const WorkerPool = Context.GenericTag<WorkerPoolEvent>('@xstack/sqlite/worker-pool')
