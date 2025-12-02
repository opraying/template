import type { SyncServerInfo, SyncStats } from '@xstack/event-log-server/schema'
import * as Context from 'effect/Context'
import type * as Effect from 'effect/Effect'
import * as Schema from 'effect/Schema'

export type StorageParams = {
  namespace: string
  userId: string
  publicKey: string
}

export class StorageAccessError extends Schema.TaggedError<StorageAccessError>('StorageAccessError')(
  'StorageAccessError',
  {
    message: Schema.String,
    cause: Schema.Unknown,
  },
) {}

export class Storage extends Context.Tag('@local-first:storage')<
  Storage,
  {
    readonly getSyncClientCount: (params: StorageParams) => Effect.Effect<number, StorageAccessError>

    readonly getSyncStats: (params: StorageParams) => Effect.Effect<SyncStats, StorageAccessError>

    readonly getSyncInfo: (params: StorageParams) => Effect.Effect<SyncServerInfo, StorageAccessError>

    readonly create: (
      params: StorageParams & { userEmail: string },
      info: { tier: any; note: string },
    ) => Effect.Effect<void, StorageAccessError>

    readonly update: (params: StorageParams, info: { note: string }) => Effect.Effect<void, StorageAccessError>

    readonly destroy: (params: StorageParams) => Effect.Effect<void, StorageAccessError>
  }
>() {}
