import type { OAuthAppError, OAuthInternalError } from '@xstack/user-kit/errors'
import type { Email } from '@xstack/user-kit/schema'
import * as Context from 'effect/Context'
import type * as Effect from 'effect/Effect'
import type * as Option from 'effect/Option'
import * as Schema from 'effect/Schema'

const BooleanFromLiteral = Schema.transform(Schema.Literal('true', 'false'), Schema.Boolean, {
  decode: (s) => s === 'true',
  encode: (b) => (b ? 'true' : 'false'),
  strict: true,
}).annotations({ identifier: 'BooleanFromLiteral' })

export const OAuthStateOptions = Schema.Struct({
  isPortal: Schema.OptionFromUndefinedOr(BooleanFromLiteral),
  redirectUri: Schema.OptionFromUndefinedOr(Schema.String),
})
export type OAuthStateOptions = typeof OAuthStateOptions.Type
export type OAuthStateOptionsInput = typeof OAuthStateOptions.Encoded

export const OAuthStateOptionsBase64 = Schema.transform(Schema.StringFromBase64Url, OAuthStateOptions, {
  decode: (s) => JSON.parse(s),
  encode: (s) => JSON.stringify(s),
  strict: true,
})

export interface OAuthProvider {
  getAuthorizationUrl: (
    options: OAuthStateOptions,
  ) => Effect.Effect<
    { url: string; state: string; codeVerifier: Option.Option<string> },
    OAuthInternalError | OAuthAppError,
    never
  >
  callback: ({
    code,
    state,
    codeVerifier,
  }: {
    code: string
    state: string
    codeVerifier: Option.Option<string>
  }) => Effect.Effect<OAuthUserResult, OAuthInternalError | OAuthAppError, never>
}
export const OAuthProvider = Context.GenericTag<OAuthProvider>('@userkit:oauth-provider')

export interface OAuthUserResult {
  uniqueId: string
  email: Option.Option<Email>
  username: Option.Option<string>
  avatarUrl: Option.Option<string>
  raw: any
}
