import * as Database from '@xstack/db'
import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import * as ParseResult from 'effect/ParseResult'
import * as Schema from 'effect/Schema'

export const Tier = Schema.Struct({
  maxDevices: Schema.Number,
  maxStorageBytes: Schema.Number,
  maxVaults: Schema.Number,
})
export interface Tier extends Schema.Schema.Type<typeof Tier> {}

export class UserSession extends Schema.Class<UserSession>('UserSession')({
  token: Schema.Redacted(Schema.String),
  id: Schema.String,
  email: Schema.String.pipe(Schema.brand('Email'), Schema.brand('CustomerEmail')),
  username: Schema.String,
  tier: Tier,
}) {}

export const CurrentAuthSession = Context.GenericTag<UserSession>('@local-first:current-auth-session')

export const DurableObjectId = Schema.transformOrFail(
  Schema.String,
  Schema.String.pipe(Schema.brand('DurableObjectId')),
  {
    decode(fa) {
      const [namespace, userId, publicKey] = fa.split('::')
      if (!namespace || !userId || !publicKey) {
        return Effect.fail(new ParseResult.Unexpected(fa, 'Invalid durable object id'))
      }
      return Effect.succeed(fa)
    },
    encode(ti) {
      return Effect.succeed(ti)
    },
  },
)

/**
 * Vault
 */
export class Vault extends Database.Class<Vault>('@db/vault')(
  {
    id: Database.uuidV7Insert,
    userId: Schema.String.annotations({
      index: true,
      description: 'user device id (namespace::userId)',
    }),
    publicKey: Schema.NonEmptyString.pipe(
      Database.ColumnConfig({
        description: 'device public key, used to limit device count',
      }),
    ),
    createdAt: Database.DateTimeInsert,
    updatedAt: Database.DateTimeUpdate,
  },
  {
    ...Database.ModelConfig({
      namespace: 'Vault',
      author: 'Ray',
      description: 'user vault',
    }),
  },
) {
  static table = 'vault'
}
export declare namespace Vault {
  export type Encoded = typeof Vault.Encoded
  export type Type = typeof Vault.Type
}
