import * as LocalFirstSyncSchema from '@xstack/event-log/Schema'
import * as SchedulerWorkerSchema from '@xstack/fx/worker/scheduler/schema'
import * as WorkerRunnerSchema from '@xstack/fx/worker/schema'
import * as SqliteSchema from '@xstack/sqlite/schema'
import * as Schema from 'effect/Schema'

export const WorkerMessage = Schema.Union(
  ...WorkerRunnerSchema.WorkerMessage.members,
  ...SqliteSchema.SqliteEvent.members,
  ...LocalFirstSyncSchema.LocalFirstEvent.members,
  ...SchedulerWorkerSchema.WorkerMessage.members,
)
export type WorkerMessage = typeof WorkerMessage.Type

import type * as BrowserWorkerRunner from '@effect/platform/WorkerRunner'

type Debug = BrowserWorkerRunner.SerializedRunner.Handlers<WorkerMessage>
