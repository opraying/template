import * as Cookies from '@effect/platform/Cookies'
import * as HttpApiBuilder from '@effect/platform/HttpApiBuilder'
import * as HttpServerResponse from '@effect/platform/HttpServerResponse'
import { key as AppEnableKey } from '@xstack/react-router/utils'
import { toCookiesOptions } from '@xstack/server/cookie'
import { MyHttpApi } from '@xstack/user-kit/api'
import { Authentication, getLoginAttributes } from '@xstack/user-kit/authentication'
import { AuthWebConfig } from '@xstack/user-kit/config'
import { OAuthError } from '@xstack/user-kit/errors'
import { OAuth, oauthCodeVerifierSecurityDecode, oauthStateSecurityDecode } from '@xstack/user-kit/oauth'
import { GithubOAuthProvider } from '@xstack/user-kit/oauth/github'
import { GoogleOAuthProvider } from '@xstack/user-kit/oauth/google'
import { OAuthProvider, OAuthStateOptionsBase64 } from '@xstack/user-kit/oauth/provider'
import type { OAuthProviderLiteral } from '@xstack/user-kit/schema'
import { OAuthCodeVerifierSecurity, OAuthStateSecurity, SessionSecurity } from '@xstack/user-kit/security'
import * as Array from 'effect/Array'
import * as Duration from 'effect/Duration'
import * as Effect from 'effect/Effect'
import { constFalse, constTrue, pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import * as Match from 'effect/Match'
import * as Option from 'effect/Option'
import * as Redacted from 'effect/Redacted'
import * as Schema from 'effect/Schema'
import * as String from 'effect/String'

// check provider exists in auth web config
const isAllowProvider = (nowProvider: OAuthProviderLiteral, providers: OAuthProviderLiteral[]) =>
  Array.findFirst(providers, (_) => _ === nowProvider).pipe(
    Option.match({
      onNone: constFalse,
      onSome: constTrue,
    }),
  )

const withProviderGuard =
  (nowProvider: OAuthProviderLiteral, providers: Record<OAuthProviderLiteral, OAuthProvider>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) => {
    return Effect.if(isAllowProvider(nowProvider, Object.keys(providers) as OAuthProviderLiteral[]), {
      onFalse: () => new OAuthError({ message: 'provider not allowed' }),
      onTrue: () => effect.pipe(Effect.provideService(OAuthProvider, providers[nowProvider])),
    })
  }

export const OAuthHttpLayer = HttpApiBuilder.group(MyHttpApi, 'oauth', (handles) =>
  Effect.gen(function* () {
    const authWebConfig = yield* AuthWebConfig
    const auth = yield* Authentication
    const oauth = yield* OAuth

    const providers = {
      Github: yield* GithubOAuthProvider,
      Google: yield* GoogleOAuthProvider,
    }

    const redirectError = (provider: OAuthProviderLiteral, error: string) =>
      HttpServerResponse.redirect(`/login?error=${String.snakeToKebab(error)}&provider=${provider}`, {
        status: 302,
        cookies: Cookies.fromIterable([
          Cookies.unsafeMakeCookie(OAuthStateSecurity.key, '', {
            secure: true,
            httpOnly: true,
            sameSite: 'lax',
            path: '/',
            maxAge: Duration.zero,
          }),
          Cookies.unsafeMakeCookie(OAuthCodeVerifierSecurity.key, '', {
            secure: true,
            httpOnly: true,
            sameSite: 'lax',
            path: '/',
            maxAge: Duration.zero,
          }),
        ]),
      })

    return handles
      .handleRaw('oauthLogin', ({ path, urlParams }) =>
        pipe(
          OAuth.getAuthorizationUrl({
            isPortal: urlParams.isPortal,
            redirectUri: urlParams.redirectUri,
          }),
          Effect.map(({ url, state, codeVerifier }) => {
            const cookies = pipe(
              Array.empty(),
              /**
               * OAuth state is always needed
               */
              Array.append(
                Cookies.unsafeMakeCookie(OAuthStateSecurity.key, state, {
                  secure: true,
                  httpOnly: true,
                  sameSite: 'lax',
                  path: '/',
                  maxAge: Duration.minutes(10),
                }),
              ),
              (cookies) =>
                /**
                 * Code verifier is needed for PKCE
                 */
                Option.match(codeVerifier, {
                  onNone: () => cookies,
                  onSome: (codeVerifier) =>
                    Array.append(
                      cookies,
                      Cookies.unsafeMakeCookie(OAuthCodeVerifierSecurity.key, codeVerifier, {
                        secure: true,
                        httpOnly: true,
                        sameSite: 'lax',
                        path: '/',
                        maxAge: Duration.minutes(10),
                      }),
                    ),
                }),
              Cookies.fromIterable,
            )
            return HttpServerResponse.redirect(url, {
              status: 302,
              cookies,
            })
          }),
          Effect.tapErrorCause(Effect.logError),
          withProviderGuard(path.provider, providers),
          Effect.catchTags({
            '@userkit:oauth-app-error': (error) => redirectError(path.provider, error.reason),
            '@userkit:oauth-internal-error': () => redirectError(path.provider, 'internal_error'),
          }),
        ),
      )
      .handle('oauthCallback', ({ path, payload }) => {
        const run = pipe(
          Match.type<typeof payload>(),
          Match.when({ error: Match.string }, ({ error }) => redirectError(path.provider, error)),
          Match.when({ code: Match.string }, ({ state: callbackState, code }) =>
            pipe(
              Match.value(path.provider),
              Match.when('Github', () =>
                Effect.all({
                  state: oauthStateSecurityDecode.pipe(Effect.map(Redacted.value)),
                  codeVerifier: Effect.succeed(Option.none<string>()),
                }),
              ),
              Match.when('Google', () =>
                Effect.all({
                  state: oauthStateSecurityDecode.pipe(Effect.map(Redacted.value)),
                  codeVerifier: oauthCodeVerifierSecurityDecode.pipe(
                    Effect.map(Redacted.value),
                    Effect.map(Option.fromNullable),
                  ),
                }),
              ),
              Match.exhaustive,
              Effect.bindTo('cookiesPayload'),
              Effect.bind('params', () => {
                const [options, state] = callbackState.split('|')
                return Effect.all({
                  options: Schema.decode(OAuthStateOptionsBase64)(options),
                  state: Effect.succeed(state),
                })
              }),
              Effect.bind('result', ({ cookiesPayload, params: { state } }) =>
                oauth.callback(path.provider, cookiesPayload, { callbackState, state, code }),
              ),
              Effect.bind('attributes', () => getLoginAttributes),
              Effect.bind('token', ({ result: { account, user }, attributes }) =>
                auth.verifyLogin({ userId: user.id, attributes }),
              ),
              Effect.map(({ token, params: { options } }) => {
                const cookies = Cookies.fromIterable([
                  // delete cookie
                  Cookies.unsafeMakeCookie(OAuthStateSecurity.key, '', {
                    secure: true,
                    httpOnly: true,
                    sameSite: 'lax',
                    path: '/',
                    maxAge: Duration.zero,
                  }),
                  Cookies.unsafeMakeCookie(OAuthCodeVerifierSecurity.key, '', {
                    secure: true,
                    httpOnly: true,
                    sameSite: 'lax',
                    path: '/',
                    maxAge: Duration.zero,
                  }),

                  Cookies.unsafeMakeCookie(AppEnableKey, '1', {
                    secure: false,
                    httpOnly: false,
                    sameSite: 'strict',
                    path: '/',
                    maxAge: Duration.days(365),
                  }),

                  // set user session
                  Cookies.unsafeMakeCookie(
                    SessionSecurity.key,
                    token.value,
                    toCookiesOptions(token.attributes, { httpOnly: false }),
                  ),
                ])

                if (Option.isSome(options.isPortal) && options.isPortal.value) {
                  // redirect to portal page
                  return HttpServerResponse.text('<html><body><script>window.close()</script></body></html>', {
                    status: 200,
                    contentType: 'text/html',
                    cookies,
                  })
                }

                const location = Option.getOrElse(options.redirectUri, () => authWebConfig.loginRedirect || '/')

                return HttpServerResponse.redirect(location, {
                  status: 302,
                  cookies,
                })
              }),
              withProviderGuard(path.provider, providers),
              Effect.catchTags({
                '@userkit:oauth-app-error': (error) => redirectError(path.provider, error.reason),
                '@userkit:oauth-internal-error': () => redirectError(path.provider, 'internal_error'),
                ParseError: (error) => new OAuthError({ message: 'internal error', cause: error }),
                SqlError: (error) => new OAuthError({ message: 'internal error', cause: error }),
              }),
            ),
          ),
          Match.exhaustive,
        )

        return run(payload)
      })
  }),
)

export const HttpOAuthLive = OAuthHttpLayer.pipe(
  Layer.provide(GithubOAuthProvider.Live),
  Layer.provide(GoogleOAuthProvider.Live),
  Layer.provide(Authentication.Default),
  Layer.provide(OAuth.Default),
)
