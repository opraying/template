import { SocketCloseCodes } from '@xstack/event-log/EventLogConfig'
import { Tier } from '@xstack/event-log-server/server/user'
import { getUserUniqueId } from '@xstack/event-log-server/server/utils'
import * as Vault from '@xstack/event-log-server/server/vault'
import * as Context from 'effect/Context'
import * as Data from 'effect/Data'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'

export interface Usage {
  /**
   * check vault count
   */
  readonly checkVaultCount: (params: {
    namespace: string
    userId: string
    publicKey: string
  }) => Effect.Effect<void, UsageCheckError, Tier>
  /**
   * check device count
   */
  readonly checkDeviceCount: (params: {
    namespace: string
    userId: string
    publicKey: string
  }) => Effect.Effect<void, UsageCheckError, Tier>
  /**
   * check storage quota
   */
  readonly checkStorageSize: (params: {
    namespace: string
    userId: string
    publicKey: string
  }) => Effect.Effect<void, UsageCheckError, Tier>
}

// @effect-diagnostics-next-line leakingRequirements:off
export const Usage = Context.GenericTag<Usage>('@local-first:usage')

export class UsageCheckError extends Data.TaggedError('@local-first:usage-check-error')<{
  readonly code: number
  readonly message: string
}> {
  static get DeviceCountExceeded() {
    return new UsageCheckError({
      code: SocketCloseCodes.MAX_DEVICES_REACHED,
      message: 'Device count exceeded',
    })
  }

  static get VaultCountExceeded() {
    return new UsageCheckError({
      code: SocketCloseCodes.MAX_VAULTS_REACHED,
      message: 'Vault count exceeded',
    })
  }

  static get StorageQuotaExceeded() {
    return new UsageCheckError({
      code: SocketCloseCodes.STORAGE_QUOTA_EXCEEDED,
      message: 'Storage quota exceeded',
    })
  }
}

export const Live = Layer.effect(
  Usage,
  Effect.gen(function* () {
    const vault = yield* Vault.Vault

    const checkVaultCount = Effect.fn(function* ({
      namespace,
      userId,
    }: {
      namespace: string
      userId: string
      publicKey: string
    }) {
      const { maxVaults } = yield* Tier
      const userUniqueId = getUserUniqueId(namespace, userId)
      const vaultCount = yield* vault.getUserVaultCount({ userUniqueId }).pipe(Effect.orDie)

      if (vaultCount > maxVaults) {
        return yield* UsageCheckError.VaultCountExceeded
      }
    })

    const checkDeviceCount = ({ namespace, userId }: { namespace: string; userId: string; publicKey: string }) =>
      Effect.gen(function* () {
        const { maxDevices } = yield* Tier
        const userUniqueId = getUserUniqueId(namespace, userId)
        const currentSize = yield* vault.getUserVaultCount({ userUniqueId }).pipe(Effect.orDie)

        if (currentSize > maxDevices) {
          return yield* UsageCheckError.DeviceCountExceeded
        }
      })

    const checkStorageSize = ({
      namespace,
      userId,
      publicKey,
    }: {
      namespace: string
      userId: string
      publicKey: string
    }) =>
      Effect.gen(function* () {
        const { maxStorageBytes } = yield* Tier
        const currentSize = yield* vault.getStats({ namespace, userId, publicKey }).pipe(
          Effect.map((_) => _.usedStorageSize),
          Effect.orDie,
        )

        if (currentSize > maxStorageBytes) {
          return yield* UsageCheckError.StorageQuotaExceeded
        }
      })

    return {
      checkVaultCount,
      checkDeviceCount,
      checkStorageSize,
    }
  }),
)
