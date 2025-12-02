import * as Reactivity from '@effect/experimental/Reactivity'
import * as SqlClient from '@effect/sql/SqlClient'
import { BasicLive } from '@xstack/preset-web/browser'
import * as EventLog from '@xstack/event-log/EventLog'
import * as EventLogStates from '@xstack/event-log/EventLogStates'
import * as EventLogWorker from '@xstack/event-log/EventLogWorker'
import * as Identity from '@xstack/event-log/IdentityWeb'
import * as GlobalLayer from '@xstack/atom-react/global'
import type { CoreWorkerPool } from '@xstack/fx/worker/pool'
import type { Scheduler } from '@xstack/fx/worker/scheduler'
import { SchedulerMake } from '@xstack/fx/worker/scheduler/worker'
import { SqliteLive } from '@xstack/sqlite/client'
import type * as Kysely from '@xstack/sqlite/kysely'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import * as Tracer from 'effect/Tracer'

export const make = <LA = never>(
  {
    CoreWorkerLive,
    DBLive,
    inputLayer = Layer.empty as Layer.Layer<LA>,
  }: {
    CoreWorkerLive: Layer.Layer<CoreWorkerPool<any>, never, never>
    DBLive: Layer.Layer<SqlClient.SqlClient | Kysely.Kysely, never, SqlClient.SqlClient>
    inputLayer?: Layer.Layer<LA, never, SqlClient.SqlClient | Scheduler | EventLog.EventLog>
  },
  options: {
    envPatch?: (envMap: Map<string, string>) => Map<string, string>
  } = {},
) => {
  const PatchEnvLive = Layer.scopedDiscard(
    Effect.gen(function* () {
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          // @ts-ignore
          globalThis.patchEnv = null
        }),
      )

      // @ts-ignore
      globalThis.patchEnv = options.envPatch ?? (() => {})
    }),
  )

  const DBLive_ = DBLive.pipe(Layer.provide(SqliteLive), Layer.provide([Reactivity.layer, CoreWorkerLive]), Layer.orDie)

  const IdentityLive = Identity.layer.pipe(Layer.provide(CoreWorkerLive))

  const EventLogStatesLive = EventLogStates.layer.pipe(
    Layer.provide([IdentityLive, Reactivity.layer, DBLive_, CoreWorkerLive]),
  )

  const EventLogLive = pipe(EventLogWorker.EventLogWorker, Layer.provide(CoreWorkerLive))

  const SchedulerLive = SchedulerMake.pipe(Layer.provide(DBLive_), Layer.provide(CoreWorkerLive), Layer.orDie)

  const TracerLive = Layer.unwrapEffect(
    Effect.gen(function* () {
      const tracer = yield* Effect.withFiberRuntime<Tracer.Tracer>((_) => Effect.sync(() => _.currentTracer))

      return Layer.succeed(Tracer.Tracer, tracer)
    }),
  )

  const merge = Layer.provide(inputLayer, [
    TracerLive,
    DBLive_,
    SchedulerLive,
    IdentityLive,
    EventLogStatesLive,
    EventLogLive,
  ])

  const GlobalLayer_ = GlobalLayer.add('AppGlobal', [
    [TracerLive, Tracer.Tracer],
    [DBLive_, SqlClient.SqlClient],
    [Reactivity.layer, Reactivity.Reactivity],
    [IdentityLive, Identity.Identity],
    [EventLogStatesLive, EventLogStates.EventLogStates],
    [EventLogLive, EventLog.EventLog],
  ])

  const all = pipe(
    Layer.mergeAll(
      GlobalLayer_,
      TracerLive,
      DBLive_,
      Reactivity.layer,
      SchedulerLive,
      IdentityLive,
      EventLogStatesLive,
      EventLogLive,
      merge,
    ),
    Layer.provide(PatchEnvLive),
    Layer.provideMerge(BasicLive),
    Layer.tapErrorCause(Effect.logError),
    Layer.orDie,
  )

  const Live = all as unknown as Layer.Layer<Layer.Layer.Success<typeof all> | LA, never, never>

  return {
    Live,
  }
}
