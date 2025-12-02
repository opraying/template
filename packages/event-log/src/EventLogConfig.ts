import * as Config from 'effect/Config'
import * as Duration from 'effect/Duration'
import * as Schema from 'effect/Schema'

const RuntimeSchema = Schema.Literal('node', 'deno', 'workerd', 'bun', 'browser', 'webworker', 'react-native')
export type SupportedRuntime = typeof RuntimeSchema.Type

function getCurrentRuntime(): SupportedRuntime {
  if (
    typeof globalThis !== 'undefined' &&
    // @ts-ignore
    typeof globalThis.Deno !== 'undefined'
  ) {
    return 'deno'
  }

  if (
    typeof globalThis !== 'undefined' &&
    // @ts-ignore
    typeof globalThis.Bun !== 'undefined'
  ) {
    return 'bun'
  }

  if (typeof globalThis !== 'undefined' && 'Cloudflare' in globalThis) {
    return 'workerd'
  }

  // @ts-ignore
  const isWebWorker = typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope

  if (isWebWorker) {
    return 'webworker'
  }

  const isBrowserMain = !isWebWorker && typeof document !== 'undefined' && typeof window !== 'undefined'

  if (isBrowserMain) {
    return 'browser'
  }

  if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') {
    return 'react-native'
  }

  return 'node'
}

/**
 * SYNC algorithm parameters
 * These are fixed values based on the encryption algorithms used
 */
export const CRYPTO_PARAMS = {
  // AES-GCM parameters
  IV_LENGTH: 12, // AES-GCM IV length in bytes
  TAG_LENGTH: 128, // AES-GCM authentication tag length in bits
  PUBLIC_KEY_LENGTH: 33, // secp256k1 compressed public key length in bytes
} as const

export const StorageLocation = Config.string('STORAGE_LOCATION').pipe(
  Config.nested('SYNC'),
  Config.map((location) => {
    return (
      location
        // remove file:// prefix
        .replace(/^file:\/\//, '')
        // remove trailing slash
        .replace(/\/$/, '')
    )
  }),
  Config.orElse(() => Config.succeed('')),
)

export const EventLogMnemonic = Config.redacted('MNEMONIC')

export const EventLogConfig = Config.all({
  // Runtime Configuration
  runtime: Schema.Config('RUNTIME', RuntimeSchema).pipe(
    Config.nested('SYNC'),
    Config.orElse(() => Config.succeed(getCurrentRuntime())),
  ),
  storageLocation: StorageLocation,

  namespace: Config.string('NAMESPACE').pipe(
    Config.nested('SYNC'),
    Config.orElse(() => Config.string('NAMESPACE')),
  ),

  // Identity Configuration
  mnemonicKey: Config.string('MNEMONIC_KEY').pipe(
    Config.nested('SYNC'),
    Config.orElse(() => Config.succeed('mnemonic')),
  ),

  // Sync Configuration

  syncUrl: Config.string('URL').pipe(
    Config.nested('SYNC'),
    Config.orElse(() => Config.string('URL')),
  ),

  syncRemoteStatsInterval: Config.duration('REMOTE_STATS_INTERVAL').pipe(
    Config.nested('SYNC'),
    Config.orElse(() => Config.succeed(Duration.minutes(3))),
  ),

  syncLocalStatsInterval: Config.duration('LOCAL_STATS_INTERVAL').pipe(
    Config.nested('SYNC'),
    Config.orElse(() => Config.succeed(Duration.minutes(1))),
  ),

  // Write Configuration
  writeInterval: Config.duration('WRITE_INTERVAL').pipe(
    Config.nested('SYNC'),
    Config.orElse(() => Config.succeed(Duration.millis(500))),
  ),

  // DEK (Data Encryption Key) Configuration
  dekTtl: Config.duration('DEK_TTL').pipe(
    Config.nested('SYNC'),
    Config.orElse(() => Config.succeed(Duration.minutes(15))),
  ),

  dekMaxUses: Config.number('DEK_MAX_USES').pipe(
    Config.nested('SYNC'),
    Config.orElse(() => Config.succeed(100)),
  ),

  // Salt Configuration
  dekSalt: Config.string('DEK_SALT').pipe(
    Config.nested('SYNC'),
    Config.orElse(() => Config.succeed('@xstack/dek-generation')),
  ),

  dekCacheSalt: Config.string('DEK_CACHE_SALT').pipe(
    Config.nested('SYNC'),
    Config.orElse(() => Config.succeed('@xstack/dek-cache')),
  ),

  masterKeySalt: Config.string('MASTER_KEY_SALT').pipe(
    Config.nested('SYNC'),
    Config.orElse(() => Config.succeed('@xstack/master-key')),
  ),

  masterKeyPrivateKeyDerivationPath: Config.array(Config.string(), 'MASTER_KEY_PRIVATE_KEY_DERIVATION_PATH').pipe(
    Config.nested('SYNC'),
    Config.orElse(() => Config.succeed(['Identity'])),
  ),

  ecdhSalt: Config.string('ECDH_SALT').pipe(
    Config.nested('SYNC'),
    Config.orElse(() => Config.succeed('@xstack/ecdh-encryption')),
  ),
})
export type EventLogConfig = Config.Config.Success<typeof EventLogConfig>

export const SocketCloseCodes = {
  NORMAL: 3000,

  MISSING_FIELDS: 3500,
  UNKNOWN_ERROR: 3501,

  UNAUTHORIZED: 3510,

  MAX_VAULTS_REACHED: 3520,
  VAULT_REGISTRATION_FAILED: 3521,

  MAX_DEVICES_REACHED: 3530,
  DEVICE_REGISTRATION_FAILED: 3531,

  STORAGE_QUOTA_EXCEEDED: 3540,
  STORAGE_CHECK_FAILED: 3541,

  TOO_MANY_REQUESTS: 3550,
} as const

export type SocketCloseCode = (typeof SocketCloseCodes)[keyof typeof SocketCloseCodes]

export const closeCodeToReason = (code: SocketCloseCode | number): string => {
  switch (code) {
    case -1:
    case 1001:
    case 1005:
    case SocketCloseCodes.NORMAL:
      return 'Closed'
    case SocketCloseCodes.MISSING_FIELDS:
      return 'Missing required fields'
    case SocketCloseCodes.UNKNOWN_ERROR:
      return 'Unknown error'
    case SocketCloseCodes.UNAUTHORIZED:
      return 'Unauthorized'
    case SocketCloseCodes.MAX_VAULTS_REACHED:
      return 'Maximum vault limit reached'
    case SocketCloseCodes.VAULT_REGISTRATION_FAILED:
      return 'Vault registration failed'
    case SocketCloseCodes.MAX_DEVICES_REACHED:
      return 'Maximum device limit reached'
    case SocketCloseCodes.DEVICE_REGISTRATION_FAILED:
      return 'Device registration failed'
    case SocketCloseCodes.STORAGE_QUOTA_EXCEEDED:
      return 'Storage quota exceeded'
    case SocketCloseCodes.STORAGE_CHECK_FAILED:
      return 'Storage check failed'
    default:
      return 'Unknown error'
  }
}

/**
 *这些错误表示 socket 被正常关闭不会报错误，不会继续重试连接。
 */
export const isErrorCode: number[] = [
  1005, // 客户端手动正常关闭
  ...Object.values(SocketCloseCodes),
]
