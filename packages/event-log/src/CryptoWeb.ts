import { hmac } from '@noble/hashes/hmac.js'
import { sha256, sha512 } from '@noble/hashes/sha2.js'
import * as secp256k1 from '@noble/secp256k1'
import { Crypto, EncryptedDEK } from '@xstack/event-log/Crypto'
import * as EventLogConfig from '@xstack/event-log/EventLogConfig'
import * as Utils from '@xstack/event-log/Utils'
import type * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'

export const CryptoLive = Layer.effect(
  Crypto,
  Effect.gen(function* () {
    const textEncoder = new TextEncoder()
    const config = yield* EventLogConfig.EventLogConfig.pipe(Effect.orDie)
    const cryptoParams = EventLogConfig.CRYPTO_PARAMS

    const randomBytes = (length: number) =>
      Effect.succeed(new Uint8Array(crypto.getRandomValues(new Uint8Array(length))))

    const sha256_ = Effect.fn(function* (data: Uint8Array<ArrayBufferLike> | string) {
      const input = typeof data === 'string' ? textEncoder.encode(data) : data
      const result = yield* Effect.tryPromise({
        try: () => crypto.subtle.digest('SHA-256', input.slice()),
        catch: () => new Error('Failed to hash data'),
      })

      return new Uint8Array(result)
    }, Effect.orDie)

    const sha256String = Effect.fn(function* (data: Uint8Array<ArrayBufferLike> | string) {
      const input = typeof data === 'string' ? textEncoder.encode(data) : data
      const result = yield* Effect.tryPromise({
        try: () => crypto.subtle.digest('SHA-256', input.slice()),
        catch: () => new Error('Failed to hash data'),
      })

      return Utils.arrayBufferToBase64(result)
    }, Effect.orDie)

    const hmacSha256 = Effect.fn(function* (
      key: Uint8Array<ArrayBufferLike> | string,
      message: Uint8Array<ArrayBufferLike> | string,
    ) {
      const keyBytes = typeof key === 'string' ? textEncoder.encode(key) : key
      const messageBytes = typeof message === 'string' ? textEncoder.encode(message) : message
      return hmac(sha256, keyBytes, messageBytes)
    }, Effect.orDie)

    const hmacSha512 = Effect.fn(function* (
      key: Uint8Array<ArrayBufferLike> | string,
      message: Uint8Array<ArrayBufferLike> | string,
    ) {
      const keyBytes = typeof key === 'string' ? textEncoder.encode(key) : key
      const messageBytes = typeof message === 'string' ? textEncoder.encode(message) : message
      return hmac(sha512, keyBytes, messageBytes)
    }, Effect.orDie)

    const generateDEK = Effect.fn(function* (timeSlot: number) {
      const timeSlotBytes = new Uint8Array(8)
      new DataView(timeSlotBytes.buffer).setBigInt64(0, BigInt(timeSlot), true)
      const seed = yield* hmacSha256(config.dekSalt, timeSlotBytes)

      const key = yield* Effect.promise(() =>
        crypto.subtle.importKey('raw', seed.slice(), { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']),
      )
      const exportedKey = yield* Effect.promise(() => crypto.subtle.exportKey('raw', key))
      return {
        dek: new Uint8Array(exportedKey),
        encryptionKey: key,
      }
    }, Effect.orDie)

    const encryptDEK = Effect.fn(function* (dek: Uint8Array<ArrayBufferLike>, publicKey: Uint8Array<ArrayBufferLike>) {
      const ephemeralPrivateKey = secp256k1.utils.randomSecretKey()
      const ephemeralPublicKey = secp256k1.getPublicKey(ephemeralPrivateKey, true)

      const sharedSecret = secp256k1.getSharedSecret(ephemeralPrivateKey, publicKey)

      const encryptionKey = yield* hmacSha256(config.ecdhSalt, sharedSecret)

      const iv = crypto.getRandomValues(new Uint8Array(cryptoParams.IV_LENGTH))
      const key = yield* Effect.promise(() =>
        crypto.subtle.importKey('raw', encryptionKey.slice(), { name: 'AES-GCM', length: 256 }, false, ['encrypt']),
      )

      const encrypted = yield* Effect.promise(() => crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, dek.slice()))

      const result = new Uint8Array(cryptoParams.PUBLIC_KEY_LENGTH + iv.length + encrypted.byteLength)
      result.set(ephemeralPublicKey, 0)
      result.set(iv, cryptoParams.PUBLIC_KEY_LENGTH)
      result.set(new Uint8Array(encrypted), cryptoParams.PUBLIC_KEY_LENGTH + iv.length)

      return EncryptedDEK.make(result)
    }, Effect.orDie)

    const decryptDEK = Effect.fn(function* (
      encryptedDEK: Uint8Array<ArrayBufferLike>,
      privateKey: Uint8Array<ArrayBufferLike>,
    ) {
      const ephemeralPublicKey = encryptedDEK.slice(0, cryptoParams.PUBLIC_KEY_LENGTH)
      const iv = encryptedDEK.slice(
        cryptoParams.PUBLIC_KEY_LENGTH,
        cryptoParams.PUBLIC_KEY_LENGTH + cryptoParams.IV_LENGTH,
      )
      const encrypted = encryptedDEK.slice(cryptoParams.PUBLIC_KEY_LENGTH + cryptoParams.IV_LENGTH)

      const sharedSecret = secp256k1.getSharedSecret(privateKey, ephemeralPublicKey)
      const encryptionKeyBytes = yield* hmacSha256(config.ecdhSalt, sharedSecret)

      const key = yield* Effect.promise(() =>
        crypto.subtle.importKey('raw', encryptionKeyBytes.slice(), { name: 'AES-GCM', length: 256 }, false, [
          'decrypt',
        ]),
      )
      const dekBytes = yield* Effect.promise(() => crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, encrypted))
      const dek = new Uint8Array(dekBytes)

      const decryptionKey = yield* Effect.promise(() =>
        crypto.subtle.importKey('raw', dek, { name: 'AES-GCM', length: 256 }, false, ['decrypt']),
      )

      return { dek, decryptionKey }
    }, Effect.orDie)

    const aesGcmEncrypt = Effect.fn(function* (
      key: CryptoKey,
      iv: Uint8Array<ArrayBufferLike>,
      plaintext: Uint8Array<ArrayBufferLike>,
    ) {
      const encrypted = yield* Effect.promise(() =>
        crypto.subtle.encrypt(
          { name: 'AES-GCM', iv: iv.slice(), tagLength: cryptoParams.TAG_LENGTH },
          key,
          plaintext.slice(),
        ),
      )

      return new Uint8Array(encrypted)
    }, Effect.orDie)

    const aesGcmDecrypt = Effect.fn(function* (
      key: CryptoKey,
      iv: Uint8Array<ArrayBufferLike>,
      ciphertext: Uint8Array<ArrayBufferLike>,
    ) {
      const decrypted = yield* Effect.promise(() =>
        crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: iv.slice(), tagLength: cryptoParams.TAG_LENGTH },
          key,
          ciphertext.slice(),
        ),
      )
      return new Uint8Array(decrypted)
    }, Effect.orDie)

    return {
      randomBytes,
      sha256: sha256_,
      sha256String,
      hmacSha256,
      hmacSha512,
      generateDEK,
      encryptDEK,
      decryptDEK,
      aesGcmEncrypt,
      aesGcmDecrypt,
    } satisfies Context.Tag.Service<Crypto>
  }),
)
