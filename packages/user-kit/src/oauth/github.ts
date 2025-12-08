import * as FetchHttpClient from '@effect/platform/FetchHttpClient'
import * as HttpClient from '@effect/platform/HttpClient'
import { OAUTH_CONFIG } from '@xstack/user-kit/config'
import { OAuthAppError, OAuthInternalError } from '@xstack/user-kit/errors'
import { type OAuthProvider, OAuthStateOptionsBase64 } from '@xstack/user-kit/oauth/provider'
import { Email } from '@xstack/user-kit/schema'
import { OAuthGithubAccount } from '@xstack/user-kit/tables'
import { GitHub, generateState } from 'arctic'
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

export class GithubOAuthProvider extends Context.Tag('@userkit:oauth:github-provider')<
  GithubOAuthProvider,
  OAuthProvider
>() {
  static Live = Layer.effect(
    this,
    Effect.gen(function* () {
      const defaultService = yield* FiberRef.get(DefaultServices.currentServices)

      const github = pipe(
        OAUTH_CONFIG,
        Effect.flatMap((config) => {
          if (Option.isNone(config.providers.Github)) {
            return Effect.fail(ConfigError.MissingData(['OAUTH', 'providers', 'Github'], 'Github is not configured'))
          }

          return Effect.zip(Effect.succeed(config.providers.Github.value), Effect.succeed(config))
        }),
        Effect.map(
          ([githubConfig, config]) =>
            new GitHub(
              githubConfig.clientId,
              Redacted.value(githubConfig.clientSecret),
              config.redirectURI.replace('{provider}', 'github'),
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
            github,
            state: Schema.encode(OAuthStateOptionsBase64)({ isPortal, redirectUri })
              .pipe(Effect.map((options) => `${options}|${generateState()}`))
              .pipe(Effect.orDie),
          }),
          Effect.flatMap(({ github, state }) => {
            const url = Effect.try({
              try: () => github.createAuthorizationURL(state, ['user:email']),
              catch: (error) =>
                new OAuthInternalError({
                  message: 'OAuth get authorization url error',
                  cause: error,
                }),
            }).pipe(Effect.map((url) => url.toString()))

            return Effect.all({
              url,
              state: Effect.succeed(state),
              codeVerifier: Effect.succeed(Option.none<string>()),
            }).pipe(Effect.withSpan('oauth.github.getAuthorizationUrl'))
          }),
        )

      const callback = ({ code }: Parameters<OAuthProvider['callback']>[0]) =>
        pipe(
          github,
          Effect.bindTo('github'),
          Effect.bind('tokens', ({ github }) =>
            Effect.tryPromise({
              try: () => github.validateAuthorizationCode(code),
              catch: (error) =>
                new OAuthAppError({
                  message: 'OAuth callback error',
                  cause: error,
                  reason: 'invalid-code',
                }),
            }).pipe(Effect.withSpan('oauth.github.validateAuthorizationCode')),
          ),
          Effect.bind('response', ({ tokens }) =>
            HttpClient.get('https://api.github.com/user', {
              headers: {
                Authorization: `Bearer ${tokens.accessToken()}`,
                'User-Agent': 'Github-OAuth',
                Accept: 'application/vnd.github+json',
              },
            }).pipe(
              Effect.flatMap((_) => _.json),
              Effect.withSpan('oauth.github.getUserInfo'),
              Effect.flatMap((json: any) => {
                if (!json.email) {
                  return pipe(
                    HttpClient.get('https://api.github.com/user/emails', {
                      headers: {
                        Authorization: `Bearer ${tokens.accessToken()}`,
                        'User-Agent': 'Github-OAuth',
                        Accept: 'application/vnd.github+json',
                      },
                    }),
                    Effect.flatMap((_) => _.json),
                    Effect.flatMap((emails) => {
                      const primaryEmail = (emails as Array<{ primary: boolean; email: string }>).find(
                        (email) => email.primary,
                      )

                      if (!primaryEmail) {
                        return Effect.fail(
                          new OAuthAppError({
                            message: 'Github primary email not found',
                            reason: 'internal-error',
                          }),
                        )
                      }

                      return Effect.succeed({
                        ...json,
                        email: primaryEmail.email,
                      })
                    }),
                    Effect.withSpan('oauth.github.getUserEmails'),
                  )
                }

                return Effect.succeed(json)
              }),
            ),
          ),
          Effect.bind('result', ({ response }) => Schema.decodeUnknown(OAuthGithubAccount)(response)),
          Effect.map(({ result }) => {
            const primaryEmail = Option.fromNullable(result.email).pipe(Option.map((email) => Email.make(email)))

            return {
              uniqueId: result.id.toString(),
              avatarUrl: Option.fromNullable(result.avatar_url),
              email: primaryEmail,
              username: Option.fromNullable(result.name),
              raw: result,
            }
          }),
          Effect.catchTags({
            ParseError: (error) => new OAuthInternalError({ message: 'OAuth parse error', cause: error }),
            RequestError: (error) => new OAuthInternalError({ message: 'OAuth request error', cause: error }),
            ResponseError: (error) => new OAuthInternalError({ message: 'OAuth response error', cause: error }),
          }),
          Effect.provide(FetchHttpClient.layer),
          Effect.withSpan('oauth.github.callback'),
        )

      return {
        getAuthorizationUrl,
        callback,
      } satisfies OAuthProvider
    }),
  )
}
