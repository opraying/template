import * as Effect from 'effect/Effect'
import * as ParseResult from 'effect/ParseResult'
import * as Schema from 'effect/Schema'

export const WorkerQueryParams = Schema.transformOrFail(
  Schema.String.annotations({
    message: () => 'Invalid query string',
  }),
  Schema.Struct({
    namespace: Schema.String,
    publicKey: Schema.NonEmptyString.annotations({
      message: () => 'Public key is required',
    }),
    token: Schema.NonEmptyString.pipe(
      Schema.annotations({
        message: () => 'Token is required',
      }),
      Schema.Redacted,
    ),
  }),
  {
    decode(fa) {
      return Effect.try({
        try: () => {
          const [namespace, publicKey, token] = atob(fa).split(':')
          return {
            namespace,
            publicKey,
            token,
          }
        },
        catch: () => {
          return new ParseResult.Unexpected(fa, 'Invalid query string')
        },
      })
    },
    encode(ti) {
      return Effect.succeed(atob(`${ti.namespace}:${ti.publicKey}:${ti.token}`))
    },
  },
)

export const SyncRegisterUrlParams = Schema.transformOrFail(
  Schema.String.annotations({ message: () => 'q is required' }),
  Schema.Struct({
    namespace: Schema.String,
  }),
  {
    decode(fa) {
      return Effect.try({
        try: () => {
          const [namespace] = atob(fa).split(':')
          return {
            namespace,
          }
        },
        catch: () => {
          return new ParseResult.Unexpected(fa, 'Invalid query string')
        },
      })
    },
    encode(ti) {
      return Effect.succeed(atob(`${ti.namespace}`))
    },
  },
)

export const SyncPublicKeysUrlParams = Schema.transformOrFail(
  Schema.String.annotations({ message: () => 'q is required' }),
  Schema.Struct({
    namespace: Schema.String,
    publicKey: Schema.String,
  }),
  {
    decode(fa) {
      return Effect.try({
        try: () => {
          const [namespace, publicKey] = atob(fa).split(':')
          return {
            namespace,
            publicKey,
          }
        },
        catch: () => {
          return new ParseResult.Unexpected(fa, 'Invalid query string')
        },
      })
    },
    encode(ti) {
      return Effect.succeed(atob(`${ti.namespace}:${ti.publicKey}`))
    },
  },
)

export const SyncPublicKeyItem = Schema.Struct({
  /**
   * 备注
   */
  note: Schema.String,
  /**
   * 公钥 hash
   */
  publicKey: Schema.String,
  /**
   * 最后同步时间
   */
  lastSyncedAt: Schema.Date,
  /**
   * 同步次数
   */
  syncCount: Schema.Number,
  /**
   * 已使用空间
   */
  usedStorageSize: Schema.Number,
  /**
   * 最大空间
   */
  maxStorageSize: Schema.Number,
  /**
   * 创建时间
   */
  createdAt: Schema.Date,
  /**
   * 更新时间
   */
  updatedAt: Schema.Date,
})
export type SyncPublicKeyItem = typeof SyncPublicKeyItem.Type

export const SyncStats = Schema.Struct({
  /**
   * 同步次数
   */
  syncCount: Schema.Number,
  /**
   * 最后同步时间
   */
  lastSyncAt: Schema.Date,
  /**
   * 已使用空间
   */
  usedStorageSize: Schema.Number,
  /**
   * 最大空间
   */
  maxStorageSize: Schema.Number,
})
export type SyncStats = typeof SyncStats.Type

export type SyncServerInfo = SyncStats & {
  note: string
}
