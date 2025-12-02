/**
 * EventLogEncryption module provides encryption capabilities for event logs.
 * It handles secure storage and transmission of events using AES-GCM encryption.
 */
import * as Crypto from '@xstack/event-log/Crypto'
import { DecryptDEKError, DecryptionError, type EncryptedDEKError, EncryptionError } from '@xstack/event-log/Error'
import * as EventJournal from '@xstack/event-log/EventJournal'
import * as EventLogConfig from '@xstack/event-log/EventLogConfig'
import * as Metrics from '@xstack/event-log/Metrics'
import * as Utils from '@xstack/event-log/Utils'
import * as Context from 'effect/Context'
import * as DateTime from 'effect/DateTime'
import * as Duration from 'effect/Duration'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import type { ParseError } from 'effect/ParseResult'
import * as Redacted from 'effect/Redacted'
import * as Schema from 'effect/Schema'

/**
 * Schema for an encrypted event entry
 * @since 1.0.0
 * @category models
 */
export const EncryptedEntry = Schema.Struct({
  entryId: EventJournal.EntryId,
  encryptedEntry: Schema.Uint8ArrayFromSelf,
})

/**
 * Schema for an encrypted remote event entry
 * Includes sequence number and initialization vector for decryption
 * @since 1.0.0
 * @category models
 */
export interface EncryptedRemoteEntry extends Schema.Schema.Type<typeof EncryptedRemoteEntry> {}
export const EncryptedRemoteEntry = Schema.Struct({
  sequence: Schema.Number,
  iv: Schema.Uint8ArrayFromSelf,
  entryId: EventJournal.EntryId,
  encryptedEntry: Schema.Uint8ArrayFromSelf,
  encryptedDEK: Schema.Uint8ArrayFromSelf,
})

/**
 * 密钥类型定义
 */
export interface EncryptedPrivateKey {
  keyId: string
  encryptedKey: string
  createdAt: number
}

export interface EncryptedData {
  data: Uint8Array<ArrayBufferLike>[]
  iv: Uint8Array<ArrayBufferLike>
}

/**
 * EventLogEncryption service provides methods for encrypting and decrypting event logs.
 * It uses AES-GCM for encryption and SHA-256 for hashing.
 * @since 1.0.0
 * @category encryption
 */
export class EventLogEncryption extends Context.Tag('@xstack/event-log/EventLogEncryption')<
  EventLogEncryption,
  {
    /**
     * Encrypt a batch of entries using the provided identity's private key
     */
    readonly encrypt: (
      identity: { publicKey: Effect.Effect<string> },
      entries: ReadonlyArray<EventJournal.Entry>,
    ) => Effect.Effect<
      {
        readonly iv: Uint8Array<ArrayBufferLike>
        readonly encryptedEntries: ReadonlyArray<Uint8Array<ArrayBufferLike>>
        readonly encryptedDEK: Crypto.EncryptedDEK
      },
      EncryptionError | EncryptedDEKError | ParseError
    >

    /**
     * Decrypt a batch of encrypted remote entries using the provided identity's private key
     */
    readonly decrypt: (
      identity: { privateKey: Effect.Effect<Redacted.Redacted<Uint8Array>> },
      entries: ReadonlyArray<EncryptedRemoteEntry>,
    ) => Effect.Effect<ReadonlyArray<EventJournal.RemoteEntry>, DecryptionError | DecryptDEKError | ParseError>
  }
>() {}

export const make: Effect.Effect<typeof EventLogEncryption.Service, never, Crypto.Crypto> = Effect.gen(function* () {
  const crypto = yield* Crypto.Crypto
  const config = yield* EventLogConfig.EventLogConfig.pipe(Effect.orDie)
  const cryptoParams = EventLogConfig.CRYPTO_PARAMS

  /**
   * DEK (Data Encryption Key) management structure
   * Used to track current active DEK and its usage status
   */
  const activeDEK = {
    dek: null as Crypto.EncryptionDEK | null,
    encryptionKey: null as CryptoKey | null,
    createdAt: DateTime.unsafeNow(),
    useCount: 0,
    timeSlot: 0,
  }

  /**
   * 计算当前时间槽
   * 使用 Effect DateTime 来确保时间的准确性
   * 时间槽用于确定性地生成 DEK，确保同一时间段内生成相同的 DEK
   */
  const getCurrentTimeSlot = pipe(
    DateTime.now,
    Effect.map((_) => Math.floor(_.epochMillis / Duration.toMillis(config.dekTtl))),
  )

  /**
   * DEK缓存结构
   * key: encryptedDEK的hash
   * value: 解密后的DEK和预初始化的CryptoKey
   */
  const cache: Map<
    string,
    {
      dek: Crypto.EncryptionDEK
      decryptionKey: CryptoKey
      lastUsed: number
      useCount: number
    }
  > = new Map()

  const CACHE_TTL = 1000 * 60 * 30
  const _cleanupCache = () => {
    const now = Date.now()
    for (const [key, value] of cache.entries()) {
      if (now - value.lastUsed > CACHE_TTL) {
        cache.delete(key)
      }
    }
  }
  // [FIXME]
  // setInterval(cleanupCache, CACHE_TTL)

  /**
   * Calculate DEK cache ID
   */
  const getDEKCacheId = Effect.fnUntraced(function* (encryptedDEK: Crypto.EncryptedDEK) {
    const hash = yield* crypto.hmacSha256(config.dekCacheSalt, encryptedDEK)
    return Utils.arrayBufferToBase64(hash)
  })

  /**
   * 获取或创建DEK缓存
   */
  const getOrCreateDEKCache = Effect.fnUntraced(function* (
    encryptedDEK: Crypto.EncryptedDEK,
    privateKey: Uint8Array<ArrayBufferLike>,
  ) {
    const cacheId = yield* getDEKCacheId(encryptedDEK)
    const cached = cache.get(cacheId)

    if (cached) {
      cached.lastUsed = Date.now()
      cached.useCount++
      return cached
    }

    // Use the Crypto service to decrypt the DEK
    const result = yield* crypto.decryptDEK(encryptedDEK, privateKey)
    const dek = Crypto.EncryptionDEK.make(result.dek)
    const decryptionKey = result.decryptionKey

    const cacheEntry = {
      dek,
      decryptionKey,
      lastUsed: Date.now(),
      useCount: 1,
    }
    cache.set(cacheId, cacheEntry)

    return cacheEntry
  })

  /**
   * 获取或创建活跃的 DEK
   * 实现了 DEK 的生命周期管理，包括：
   * 1. 基于时间槽的 DEK 轮换
   * 2. 使用次数限制
   * 3. 详细的日志记录
   */
  const getOrCreateActiveDEK = Effect.gen(function* (_) {
    const currentTimeSlot = yield* getCurrentTimeSlot
    const now = yield* DateTime.now

    // Check if DEK rotation is required.
    const needsRotation =
      !activeDEK.dek || currentTimeSlot !== activeDEK.timeSlot || activeDEK.useCount >= config.dekMaxUses

    if (needsRotation) {
      // Use the Crypto service to generate the DEK
      const { dek, encryptionKey } = yield* crypto.generateDEK(currentTimeSlot)
      activeDEK.dek = Crypto.EncryptionDEK.make(dek)
      activeDEK.encryptionKey = encryptionKey
      activeDEK.createdAt = now
      activeDEK.useCount = 0
      activeDEK.timeSlot = currentTimeSlot
      yield* Effect.annotateCurrentSpan({
        timeSlot: currentTimeSlot,
        rotationReason: !activeDEK.dek
          ? 'initial'
          : currentTimeSlot !== activeDEK.timeSlot
            ? 'time_slot_change'
            : 'max_uses_exceeded',
      })
    } else {
      yield* Effect.annotateCurrentSpan({
        timeSlot: currentTimeSlot,
        useCount: activeDEK.useCount,
        createdAt: DateTime.format(activeDEK.createdAt, {
          dateStyle: 'short',
          timeStyle: 'short',
        }),
        remainingUses: config.dekMaxUses - activeDEK.useCount,
      })
    }
    activeDEK.useCount++
    return {
      dek: activeDEK.dek!,

      encryptionKey: activeDEK.encryptionKey!,
    }
  }).pipe(Effect.withSpan('EventLogEncryption.getOrCreateActiveDEK'))

  /**
   * Generate empty encrypted DEK for handling empty entry lists
   */
  const EmptyDEK = Crypto.EncryptedDEK.make(
    new Uint8Array([
      ...Array.from<number>({ length: cryptoParams.PUBLIC_KEY_LENGTH }).fill(0),
      ...Array.from<number>({ length: cryptoParams.IV_LENGTH }).fill(0),
      ...Array.from<number>({ length: cryptoParams.TAG_LENGTH / 8 }).fill(0),
    ]),
  )

  /**
   * 加密事件条目
   */
  const encrypt = (identity: { publicKey: Effect.Effect<string> }, entries: ReadonlyArray<EventJournal.Entry>) =>
    pipe(
      Effect.gen(function* (_) {
        if (entries.length === 0) {
          return {
            iv: new Uint8Array(),
            encryptedEntries: [],
            encryptedDEK: EmptyDEK,
          }
        }

        const { dek, encryptionKey } = yield* getOrCreateActiveDEK

        const publicKeyStr = yield* identity.publicKey
        const publicKey = Utils.base64ToArrayBuffer(publicKeyStr)
        const encryptedDEK = yield* crypto.encryptDEK(dek, new Uint8Array(publicKey))

        const iv = yield* crypto.randomBytes(cryptoParams.IV_LENGTH)

        const encodedEntries = yield* EventJournal.Entry.encodeArray(entries)
        const encryptedEntries = yield* Effect.forEach(encodedEntries, (entry) =>
          crypto.aesGcmEncrypt(encryptionKey, iv, entry),
        )
        return {
          iv,
          encryptedEntries,
          encryptedDEK,
        }
      }),
      Effect.timed,
      Effect.tap(([duration]) =>
        Effect.all([Metrics.encryptionLatency(Effect.succeed(Duration.toMillis(duration)))], {
          concurrency: 'unbounded',
          discard: true,
        }),
      ),
      Effect.map(([_, result]) => result),
      Effect.ensuring(Metrics.encryptionCount(Effect.succeed(1))),
      Effect.catchAllDefect((error) => new EncryptionError({ message: 'Failed to encrypt entries', cause: error })),
      Effect.annotateSpans({
        'encryption.operation': 'encode_entries',
        'entries.count': entries.length.toString(),
      }),
      Effect.withSpan('EventLogEncryption.encrypt'),
    )

  /**
   * 批量解密事件条目
   */
  const decrypt = (
    identity: { privateKey: Effect.Effect<Redacted.Redacted<Uint8Array>> },
    entries: ReadonlyArray<EncryptedRemoteEntry>,
  ) =>
    pipe(
      Effect.gen(function* (_) {
        if (entries.length === 0) {
          return [] as Array<EventJournal.RemoteEntry>
        }

        const privateKey = yield* Effect.map(identity.privateKey, Redacted.value)
        const decryptedEntries = yield* Effect.forEach(entries, (entry) =>
          Effect.gen(function* () {
            const { decryptionKey } = yield* getOrCreateDEKCache(
              Crypto.EncryptedDEK.make(entry.encryptedDEK),
              privateKey,
            )
            const decrypted = yield* crypto.aesGcmDecrypt(decryptionKey, entry.iv, entry.encryptedEntry)
            return decrypted
          }),
        ).pipe(
          Effect.catchAllDefect(
            (cause) =>
              new DecryptDEKError({
                message: 'Failed to decrypt DEK',
                cause,
              }),
          ),
        )

        return yield* EventJournal.Entry.decodeArray(decryptedEntries).pipe(
          Effect.map((entry) =>
            entry.map((entry, i) => new EventJournal.RemoteEntry({ remoteSequence: entries[i].sequence, entry })),
          ),
        )
      }),
      Effect.timed,
      Effect.tap(([duration]) =>
        Effect.all([Metrics.decryptionLatency(Effect.succeed(Duration.toMillis(duration)))], {
          concurrency: 'unbounded',
          discard: true,
        }),
      ),
      Effect.map(([_, result]) => result),
      Effect.ensuring(Metrics.decryptionCount(Effect.succeed(1))),
      Effect.catchAllDefect((error) => new DecryptionError({ message: 'Failed to decrypt entries', cause: error })),
      Effect.annotateSpans({
        'encryption.operation': 'decrypt_entries',
        'entries.count': entries.length.toString(),
      }),
      Effect.withSpan('EventLogEncryption.decrypt'),
    )

  return EventLogEncryption.of({
    encrypt,
    decrypt,
  })
})

/**
 * Layer that provides EventLogEncryption using the Web Crypto API
 * @since 1.0.0
 * @category encryption
 */
export const layerSubtle: Layer.Layer<EventLogEncryption, never, Crypto.Crypto> = Layer.effect(EventLogEncryption, make)
