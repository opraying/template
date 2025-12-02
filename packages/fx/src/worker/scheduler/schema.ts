import * as Schema from 'effect/Schema'

export class InitScheduler extends Schema.TaggedRequest<InitScheduler>()('InitScheduler', {
  failure: Schema.Never,
  success: Schema.Void,
  payload: {},
}) {}

export class SchedulerCommand extends Schema.TaggedRequest<SchedulerCommand>()('SchedulerCommand', {
  failure: Schema.Any,
  success: Schema.Any,
  payload: {
    command: Schema.parseJson(Schema.Any),
  },
}) {}

export class SchedulerEvent extends Schema.TaggedRequest<SchedulerEvent>()('SchedulerEvent', {
  failure: Schema.Never,
  success: Schema.Any,
  payload: {
    event: Schema.parseJson(Schema.Any),
  },
}) {}

export const WorkerMessage = Schema.Union(InitScheduler, SchedulerCommand, SchedulerEvent)
export type WorkerMessage = typeof WorkerMessage.Type
