import * as SqlClient from '@effect/sql/SqlClient'
import * as EventLogPlatformEffects from '@xstack/event-log/EventLogPlatformEffects'
import type * as OPSqlClient from '@xstack/sql-op-sqlite/SqlClient'
import * as Arr from 'effect/Array'
import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as ExpoFileSystem from 'expo-file-system'
import * as ExpoNetwork from 'expo-network'

// Interface for external database storage calculation
export interface ExternalDatabaseStorage {
  readonly get: Effect.Effect<number, never, never>[]
}

export const ExternalDatabaseStorage = Context.GenericTag<ExternalDatabaseStorage>(
  '@xstack/event-log/EventLogPlatformEffects/ExternalDatabaseStorage',
)

export const Live = Layer.effect(
  EventLogPlatformEffects.EventLogPlatformEffects,
  Effect.gen(function* () {
    const sql = (yield* SqlClient.SqlClient) as OPSqlClient.SqliteClient
    const externalStorage = yield* ExternalDatabaseStorage

    const getLocalStorageStats: Effect.Effect<EventLogPlatformEffects.LocalStorageStats, never, never> = Effect.gen(
      function* () {
        // Get internal SQL database size
        const internalDbPath = yield* sql.extra.getDbPath()
        const internalDbSize = yield* Effect.sync(() => {
          const file = new ExpoFileSystem.File(internalDbPath);
          const info = file.info();
          return info.exists ? info.size??0 : 0;
        })

        // Get external database size
        const externalDbSize = yield* Effect.allSuccesses(externalStorage.get).pipe(
          Effect.map(Arr.reduce(0, (acc, curr) => acc + curr)),
        )

        // Calculate total size
        const totalDbSize = internalDbSize + externalDbSize

        // Get free disk storage
        const freeStorage = yield* Effect.sync(() => ExpoFileSystem.Paths.availableDiskSpace)

        return EventLogPlatformEffects.LocalStorageStats.fromExpo(totalDbSize, freeStorage)
      },
    )

    const getNetworkStatus: Effect.Effect<EventLogPlatformEffects.NetworkStatus, never, never> = Effect.gen(
      function* () {
        const networkState = yield* Effect.promise(() => ExpoNetwork.getNetworkStateAsync())
        return EventLogPlatformEffects.NetworkStatus.fromExpo(networkState)
      },
    )

    return {
      getLocalStorageStats,
      getNetworkStatus,
    }
  }),
)
