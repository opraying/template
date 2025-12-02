import type { InvalidMnemonicError } from '@xstack/event-log/Error'
import type { RemotePublicKeySyncStats, StoragePublicKeyItem } from '@xstack/event-log/Schema'
import type { Mnemonic } from '@xstack/event-log/Types'
import type * as Brand from 'effect/Brand'
import * as Context from 'effect/Context'
import type * as Effect from 'effect/Effect'
import type * as Option from 'effect/Option'
import type * as Redacted from 'effect/Redacted'
import type * as Stream from 'effect/Stream'

export type StoragePublicKeyUpdateItem = Omit<Partial<StoragePublicKeyItem>, 'publicKey' | 'createdAt' | 'updatedAt'>

export interface Identity {
  /**
   * 获取助记词
   */
  mnemonic: Effect.Effect<Option.Option<Redacted.Redacted<Mnemonic>>, never, never>
  /**
   * 随机生成助记词
   */
  randomMnemonic: () => Effect.Effect<Redacted.Redacted<Mnemonic>, never, never>
  /**
   *  验证助记词是否正确格式
   */
  parseMnemonic: (mnemonic: Redacted.Redacted<Mnemonic | string>) => Effect.Effect<void, InvalidMnemonicError, never>
  /**
   * 从助记词导入
   */
  importFromMnemonic: (
    mnemonic: Redacted.Redacted<Mnemonic | string>,
    data?: { note: string } | undefined,
  ) => Effect.Effect<void, InvalidMnemonicError, never>
  /**
   * 生成助记词
   */
  createMnemonic: () => Effect.Effect<void, never, never>
  /**
   * 获取公钥 string & base64
   */
  publicKey: Effect.Effect<string & Brand.Brand<'PublicKey'>, never, never>
  /**
   * 获取私钥 Uint8Array
   */
  privateKey: Effect.Effect<Redacted.Redacted<Uint8Array<ArrayBufferLike> & Brand.Brand<'PrivateKey'>>, never, never>
  /**
   * 清除助记词/密钥数据
   */
  clear: Effect.Effect<void, never, never>

  /**
   * 获取公钥 hash string & base64
   */
  publicKeyStream: Stream.Stream<string, never, never>
  /**
   * 将本地的 public keys 同步到远端合并后更新到本地
   */
  syncPublicKeys: Effect.Effect<void, never, never>
  /**
   * 将 public key 信息同步到远端合并后更新到本地
   */
  syncPublicKey: (publicKey: string) => Effect.Effect<Option.Option<typeof RemotePublicKeySyncStats.Type>, never, never>
  /*
   * 删除使用过 public key 记录
   */
  deletePublicKey: (publicKey: string) => Effect.Effect<void>
  /**
   * 更新或者新增 public key 记录
   */
  upsertPublicKey: (publicKey: string, data: StoragePublicKeyUpdateItem) => Effect.Effect<void>
  /**
   * 更新远端 public key 记录
   */
  updatePublicKey: (publicKey: string, data: { note: string }) => Effect.Effect<void>
  /**
   * 获取全部的 public keys hash
   */
  allPublicKeysStream: Stream.Stream<ReadonlyArray<StoragePublicKeyItem>, never>
}

export const Identity = Context.GenericTag<Identity, Identity>('@xstack/event-log/Identity')
