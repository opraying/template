import * as Redacted from 'effect/Redacted'
import * as Schema from 'effect/Schema'
import * as String from 'effect/String'

export const OAuthProviderLiteral = Schema.Literal('Github', 'Google')
export type OAuthProviderLiteral = typeof OAuthProviderLiteral.Type

export const ProviderID = Schema.Literal(...OAuthProviderLiteral.literals)
export type ProviderID = typeof ProviderID.Type

export const OAuthProviderLower = Schema.Literal(...OAuthProviderLiteral.literals.map(String.uncapitalize)).pipe(
  Schema.transform(OAuthProviderLiteral, {
    decode(a) {
      return String.capitalize(a)
    },
    encode(a) {
      return String.uncapitalize(a)
    },
  }),
)

export const UserId = Schema.String.pipe(
  Schema.brand('UserId'),
  Schema.annotations({
    description: 'User ID',
  }),
)
export type UserId = typeof UserId.Type

export const AccountId = Schema.String.pipe(
  Schema.brand('AccountId'),
  Schema.annotations({
    description: 'Account ID',
  }),
)
export type AccountId = typeof AccountId.Type

export const SessionId = Schema.String.pipe(
  Schema.brand('SessionId'),
  Schema.annotations({
    description: 'Session ID',
  }),
)
export type SessionId = typeof SessionId.Type

export const AuthConfigSchema = Schema.Struct({
  providers: Schema.Array(OAuthProviderLiteral),
  redirects: Schema.Struct({
    login: Schema.String,
    signOut: Schema.String,
    unauthorized: Schema.String,
  }),
})

export declare namespace Auth {
  export type AuthConfigSchema = typeof AuthConfigSchema.Type

  export type LoginForm = typeof LoginSchema.Type
  export type LoginFormSchema = typeof LoginSchema.Encoded

  export type EmailVerificationCode = typeof EmailVerificationCodeSchema.Type
  export type EmailVerificationCodeSchema = typeof EmailVerificationCodeSchema.Encoded

  export type EmailVerificationToken = typeof EmailVerificationTokenSchema.Type
  export type EmailVerificationTokenSchema = typeof EmailVerificationTokenSchema.Encoded

  export type Token = typeof Token.Type
  export type AccessToken = typeof AccessToken.Type
}

export const TokenString = Schema.NonEmptyTrimmedString.pipe(Schema.brand('Token'))
export const Token = Schema.Redacted(TokenString)
export const tokenFromString = (token: string): Auth.Token => Redacted.make(TokenString.make(token))
export const tokenFromRedacted = (token: Redacted.Redacted): Auth.Token => token as Auth.Token

export const AccessTokenString = Schema.String.pipe(Schema.brand('AccessToken'))
export const AccessToken = Schema.Redacted(AccessTokenString)
export const accessTokenFromString = (token: string): Auth.AccessToken => Redacted.make(AccessTokenString.make(token))
export const accessTokenFromRedacted = (token: Redacted.Redacted): Auth.AccessToken => token as Auth.AccessToken

export const Email = Schema.String.pipe(Schema.brand('Email'))
export type Email = typeof Email.Type
export const EmailFromString = Schema.String.pipe(
  Schema.pattern(/^(?!\.)(?!.*\.\.)([A-Z0-9_+-.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9-]*\.)+[A-Z]{2,}$/i, {
    message: () => 'invalid email',
  }),
  Schema.brand('Email'),
)

export class SessionUser extends Schema.Class<SessionUser>('@userkit:session-user')({
  id: UserId,
  email: Email,
  emailVerified: Schema.Boolean,
  username: Schema.String,
  avatar: Schema.String,
}) {}

// ----- Form -----

// export const UpdateUserSchema = UsersTable.jsonUpdate

export const LoginSchema = Schema.Struct({
  email: EmailFromString,
})

export type EmailVerificationAction = 'login' | ('create-user' & (string & {}))

export const EmailVerificationCodeSchema = Schema.Struct({
  code: Schema.String,
})

export const EmailVerificationTokenSchema = Schema.Struct({
  token: Token,
})

// ----- Errors -----

export class UserNotFound extends Schema.TaggedError<UserNotFound>()('@userkit:user-not-found', {
  id: Schema.optional(UserId),
}) {}

export class ProviderNotFound extends Schema.TaggedError<ProviderNotFound>()('@userkit:provider-not-found', {}) {}

export class ProviderValidationFailed extends Schema.TaggedError<ProviderValidationFailed>()(
  '@userkit:provider-validation-failed',
  {
    providerId: ProviderID,
    message: Schema.String,
  },
) {}
