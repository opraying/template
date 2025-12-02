import * as SqlD1 from '@effect/sql-d1/D1Client'
import { CloudflareBindings } from '@xstack/cloudflare/bindings'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Option from 'effect/Option'
import * as String from 'effect/String'

export const DBLive = Layer.unwrapEffect(
  Effect.gen(function* () {
    const db = yield* CloudflareBindings.use((bindings) => bindings.getD1Database('DB')).pipe(
      Effect.flatMap(
        Option.match({
          onNone: () => Effect.dieMessage('Database not found'),
          onSome: Effect.succeed,
        }),
      ),
    )

    return SqlD1.layer({
      db,
      transformQueryNames: String.camelToSnake,
      transformResultNames: String.snakeToCamel,
    })
  }),
).pipe(Layer.orDie)

export const DB = SqlD1.D1Client
