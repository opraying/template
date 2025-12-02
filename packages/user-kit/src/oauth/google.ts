import * as FetchHttpClient from '@effect/platform/FetchHttpClient'
import * as HttpClient from '@effect/platform/HttpClient'
import { OAUTH_CONFIG } from '@xstack/user-kit/config'
import { OAuthAppError, OAuthInternalError } from '@xstack/user-kit/errors'
import { type OAuthProvider, OAuthStateOptionsBase64 } from '@xstack/user-kit/oauth/provider'
import { Email } from '@xstack/user-kit/schema'
import { OAuthGoogleAccount } from '@xstack/user-kit/tables'
import { Google, generateCodeVerifier, generateState } from 'arctic'
import * as ConfigError from 'effect/ConfigError'
import * as ConfigProvider from 'effect/ConfigProvider'
import * as Context from 'effect/Context'
import * as DefaultServices from 'effect/DefaultServices'
import * as Effect from 'effect/Effect'
import * as FiberRef from 'effect/FiberRef'
import { pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import * as Option from 'effect/Option'
import * as Redacted from 'effect/Redacted'
import * as Schema from 'effect/Schema'

export class GoogleOAuthProvider extends Context.Tag('@userkit:oauth:google-provider')<
  GoogleOAuthProvider,
  OAuthProvider
>() {
  static Live = Layer.effect(
    this,
    Effect.gen(function* () {
      const defaultService = yield* FiberRef.get(DefaultServices.currentServices)

      const google = pipe(
        OAUTH_CONFIG,
        Effect.flatMap((config) => {
          if (Option.isNone(config.providers.Google)) {
            return Effect.fail(ConfigError.MissingData(['OAUTH', 'providers', 'Google'], 'Google is not configured'))
          }

          return Effect.zip(Effect.succeed(config.providers.Google.value), Effect.succeed(config))
        }),
        Effect.map(
          ([googleConfig, config]) =>
            new Google(
              googleConfig.clientId,
              Redacted.value(googleConfig.clientSecret),
              config.redirectURI.replace('{provider}', 'google'),
            ),
        ),
        Effect.withConfigProvider(Context.get(defaultService, ConfigProvider.ConfigProvider)),
        Effect.catchTags({
          ConfigError: (error) => new OAuthInternalError({ message: 'OAuth Config Error', cause: error }),
        }),
      )

      const getAuthorizationUrl = ({ isPortal, redirectUri }: Parameters<OAuthProvider['getAuthorizationUrl']>[0]) =>
        pipe(
          Effect.all({
            google,
            codeVerifier: Effect.sync(() => generateCodeVerifier()),
            state: Schema.encode(OAuthStateOptionsBase64)({ isPortal, redirectUri })
              .pipe(Effect.map((options) => `${options}|${generateState()}`))
              .pipe(Effect.orDie),
          }),
          Effect.flatMap(({ google, codeVerifier, state }) => {
            const url = Effect.try({
              try: () => google.createAuthorizationURL(state, codeVerifier, ['profile', 'email']),
              catch: (error) => new OAuthInternalError({ message: 'OAuth get authorization url error', cause: error }),
            }).pipe(Effect.map((url) => url.toString()))

            return Effect.all({
              url,
              state: Effect.succeed(state),
              codeVerifier: Effect.succeed(Option.some(codeVerifier)),
            }).pipe(Effect.withSpan('oauth.google.getAuthorizationUrl'))
          }),
        )

      const callback = ({ code, codeVerifier }: Parameters<OAuthProvider['callback']>[0]) =>
        pipe(
          google,
          Effect.bindTo('google'),
          Effect.bind('tokens', ({ google }) =>
            pipe(
              codeVerifier,
              Option.match({
                onNone: () =>
                  Effect.fail(
                    new OAuthAppError({
                      message: 'OAuth callback error',
                      cause: new Error('codeVerifier is None'),
                      reason: 'invalid-code',
                    }),
                  ),
                onSome: (codeVerifier) => {
                  return Effect.tryPromise({
                    try: () => google.validateAuthorizationCode(code, codeVerifier),
                    catch: (error) =>
                      new OAuthAppError({ message: 'OAuth callback error', cause: error, reason: 'invalid-code' }),
                  })
                },
              }),
              Effect.withSpan('oauth.google.validateAuthorizationCode'),
            ),
          ),
          Effect.bind('response', ({ tokens }) =>
            pipe(
              HttpClient.get('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: {
                  Authorization: `Bearer ${tokens.accessToken()}`,
                },
              }),
              Effect.flatMap((_) => _.json),
              Effect.withSpan('oauth.google.getUserInfo'),
            ),
          ),
          Effect.bind('result', ({ response }) => Schema.decodeUnknown(OAuthGoogleAccount)(response)),
          Effect.map(({ result }) => {
            const primaryEmail = Option.fromNullable(result.email).pipe(Option.map((email) => Email.make(email)))

            return {
              uniqueId: result.sub,
              avatarUrl: Option.fromNullable(result.picture),
              email: primaryEmail,
              username: Option.fromNullable(result.given_name),
              raw: result,
            }
          }),
          Effect.catchTags({
            ParseError: (error) => new OAuthInternalError({ message: 'OAuth parse error', cause: error }),
            RequestError: (error) => new OAuthInternalError({ message: 'OAuth request error', cause: error }),
            ResponseError: (error) => new OAuthInternalError({ message: 'OAuth response error', cause: error }),
          }),
          Effect.provide(FetchHttpClient.layer),
          Effect.withSpan('oauth.google.callback'),
        )

      return {
        getAuthorizationUrl,
        callback,
      } satisfies OAuthProvider
    }),
  )
}
