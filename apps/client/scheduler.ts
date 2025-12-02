import { Scheduler as Scheduler_ } from '@xstack/fx/worker/scheduler'
import * as SchedulerSchema from '@xstack/fx/worker/scheduler/schema'

const Scheduler = Object.assign(Scheduler_, {
  schemas: SchedulerSchema,
  commands: {} as const,
  events: {} as const,
})

export { Scheduler }
