import type { TaggedReq } from '@xstack/fx/worker/scheduler/handle'
import * as Effect from 'effect/Effect'
import type { Request } from 'effect/Request'

export class Scheduler extends Effect.Tag('@fx:worker:scheduler')<
  Scheduler,
  {
    readonly init: Effect.Effect<void>
    readonly invoke: <T extends InstanceType<TaggedReq>>(
      request: T,
    ) => Effect.Effect<Request.Success<T>, Request.Error<T>>
    readonly emit: <T extends InstanceType<TaggedReq>>(request: T) => Effect.Effect<void>
  }
>() {}
