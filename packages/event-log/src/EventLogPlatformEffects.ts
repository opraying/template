import * as SqlClient from '@effect/sql/SqlClient'
import * as Context from 'effect/Context'
import * as Data from 'effect/Data'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'

/**
 * LocalStorageStats provides a unified abstraction for application storage usage across Web and React Native (Expo).
 *
 * Design:
 *   - For most applications, only two metrics are relevant:
 *     1. used: How much storage the app has already consumed (in bytes)
 *     2. free: How much more storage the app can use (in bytes)
 *   - This abstraction hides platform-specific details such as quota, total device space, or browser allocation policies.
 *   - This model is intentionally simple: it does not expose quota/total, as these are either unavailable or ambiguous on some platforms.
 *
 * Platform-specific notes:
 *   - Web (navigator.storage.estimate):
 *       - 'used' is the number of bytes used by the origin (site/app).
 *       - 'quota' is the maximum bytes the browser currently allows for the origin.
 *       - 'free' is computed as 'quota - used'.
 *       - Quota may change at any time, and is browser-dependent.
 *   - React-Native (expo-file-system):
 *       - 'used' must be computed by summing the sizes of all files/directories the app owns (no direct API).
 *       - 'free' is the number of bytes available on the device for the app to use (system-wide, not per-app quota).
 *       - There is no concept of a browser-like quota; the only limit is device free space.
 *       - 'total' (device total space) is ignored in this abstraction.
 *
 * Limitations:
 *   - On React-Native, 'used' may be an estimate if not all files are counted.
 *   - On Web, 'free' may shrink if the browser reduces quota or other apps use space.
 *   - This abstraction does not guarantee that writing 'free' bytes will always succeed (OS/browser may enforce other limits).
 *   - This model is not suitable for apps that need to know the exact quota or total device space.
 *
 * Usage:
 *   - Use LocalStorageStats.fromWeb for browser environments.
 *   - Use LocalStorageStats.fromExpo for Expo/React Native environments.
 */
export class LocalStorageStats extends Data.Class<{
  /**
   * Used storage in bytes (already consumed by the app).
   * - Web: from navigator.storage.estimate().used
   * - Expo: sum of all app-owned files (must be computed)
   */
  used: number
  /**
   * Free storage in bytes (how much more can be used).
   * - Web: quota - used (from navigator.storage.estimate())
   * - Expo: from FileSystem.getFreeDiskStorageAsync()
   */
  free: number
}> {
  /**
   * Construct LocalStorageStats for Web (browser) environments.
   * @param used Used storage in bytes (from navigator.storage.estimate().used)
   * @param quota Total quota in bytes (from navigator.storage.estimate().quota)
   * @returns LocalStorageStats with used and free fields populated
   * @see https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/estimate
   */
  static fromWeb(used: number, quota: number): LocalStorageStats {
    return new LocalStorageStats({
      used,
      free: Math.max(0, quota - used),
    })
  }
  /**
   * Construct LocalStorageStats for Expo (React Native) environments.
   * @param used Used storage in bytes (sum of all app-owned files)
   * @param free Free storage in bytes (from FileSystem.getFreeDiskStorageAsync())
   * @returns LocalStorageStats with used and free fields populated
   * @see https://docs.expo.dev/versions/latest/sdk/filesystem/#filesystemgetfreediskstorageasync
   */
  static fromExpo(used: number, free: number): LocalStorageStats {
    return new LocalStorageStats({
      used,
      free,
    })
  }
}

// Expo NetworkStateType: https://docs.expo.dev/versions/latest/sdk/network/#networkstatetype
export type NetworkStateType =
  | 'BLUETOOTH'
  | 'CELLULAR'
  | 'ETHERNET'
  | 'NONE'
  | 'OTHER'
  | 'UNKNOWN'
  | 'VPN'
  | 'WIFI'
  | 'WIMAX'

/**
 * NetworkStatus is designed to be compatible with Expo NetworkState and Web network status.
 *
 * Fields:
 *   - online: Boolean, legacy compatibility, mirrors isConnected.
 *   - isConnected: Boolean, true if device is connected to a network.
 *   - isInternetReachable: Boolean, true if device can reach the internet (may be same as isConnected on some platforms).
 *   - type: NetworkStateType, describes the type of network connection (e.g., WIFI, CELLULAR, etc.).
 *
 * Usage:
 *   - Use NetworkStatus.fromExpo for Expo/React Native environments (using expo-network).
 *   - Use NetworkStatus.fromWeb for browser environments (using navigator.onLine).
 *
 * Limitations:
 *   - On Web, type is always 'ETHERNET' (as browsers do not expose connection type).
 *   - isInternetReachable may be inferred from isConnected if not available.
 */
export class NetworkStatus extends Data.Class<{
  online: boolean
  isConnected: boolean
  isInternetReachable: boolean
  type: NetworkStateType
}> {
  /**
   * Construct from Expo Network.getNetworkStateAsync() result
   * @see https://docs.expo.dev/versions/latest/sdk/network/#networkstatetype
   */
  static fromExpo(state: { isConnected?: boolean; isInternetReachable?: boolean; type?: string }): NetworkStatus {
    return new NetworkStatus({
      online: !!state.isConnected,
      isConnected: !!state.isConnected,
      isInternetReachable: state.isInternetReachable ?? !!state.isConnected,
      type: (state.type as NetworkStateType) ?? 'UNKNOWN',
    })
  }

  /**
   * Construct from Web (navigator.onLine), fallback for missing fields
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine
   */
  static fromWeb(online: boolean): NetworkStatus {
    return new NetworkStatus({
      online,
      isConnected: online,
      isInternetReachable: online,
      type: 'ETHERNET',
    })
  }
}

/**
 * EventLogPlatformEffects provides platform-specific effects for event log operations.
 *
 * - getLocalStorageStats: Returns the current LocalStorageStats for the platform.
 * - getNetworkStatus: Returns the current NetworkStatus for the platform.
 */
export interface EventLogPlatformEffects {
  readonly getLocalStorageStats: Effect.Effect<LocalStorageStats, never, never>

  readonly getNetworkStatus: Effect.Effect<NetworkStatus, never, never>
}

export const EventLogPlatformEffects = Context.GenericTag<EventLogPlatformEffects>(
  '@xstack/event-log/EventLogPlatformEffects',
)

export const Noop = Layer.succeed(EventLogPlatformEffects, {
  getLocalStorageStats: Effect.succeed(LocalStorageStats.fromWeb(0, 1024000)),
  getNetworkStatus: Effect.succeed(NetworkStatus.fromWeb(true)),
})

export const Live = Layer.effect(
  EventLogPlatformEffects,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    type LocalStorageSize = { usage: number; quota: number }

    // Effect to get usage/quota from Web StorageManager API
    const getLocalStorageSize = Effect.promise(
      () =>
        new Promise<LocalStorageSize>((resolve, reject) => {
          if ('storage' in navigator && 'estimate' in navigator.storage) {
            navigator.storage
              .estimate()
              .then((estimate) => {
                resolve({
                  usage: estimate.usage || 0,
                  quota: estimate.quota || 0,
                })
              })
              .catch((error) => reject(error))
          } else {
            reject(new Error('Web StorageManager API not supported'))
          }
        }),
    ).pipe(Effect.orElseSucceed(() => ({ usage: 0, quota: 0 }) as LocalStorageSize))

    // Main effect to get LocalStorageStats
    const getLocalStorageStats: Effect.Effect<LocalStorageStats, never, never> = Effect.gen(function* () {
      const sqliteApi = (sql as unknown as { config: { sqlite3Api?: { getUsedSize: Effect.Effect<number> } } }).config
      let sqliteStorageSize = 0
      if (sqliteApi.sqlite3Api?.getUsedSize) {
        sqliteStorageSize = yield* sqliteApi.sqlite3Api.getUsedSize
      }

      // Try to get Web StorageManager usage/quota
      const { usage, quota } = yield* getLocalStorageSize

      // If Web API returns valid values, use them; otherwise fallback to sqlite usage
      if (quota > 0 && usage > 0) {
        return LocalStorageStats.fromWeb(usage, quota)
      }

      // Fallback: treat all as used, free=0
      return LocalStorageStats.fromExpo(sqliteStorageSize, 0)
    })

    const getNetworkStatus: Effect.Effect<NetworkStatus, never, never> = Effect.gen(function* () {
      const isOnline =
        typeof globalThis.navigator === 'undefined' || typeof globalThis.navigator.onLine === 'undefined'
          ? true
          : globalThis.navigator.onLine

      return NetworkStatus.fromWeb(isOnline)
    })

    return {
      getLocalStorageStats,
      getNetworkStatus,
    }
  }),
)
