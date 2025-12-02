import * as Context from 'effect/Context'
import type * as Effect from 'effect/Effect'
import * as Schema from 'effect/Schema'

export const EncryptionDEK = Schema.Uint8ArrayFromSelf.pipe(Schema.brand('EncryptionDEK'))
export type EncryptionDEK = typeof EncryptionDEK.Type

export const EncryptedDEK = Schema.Uint8ArrayFromSelf.pipe(Schema.brand('EncryptedDEK'))
export type EncryptedDEK = typeof EncryptedDEK.Type

export class Crypto extends Context.Tag('@xstack/event-log/Crypto')<
  Crypto,
  {
    readonly randomBytes: (length: number) => Effect.Effect<Uint8Array<ArrayBufferLike>, never>

    readonly sha256: (data: Uint8Array<ArrayBufferLike> | string) => Effect.Effect<Uint8Array<ArrayBufferLike>, never>
    readonly sha256String: (data: Uint8Array<ArrayBufferLike> | string) => Effect.Effect<string, never>

    readonly hmacSha256: (
      key: Uint8Array<ArrayBufferLike> | string,
      message: Uint8Array<ArrayBufferLike> | string,
    ) => Effect.Effect<Uint8Array<ArrayBufferLike>, never>
    readonly hmacSha512: (
      key: Uint8Array<ArrayBufferLike> | string,
      message: Uint8Array<ArrayBufferLike> | string,
    ) => Effect.Effect<Uint8Array<ArrayBufferLike>, never>

    readonly generateDEK: (timeSlot: number) => Effect.Effect<
      {
        dek: Uint8Array<ArrayBufferLike>
        encryptionKey: CryptoKey
      },
      never
    >
    readonly encryptDEK: (
      dek: Uint8Array<ArrayBufferLike>,
      publicKey: Uint8Array<ArrayBufferLike>,
    ) => Effect.Effect<EncryptedDEK, never>
    readonly decryptDEK: (
      encryptedDEK: EncryptedDEK,
      privateKey: Uint8Array<ArrayBufferLike>,
    ) => Effect.Effect<
      {
        dek: Uint8Array<ArrayBufferLike>
        decryptionKey: CryptoKey
      },
      never
    >

    readonly aesGcmEncrypt: (
      key: CryptoKey,
      iv: Uint8Array<ArrayBufferLike>,
      plaintext: Uint8Array<ArrayBufferLike>,
    ) => Effect.Effect<Uint8Array<ArrayBufferLike>, never>
    readonly aesGcmDecrypt: (
      key: CryptoKey,
      iv: Uint8Array<ArrayBufferLike>,
      ciphertext: Uint8Array<ArrayBufferLike>,
    ) => Effect.Effect<Uint8Array<ArrayBufferLike>, never>
  }
>() {}
