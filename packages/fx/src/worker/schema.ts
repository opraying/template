import { allLevels } from 'effect/LogLevel'
import * as Schema from 'effect/Schema'

const LogLevel = Schema.Literal(...allLevels.map((_) => _._tag))

export const WorkerConfig = Schema.Struct({
  logLevel: LogLevel.pipe(Schema.optional),
  sessionId: Schema.String.pipe(Schema.optional),
  token: Schema.String.pipe(Schema.optional),
})

export class InitialMessage extends Schema.TaggedRequest<InitialMessage>()('InitialMessage', {
  failure: Schema.Never,
  success: Schema.Void,
  payload: WorkerConfig.fields,
}) {}

export class RunnerInterrupt extends Schema.TaggedRequest<RunnerInterrupt>()('RunnerInterrupt', {
  failure: Schema.Never,
  success: Schema.Void,
  payload: {},
}) {}

export class WorkerConfigChange extends Schema.TaggedRequest<WorkerConfigChange>()('WorkerConfigChange', {
  failure: Schema.Never,
  success: Schema.Void,
  payload: WorkerConfig.fields,
}) {}

export const WorkerMessage = Schema.Union(InitialMessage, RunnerInterrupt, WorkerConfigChange)
export type WorkerMessage = typeof WorkerMessage.Type
