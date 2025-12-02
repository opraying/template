import { SubscriptionInfo } from '@xstack/app-kit/schema'
import * as ServerConfig from '@xstack/server/config'
import { AccountId, Email, UserId } from '@xstack/user-kit/schema'
import * as Config from 'effect/Config'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import * as Schema from 'effect/Schema'

export class Account extends Schema.Class<Account>('Account')({
  id: AccountId,
  locale: Schema.String,
  subscription: Schema.optional(SubscriptionInfo),
}) {}

export class UserWithSensitive extends Schema.Class<UserWithSensitive>('@userkit:user-with-sensitive')({
  id: UserId,
  email: Email,
  emailVerified: Schema.Boolean,
  account: Account,
  avatar: Schema.String,
  username: Schema.String,
}) {
  static toWeb(user: typeof UserWithSensitive.Type) {
    return pipe(
      Config.all({
        bucketDomain: ServerConfig.BUCKET_DOMAIN,
      }),
      Effect.orDie,
      Effect.map(({ bucketDomain }) => {
        return {
          id: user.id,
          email: user.email,
          emailVerified: user.emailVerified,
          account: user.account,
          avatar: `https://${bucketDomain}/${user.avatar}`,
          username: user.username,
        } satisfies typeof UserWithSensitive.Type
      }),
    )
  }
}

export const ContactFormSchema = Schema.Struct({
  name: Schema.String.pipe(Schema.compose(Schema.Trim), Schema.nonEmptyString(), Schema.maxLength(50)),
  email: Schema.String.pipe(
    Schema.nonEmptyString(),
    Schema.maxLength(100),
    Schema.pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/),
  ),
  message: Schema.String.pipe(Schema.nonEmptyString(), Schema.maxLength(1000)),
})
export type ContactFormSchema = typeof ContactFormSchema.Type
