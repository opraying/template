import type { DurableObjectNamespace } from '@cloudflare/workers-types'
import { CloudflareBindings } from '@xstack/cloudflare/bindings'
import { DurableObjectError, DurableObjectIdentitySchema } from '@xstack/event-log-server/cloudflare/DurableObjectUtils'
import { DurableState, type SyncServerDurableObject } from '@xstack/event-log-server/cloudflare/SyncServer'
import type { Tier } from '@xstack/event-log-server/server/schema'
import { Storage, StorageAccessError, type StorageParams } from '@xstack/event-log-server/server/storage'
import * as Effect from 'effect/Effect'
import * as Either from 'effect/Either'
import * as Layer from 'effect/Layer'
import * as Option from 'effect/Option'

export const Live = Layer.effect(
  Storage,
  Effect.gen(function* () {
    const durableObject = yield* CloudflareBindings.use((bindings) =>
      bindings.getDurableObjectNamespace('SYNC_SERVER_DURABLE_OBJECT'),
    ).pipe(
      Effect.flatMap(
        Option.match({
          onNone: () => Effect.dieMessage('Durable Object Namespace not found'),
          onSome: (_) => Effect.succeed(_ as unknown as DurableObjectNamespace<SyncServerDurableObject>),
        }),
      ),
    )

    const getStub = (params: StorageParams) => {
      const identityEither = DurableObjectIdentitySchema.fromRecord({
        namespace: params.namespace,
        publicKey: params.publicKey,
        userId: params.userId,
        userEmail: '',
      })

      if (Either.isLeft(identityEither)) {
        return Effect.dieMessage('Invalid identity')
      }

      const identity = identityEither.right
      const durableObjectIdentity = identity.id()
      const durableObjectId = durableObject.idFromName(durableObjectIdentity)
      const stub = durableObject.get(durableObjectId)

      return Effect.succeed({
        stub,
        identity,
      })
    }

    return {
      getSyncClientCount: Effect.fn('getSyncClientCount')(function* ({ namespace, userId, publicKey }: StorageParams) {
        const { stub } = yield* getStub({ namespace, userId, publicKey })

        return yield* Effect.tryPromise({
          try: () => stub.getSyncClientCount(),
          catch: (error) =>
            StorageAccessError.make({
              message: 'Failed to get sync client count',
              cause: DurableObjectError.fromUnknown(error),
            }),
        })
      }),
      getSyncInfo: Effect.fn('getSyncInfo')(function* ({ namespace, userId, publicKey }: StorageParams) {
        const { stub } = yield* getStub({ namespace, userId, publicKey })

        return yield* Effect.tryPromise({
          try: () => stub.getSyncInfo(),
          catch: (error) =>
            StorageAccessError.make({
              message: 'Failed to get sync info',
              cause: DurableObjectError.fromUnknown(error),
            }),
        })
      }),
      getSyncStats: Effect.fn('getSyncStats')(function* ({ namespace, userId, publicKey }: StorageParams) {
        const { stub } = yield* getStub({ namespace, userId, publicKey })

        return yield* Effect.tryPromise({
          try: () => stub.getSyncStats(),
          catch: (error) =>
            StorageAccessError.make({
              message: 'Failed to get sync stats',
              cause: DurableObjectError.fromUnknown(error),
            }),
        })
      }),
      create: Effect.fn('create')(function* (
        { namespace, userId, publicKey }: StorageParams,
        info: { tier: Tier; note: string },
      ) {
        const { stub, identity } = yield* getStub({ namespace, userId, publicKey })

        const payload = DurableState.encode({
          identity: Option.fromNullable(identity),
          tier: Option.fromNullable(info.tier),
          note: info.note,
        })

        return yield* Effect.tryPromise({
          try: () => stub.create(payload),
          catch: (error) =>
            StorageAccessError.make({
              message: 'Failed to create durable object',
              cause: DurableObjectError.fromUnknown(error),
            }),
        })
      }),
      update: Effect.fn('update')(function* ({ namespace, userId, publicKey }: StorageParams, info: { note: string }) {
        const { stub } = yield* getStub({ namespace, userId, publicKey })

        return yield* Effect.tryPromise({
          try: () => stub.updateState({ note: info.note }),
          catch: (error) =>
            StorageAccessError.make({
              message: 'Failed to update durable object',
              cause: DurableObjectError.fromUnknown(error),
            }),
        })
      }),
      destroy: Effect.fn('destroy')(function* ({ namespace, userId, publicKey }: StorageParams) {
        const { stub } = yield* getStub({ namespace, userId, publicKey })

        return yield* Effect.tryPromise({
          try: () => stub.destroy(),
          catch: (error) =>
            StorageAccessError.make({
              message: 'Failed to destroy durable object',
              cause: DurableObjectError.fromUnknown(error),
            }),
        })
      }),
    }
  }),
)
