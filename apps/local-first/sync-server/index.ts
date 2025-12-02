import * as SqlD1 from '@effect/sql-d1/D1Client'
import { CloudflareBindings } from '@xstack/cloudflare/bindings'
import { LoggerLive } from '@xstack/server/logger'
import * as DurableObjectStorage from '@xstack/event-log-server/cloudflare/DurableObjectStorage'
import * as SyncServer from '@xstack/event-log-server/cloudflare/SyncServer'
import { Ratelimit } from '@xstack/event-log-server/server/ratelimit'
import { UserSession } from '@xstack/event-log-server/server/schema'
import * as Usage from '@xstack/event-log-server/server/usage'
import { Authentication, Tier } from '@xstack/event-log-server/server/user'
import * as Vault from '@xstack/event-log-server/server/vault'
import {
  DestroyVaultWorkflow,
  Live as DestroyVaultWorkflowLive,
} from '@xstack/event-log-server/workflows/destroy-vault'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as Option from 'effect/Option'
import * as Redacted from 'effect/Redacted'
import * as String from 'effect/String'
import { Config } from './config'

const DBLive = Layer.unwrapEffect(
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

const AuthenticationLive = Layer.sync(Authentication, () => {
  return Authentication.of({
    fromToken: ({ namespace, token }) =>
      Effect.gen(function* () {
        // const session = yield* Session.sessionFromToken(appNamespace, token)
        // const subscription = yield* Subscription.subscriptionFromToken(appNamespace, token)
        return Option.some(
          UserSession.make({
            id: '123',
            email: '123@123.com' as any,
            token,
            username: '123',
            tier: {
              maxDevices: 5,
              maxStorageBytes: 1024 * 1024 * 1024,
              maxVaults: 5,
            },
          }),
        )
      }),
    fromRequest: (request) =>
      Effect.gen(function* () {
        const headers = request.headers
        const _namespace = headers.get('x-namespace') ?? ''
        const token = Redacted.make(headers.get('x-session') ?? '')

        return Option.some(
          UserSession.make({
            id: '123',
            email: '123@123.com' as any,
            token,
            username: '123',
            tier: {
              maxDevices: 5,
              maxStorageBytes: 1024 * 1024 * 1024,
              maxVaults: 5,
            },
          }),
        )
      }),
  })
})

const RatelimitLive = Layer.effect(
  Ratelimit,
  Effect.gen(function* () {
    const { ratelimitBasic, ratelimitLow } = yield* CloudflareBindings.use((_) =>
      Effect.all({
        ratelimitBasic: _.getRateLimit('RATE_LIMIT_TIER_BASIC'),
        ratelimitLow: _.getRateLimit('RATE_LIMIT_TIER_LOW'),
      }).pipe(Effect.map(Option.all)),
    ).pipe(
      Effect.flatMap(
        Option.match({
          onNone: () => Effect.dieMessage('Ratelimit not found'),
          onSome: Effect.succeed,
        }),
      ),
    )

    const connectCheck = Effect.fnUntraced(function* ({
      request,
      token,
    }: {
      request: Request
      token?: Redacted.Redacted<string> | undefined
    }) {
      const limit = ratelimitLow
      const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'global'

      const tokenStr = token ? Redacted.value(token) : undefined
      const limitKey = tokenStr || ip

      return yield* Effect.promise(() => limit.limit({ key: limitKey }).then((_) => _.success))
    })

    const limit = Effect.fnUntraced(function* ({ key }: { key: string }) {
      const _tier = yield* Tier

      // [TODO] 使用 Tier level 来进行匹配
      const limit = ratelimitBasic

      return yield* Effect.promise(() => limit.limit({ key }).then((_) => _.success))
    })

    return {
      connectCheck,
      limit,
    }
  }),
)

const VaultLive = Vault.Vault.Default.pipe(Layer.provide([DurableObjectStorage.Live, DestroyVaultWorkflowLive, DBLive]))

const UsageLive = Usage.Live.pipe(Layer.provide(VaultLive))

const Live = Layer.mergeAll(AuthenticationLive, RatelimitLive, UsageLive, VaultLive).pipe(Layer.provide(LoggerLive))

export { DestroyVaultWorkflow }

export class SyncServerDurableObject extends SyncServer.makeDurableObject({
  layer: Live,
  rpcPath: Config.rpcPath,
  syncPath: Config.syncPath,
  syncAgentClientBinding: Config.syncAgentClientBinding,
}) {}

export default SyncServer.makeWorker({
  rpcPath: Config.rpcPath,
  syncPath: Config.syncPath,
  durableObjectBinding: Config.syncServerDurableObject,
  layer: Live,
})
