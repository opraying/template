import * as HttpApiBuilder from '@effect/platform/HttpApiBuilder'
import { SyncHttpApi } from '@xstack/event-log-server/server/api'
import { VaultNotFoundError } from '@xstack/event-log-server/server/errors'
import { CurrentAuthSession } from '@xstack/event-log-server/server/schema'
import { Vault } from '@xstack/event-log-server/server/vault'
import * as Effect from 'effect/Effect'

export const SyncVaultApiHttpLive = HttpApiBuilder.group(
  SyncHttpApi,
  'sync',
  Effect.fn(function* (handles) {
    return handles
      .handle(
        'register',
        Effect.fn(function* ({ urlParams: { q }, payload }) {
          const { namespace } = q
          const { items } = payload
          const user = yield* CurrentAuthSession
          const vault = yield* Vault

          return yield* vault
            .register({
              namespace,
              userId: user.id,
              userEmail: user.email,
              tier: user.tier,
              items,
            })
            .pipe(Effect.orDie)
        }),
      )
      .handle(
        'stats',
        Effect.fn(function* ({ urlParams: { q } }) {
          const { namespace, publicKey } = q
          const user = yield* CurrentAuthSession
          const vault = yield* Vault

          return yield* vault.getStats({ namespace, userId: user.id, publicKey }).pipe(
            Effect.catchTags({
              NoSuchElementException: () => new VaultNotFoundError(),
              StorageAccessError: Effect.die,
              ParseError: Effect.die,
              SqlError: Effect.die,
            }),
          )
        }),
      )
      .handle(
        'update',
        Effect.fn(function* ({ urlParams: { q }, payload }) {
          const { namespace, publicKey } = q
          const user = yield* CurrentAuthSession
          const vault = yield* Vault

          return yield* vault
            .update({
              namespace,
              userId: user.id,
              publicKey,
              info: { note: payload.note },
            })
            .pipe(
              Effect.catchTags({
                NoSuchElementException: () => new VaultNotFoundError(),
                ParseError: Effect.die,
                SqlError: Effect.die,
              }),
            )
        }),
      )
      .handle(
        'destroy',
        Effect.fn(function* ({ urlParams: { q } }) {
          const { namespace, publicKey } = q
          const user = yield* CurrentAuthSession
          const vault = yield* Vault

          return yield* vault.destroy({ namespace, userId: user.id, publicKey }).pipe(
            Effect.catchTags({
              NoSuchElementException: () => new VaultNotFoundError(),
              ParseError: Effect.die,
              SqlError: Effect.die,
            }),
          )
        }),
      )
  }),
)
