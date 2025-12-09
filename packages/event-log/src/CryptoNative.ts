import { Buffer } from '@craftzdog/react-native-buffer'
import * as secp256k1 from '@noble/secp256k1'
import { Crypto, EncryptedDEK } from '@xstack/event-log/Crypto'
import * as EventLogConfig from '@xstack/event-log/EventLogConfig'
import * as utils from '@xstack/event-log/Utils'
import type * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'
import * as ExpoCrypto from 'expo-crypto'
import QuickCrypto from 'react-native-quick-crypto'

// Key object type used by react-native-quick-crypto (conceptual)
// Usually a Buffer or a specific KeyObject
type QuickCryptoKey = Buffer

export const CryptoLive = Layer.effect(
  Crypto,
  Effect.gen(function* () {
    const textEncoder = new TextEncoder()
    const config = yield* EventLogConfig.EventLogConfig.pipe(Effect.orDie)
    const cryptoParams = EventLogConfig.CRYPTO_PARAMS

    const randomBytes = (length: number) => Effect.promise(() => ExpoCrypto.getRandomBytesAsync(length))

    const sha256_ = Effect.fnUntraced(function* (data: Uint8Array<ArrayBufferLike> | string) {
      const input = typeof data === 'string' ? textEncoder.encode(data) : data
      const hash = yield* Effect.promise(() =>
        ExpoCrypto.digest(ExpoCrypto.CryptoDigestAlgorithm.SHA256, input.slice()),
      )
      return new Uint8Array(hash)
    }, Effect.orDie)

    const sha256String = Effect.fnUntraced(function* (data: Uint8Array<ArrayBufferLike> | string) {
      const input = typeof data === 'string' ? textEncoder.encode(data) : data
      const hash = yield* Effect.promise(() =>
        ExpoCrypto.digest(ExpoCrypto.CryptoDigestAlgorithm.SHA256, input.slice()),
      )
      return utils.arrayBufferToBase64(hash)
    }, Effect.orDie)

    const hmacSha256 = Effect.fnUntraced(function* (
      key: Uint8Array<ArrayBufferLike> | string,
      message: Uint8Array<ArrayBufferLike> | string,
    ) {
      const keyBuffer = typeof key === 'string' ? Buffer.from(key, 'utf8') : Buffer.from(key)
      const messageBuffer = typeof message === 'string' ? Buffer.from(message, 'utf8') : Buffer.from(message)

      const hmac = QuickCrypto.createHmac('sha256', keyBuffer)
      hmac.update(messageBuffer)
      const result = hmac.digest()

      return new Uint8Array(result)
    }, Effect.orDie)

    const hmacSha512 = Effect.fnUntraced(function* (
      key: Uint8Array<ArrayBufferLike> | string,
      message: Uint8Array<ArrayBufferLike> | string,
    ) {
      const keyBuffer = typeof key === 'string' ? Buffer.from(key, 'utf8') : Buffer.from(key)
      const messageBuffer = typeof message === 'string' ? Buffer.from(message, 'utf8') : Buffer.from(message)

      const hmac = QuickCrypto.createHmac('sha512', keyBuffer)
      hmac.update(messageBuffer)
      const result = hmac.digest()

      return new Uint8Array(result)
    }, Effect.orDie)

    const generateDEK = (timeSlot: number) =>
      Effect.sync(() => {
        const timeSlotBytes = new Uint8Array(8)
        new DataView(timeSlotBytes.buffer).setBigInt64(0, BigInt(timeSlot), true)
        const salt = Buffer.from(config.dekSalt, 'utf8')

        const hmac = QuickCrypto.createHmac('sha256', salt)
        hmac.update(Buffer.from(timeSlotBytes))
        const seed = hmac.digest()

        // react-native-quick-crypto doesn't have direct import/export like subtle.
        // We use the derived seed directly as the key material (Buffer).
        // AES-GCM requires a 32-byte (256-bit) key. The sha256 HMAC gives 32 bytes.

        return {
          dek: new Uint8Array(seed),
          encryptionKey: seed as unknown as CryptoKey,
        }
      })

    const encryptDEK = Effect.fn(function* (dek: Uint8Array<ArrayBufferLike>, publicKey: Uint8Array<ArrayBufferLike>) {
      const ephemeralPrivateKey = secp256k1.utils.randomSecretKey()
      const ephemeralPublicKey = secp256k1.getPublicKey(ephemeralPrivateKey, true)

      const sharedSecret = secp256k1.getSharedSecret(ephemeralPrivateKey, publicKey)

      const salt = Buffer.from(config.ecdhSalt, 'utf8')
      const hmac = QuickCrypto.createHmac('sha256', salt)
      hmac.update(Buffer.from(sharedSecret))
      const encryptionKey = hmac.digest()

      const iv = yield* randomBytes(cryptoParams.IV_LENGTH)

      const cipher = QuickCrypto.createCipheriv('aes-256-gcm', Buffer.from(encryptionKey), iv)
      const encryptedPart1 = cipher.update(Buffer.from(dek))
      const encryptedPart2 = cipher.final()
      const tag = cipher.getAuthTag()

      // Combine ephemeralPublicKey, IV, encrypted data, and tag
      const result = Buffer.concat([
        Buffer.from(ephemeralPublicKey),
        iv,
        encryptedPart1,
        encryptedPart2,
        tag, // Append the auth tag
      ])

      return EncryptedDEK.make(new Uint8Array(result))
    }, Effect.orDie)

    const decryptDEK = (encryptedDEK: Uint8Array<ArrayBufferLike>, privateKey: Uint8Array<ArrayBufferLike>) =>
      Effect.sync(() => {
        const ephemeralPublicKey = encryptedDEK.slice(0, cryptoParams.PUBLIC_KEY_LENGTH)
        const iv = encryptedDEK.slice(
          cryptoParams.PUBLIC_KEY_LENGTH,
          cryptoParams.PUBLIC_KEY_LENGTH + cryptoParams.IV_LENGTH,
        )
        // The tag is the *last* 16 bytes
        const tag = encryptedDEK.slice(-cryptoParams.TAG_LENGTH / 8)
        // The encrypted part is between IV and tag
        const encrypted = encryptedDEK.slice(
          cryptoParams.PUBLIC_KEY_LENGTH + cryptoParams.IV_LENGTH,
          -cryptoParams.TAG_LENGTH / 8,
        )

        const sharedSecret = secp256k1.getSharedSecret(
          privateKey,
          new Uint8Array(ephemeralPublicKey), // Ensure Uint8Array for noble
        )
        const salt = Buffer.from(config.ecdhSalt, 'utf8')
        const hmac = QuickCrypto.createHmac('sha256', salt)
        hmac.update(Buffer.from(sharedSecret))
        const encryptionKey = hmac.digest()

        const decipher = QuickCrypto.createDecipheriv('aes-256-gcm', encryptionKey, iv)
        decipher.setAuthTag(Buffer.from(tag)) // Set the authentication tag

        const decryptedPart1 = decipher.update(encrypted)
        const decryptedPart2 = decipher.final() // Throws error if tag verification fails
        const dek = Buffer.concat([decryptedPart1, decryptedPart2])

        // The 'decryptionKey' in this context is the DEK itself for subsequent AES ops
        return {
          dek: new Uint8Array(dek),
          decryptionKey: dek as unknown as CryptoKey, // Use the derived DEK (as Buffer) for the next step
        }
      })

    const aesGcmEncrypt = (key: CryptoKey, iv: Uint8Array<ArrayBufferLike>, plaintext: Uint8Array<ArrayBufferLike>) =>
      Effect.sync(() => {
        const ivBuffer = Buffer.from(iv)
        const cipher = QuickCrypto.createCipheriv('aes-256-gcm', key as unknown as QuickCryptoKey, ivBuffer)
        const encryptedPart1 = cipher.update(Buffer.from(plaintext))
        const encryptedPart2 = cipher.final()
        const tag = cipher.getAuthTag()

        const result = Buffer.concat([encryptedPart1, encryptedPart2, tag])
        return new Uint8Array(result)
      })

    const aesGcmDecrypt = (key: CryptoKey, iv: Uint8Array<ArrayBufferLike>, ciphertext: Uint8Array<ArrayBufferLike>) =>
      Effect.sync(() => {
        const ciphertextBuffer = Buffer.from(ciphertext)
        const ivBuffer = Buffer.from(iv)

        // Extract tag from the end of the ciphertext
        const tag = ciphertextBuffer.slice(-cryptoParams.TAG_LENGTH / 8)
        const encrypted = ciphertextBuffer.slice(0, -cryptoParams.TAG_LENGTH / 8)

        const decipher = QuickCrypto.createDecipheriv('aes-256-gcm', key as unknown as QuickCryptoKey, ivBuffer)
        decipher.setAuthTag(tag)

        const decryptedPart1 = decipher.update(encrypted)
        const decryptedPart2 = decipher.final() // Throws on tag mismatch

        const result = Buffer.concat([decryptedPart1, decryptedPart2])
        return new Uint8Array(result)
      })

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
