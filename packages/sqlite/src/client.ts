import * as Reactivity from '@effect/experimental/Reactivity'
import * as SqlClient from '@effect/sql/SqlClient'
import type * as Client from '@xstack/sqlite/internal/client'
import * as Internal from '@xstack/sqlite/internal/client'
import * as Pool from '@xstack/sqlite/pool'
import { RelayClient } from '@xstack/sqlite/relay-client'
import * as SqliteSchema from '@xstack/sqlite/schema'
import * as Config from 'effect/Config'
import * as Context from 'effect/Context'
import * as DefaultServices from 'effect/DefaultServices'
import * as Effect from 'effect/Effect'
import * as FiberRef from 'effect/FiberRef'
import { flow, pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import * as Match from 'effect/Match'
import * as RuntimeFlags from 'effect/RuntimeFlags'
import * as Stream from 'effect/Stream'
import * as String from 'effect/String'

const LOG_SPAN = '@sql-client'

export const withSqlClient = <A, E, R>(effect: (client: Client.SqlClient) => Effect.Effect<A, E, R>) =>
  Effect.context<never>().pipe(
    Effect.flatMap((context) => effect(Context.unsafeGet(context, SqlClient.SqlClient) as Client.SqlClient)),
  )

export const getSqlClient = Effect.context<never>().pipe(
  Effect.map((context) => Context.unsafeGet(context, SqlClient.SqlClient) as SqlClient.SqlClient),
)

const make = Effect.gen(function* () {
  const workerPool = yield* Pool.WorkerPool
  const reactivity = yield* Reactivity.Reactivity
  const client = yield* SqlClient.SqlClient

  yield* Effect.logTrace('start sqlite stream event listener')

  const reactivityUpdate = Match.type<SqliteSchema.SqliteUpdateEvent>().pipe(
    Match.tag('SqliteUpdateHookEvent', ({ table, rowid }) => reactivity.invalidate({ [table]: [rowid] })),
    Match.tag('SqliteLockChangeHookEvent', ({ lockAcquire }) =>
      pipe(
        Effect.logTrace(`sqlite lock changed: ${lockAcquire}`),
        Effect.tap(() => {
          //@ts-ignore
          globalThis.__x_sqlite_lockAcquire = lockAcquire
          //@ts-ignore
          if (typeof globalThis.__x_sqlite_lockAcquireChange === 'function') {
            try {
              //@ts-ignore
              globalThis.__x_sqlite_lockAcquireChange({ lockAcquire })
            } catch {}
          }
        }),
      ),
    ),
    Match.exhaustive,
  )

  // Start listening to the event flow sent by Worker to Client, which should not be interrupted.
  yield* pipe(
    workerPool.execute(new SqliteSchema.SqliteStreamEvent()),
    Stream.tap((event) => Effect.fork(Effect.uninterruptible(handleUpdate(event)))),
    Stream.runDrain,
    Effect.interruptible,
    Effect.provide(RuntimeFlags.disableRuntimeMetrics),
    Effect.forkScoped,
  )
  const handleUpdate = flow(Effect.succeed<SqliteSchema.SqliteUpdateEvent>, Effect.tap(reactivityUpdate))

  yield* RelayClient.setWorker(workerPool, client)
  yield* FiberRef.update(DefaultServices.currentServices, (context) =>
    Context.add(context, SqlClient.SqlClient, client),
  )
}).pipe(Effect.withLogSpan(LOG_SPAN))

export const layer = (options?: Omit<Client.SqliteClientConfig, 'relay'>) =>
  pipe(
    Layer.scopedDiscard(make),
    Layer.provideMerge(Layer.unwrapEffect(Effect.map(RelayClient, (relay) => Internal.layer({ ...options, relay })))),
    Layer.provide(RelayClient.Default),
  )

export const layerConfig = (
  options: Config.Config.Wrap<Omit<Client.SqliteClientConfig, 'relay'>> = Config.succeed({}),
) =>
  pipe(
    Layer.scopedDiscard(make),
    Layer.provideMerge(
      Layer.unwrapEffect(
        Effect.flatMap(Config.unwrap(options), (_) =>
          Effect.map(RelayClient, (relay) => Internal.layer({ ..._, relay })),
        ),
      ),
    ),
    Layer.provide(RelayClient.Default),
  )

const SqliteConfig = Config.all({
  SQLITE_CAMEL: Config.boolean('CAMEL').pipe(
    Config.nested('DB'),
    Config.withDefault(true),
    Config.orElse(() => Config.succeed(true)),
  ),
})

export const SqliteLive = Layer.unwrapEffect(
  Effect.gen(function* () {
    const { SQLITE_CAMEL } = yield* SqliteConfig

    return layer(
      SQLITE_CAMEL
        ? {
            transformQueryNames: String.camelToSnake,
            transformResultNames: String.snakeToCamel,
          }
        : {},
    )
  }),
)
