import * as Database from '@xstack/db'
import { AccountId, Email, UserId } from '@xstack/user-kit/schema'
import * as Schema from 'effect/Schema'

export const TABLES = {
  user: 'user',
  account: 'account',
  sessions: 'session',
  emailVerificationCodes: 'email_verification_code',
} as const

export class User extends Database.Class<User>('@userkit:user-table')(
  {
    id: UserId.pipe(Database.id.uuidInsertSchema()),
    username: Schema.NonEmptyString.pipe(
      Database.ColumnConfig({
        description: "The user's username",
      }),
    ),
    email: Email.pipe(
      Database.ColumnConfig({
        description: "The user's email address",
        unique: true,
      }),
    ),
    emailVerified: Database.Boolean.pipe(
      Database.ColumnConfig({
        description: "Whether the user's email has been verified",
        default: false,
      }),
      Schema.optionalWith({ exact: true, nullable: true }),
    ),
    avatar: Schema.String.pipe(
      Database.ColumnConfig({
        description: "The user's avatar",
      }),
      Schema.optionalWith({ exact: true, nullable: true }),
    ),
    createdAt: Database.DateTimeInsert,
    updatedAt: Database.DateTimeUpdate,
  },
  {
    ...Database.ModelConfig({
      description: 'User',
      documentation: 'User',
      relations: [
        // {
        //   type: "one-to-one",
        //   name: "account",
        //   fields: ["accountId"],
        //   referencedModel: "accounts",
        //   references: ["id"],
        // },
        // {
        //   type: "one-to-one",
        //   name: "session",
        //   fields: ["id"],
        //   referencedModel: "sessions",
        //   references: ["id"],
        // },
      ],
    }),
  },
) {
  static table = TABLES.user

  static repo = Database.repo(this)
}

export class OAuthGithubAccount extends Database.Class<OAuthGithubAccount>('OAuthGithubAccount')({
  id: Schema.Number,
  node_id: Schema.String,
  avatar_url: Schema.String,
  gravatar_id: Schema.String,
  url: Schema.String,
  type: Schema.String,
  name: Schema.String,
  company: Schema.NullOr(Schema.String),
  location: Schema.String,
  email: Schema.String,
  bio: Schema.String,
  twitter_username: Schema.NullOr(Schema.String),
  notification_email: Schema.String,
  created_at: Schema.String,
  updated_at: Schema.String,
}) {}

export class OAuthGoogleAccount extends Database.Class<OAuthGoogleAccount>('OAuthGoogleAccount')({
  sub: Schema.String,
  email: Schema.String,
  email_verified: Schema.Boolean,
  given_name: Schema.optionalWith(Schema.String, { exact: true, default: () => '' }),
  picture: Schema.optional(Schema.String),
}) {}

export const OAuthAccountFromJSON = Schema.parseJson(Schema.Union(OAuthGithubAccount, OAuthGoogleAccount))

export class Account extends Database.Class<Account>('@userkit:account-table')(
  {
    id: AccountId.pipe(Database.id.uuidInsertSchema()),
    userId: UserId.pipe(
      Database.ColumnConfig({
        description: 'User ID',
      }),
    ),
    accountId: Schema.String.pipe(
      Database.ColumnConfig({
        description: 'OAuth Provider Account ID',
        nullable: true,
      }),
      Schema.optionalWith({ exact: true, nullable: true }),
    ),
    providerId: Schema.String.pipe(
      Database.ColumnConfig({
        description: 'OAuth Provider ID',
        nullable: true,
      }),
      Schema.optionalWith({ exact: true, nullable: true }),
    ),
    accessToken: Schema.String.pipe(
      Database.ColumnConfig({
        description: 'OAuth Access Token',
        nullable: true,
      }),
      Schema.optionalWith({ exact: true, nullable: true }),
    ),
    accessTokenExpiresAt: Schema.Date.pipe(
      Database.ColumnConfig({
        description: 'OAuth Access Token Expiration Date',
        nullable: true,
      }),
      Schema.optionalWith({ exact: true, nullable: true }),
    ),
    refreshToken: Schema.String.pipe(
      Database.ColumnConfig({
        description: 'OAuth Refresh Token',
        nullable: true,
      }),
      Schema.optionalWith({ exact: true, nullable: true }),
    ),
    refreshTokenExpiresAt: Schema.Date.pipe(
      Database.ColumnConfig({
        description: 'OAuth Refresh Token Expiration Date',
        nullable: true,
      }),
      Schema.optionalWith({ exact: true, nullable: true }),
    ),
    scope: Schema.String.pipe(
      Database.ColumnConfig({
        description: 'OAuth Scope',
        nullable: true,
      }),
      Schema.optionalWith({ exact: true, nullable: true }),
    ),
    idToken: Schema.String.pipe(
      Database.ColumnConfig({
        description: 'OAuth ID Token',
        nullable: true,
      }),
      Schema.optionalWith({ exact: true, nullable: true }),
    ),
    raw: OAuthAccountFromJSON.pipe(
      Database.ColumnConfig({
        description: 'OAuth Account Raw Data',
        nullable: true,
      }),
      Schema.optionalWith({ exact: true, nullable: true }),
    ),
  },
  {
    ...Database.ModelConfig({
      description: 'Account',
      documentation: 'Account',
      relations: [],
    }),
  },
) {
  static table = TABLES.account

  static repo = Database.repo(this)
}

export class Session extends Database.Class<Session>('@userkit:session-table')(
  {
    id: Database.id.uuidInsert,
    userId: UserId,
    expiresAt: Schema.DateFromNumber,
    ip: Schema.String.pipe(
      Database.ColumnConfig({
        description: 'The IP address of the user',
        nullable: true,
      }),
      Schema.optionalWith({ exact: true, nullable: true }),
    ),
    userAgent: Schema.String.pipe(
      Database.ColumnConfig({
        description: 'The user agent of the user',
        nullable: true,
      }),
      Schema.optionalWith({ exact: true, nullable: true }),
    ),
  },
  {
    ...Database.ModelConfig({
      description: 'Session',
      documentation: 'Session',
      relations: [
        // {
        //   type: "one-to-one",
        //   name: "user",
        //   referencedModel: "users",
        //   fields: ["userId"],
        //   references: ["id"],
        // },
      ],
    }),
  },
) {
  static table = TABLES.sessions

  static repo = Database.repo(this)
}

export class EmailVerificationCode extends Database.Class<EmailVerificationCode>(
  '@userkit/email-verification-code-table',
)(
  {
    id: Database.id.uuidInsert,
    email: Email.pipe(
      Database.ColumnConfig({
        description: "The user's email address",
      }),
    ),
    code: Schema.Redacted(Schema.String).pipe(
      Database.ColumnConfig({
        description: 'The verification code',
      }),
    ),
    token: Schema.Redacted(Schema.String).pipe(
      Database.ColumnConfig({
        description: 'The verification token',
      }),
    ),
    action: Schema.String.pipe(
      Database.ColumnConfig({
        description: 'The action to be performed',
      }),
    ),
    expiresAt: Database.DateTime,
    createdAt: Database.DateTimeInsert,
  },
  {
    ...Database.ModelConfig({
      description: 'Email Verification Code',
      documentation: 'Email Verification Code',
      relations: [],
    }),
  },
) {
  static table = TABLES.emailVerificationCodes

  static repo = Database.repo(this)
}
