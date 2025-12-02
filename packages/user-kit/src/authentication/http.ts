import * as Cookies from '@effect/platform/Cookies'
import * as HttpApiBuilder from '@effect/platform/HttpApiBuilder'
import * as HttpServerResponse from '@effect/platform/HttpServerResponse'
import { toCookiesOptions } from '@xstack/server/cookie'
import { InternalServerError } from '@xstack/errors/server'
import { MyHttpApi } from '@xstack/user-kit/api'
import { Authentication, getLoginAttributes } from '@xstack/user-kit/authentication'
import { CurrentAuthSession } from '@xstack/user-kit/middleware'
import { SessionSecurity } from '@xstack/user-kit/security'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'

export const AuthHttpLayer = HttpApiBuilder.group(MyHttpApi, 'auth', (handles) =>
  Effect.gen(function* () {
    const auth = yield* Authentication

    return handles
      .handle('login', ({ payload }) =>
        Effect.gen(function* () {
          const res = yield* pipe(
            auth.emailLogin({ email: payload.email }),
            Effect.catchTags({
              SqlError: (error) => new InternalServerError({ cause: error }),
              ParseError: (error) => new InternalServerError({ cause: error }),
            }),
          )

          return res
        }),
      )
      .handleRaw('signOut', () =>
        pipe(
          CurrentAuthSession,
          Effect.flatMap((session) => auth.signOutSession({ sessionId: session.sessionId })),
          Effect.map(({ token }) =>
            HttpServerResponse.empty({
              cookies: Cookies.fromIterable([
                Cookies.unsafeMakeCookie(
                  SessionSecurity.key,
                  token.value,
                  toCookiesOptions(token.attributes, { httpOnly: false }),
                ),
              ]),
            }),
          ),
        ),
      )
      .handle('verifyEmailCode', ({ payload }) =>
        Effect.gen(function* () {
          const loginAttributes = yield* getLoginAttributes

          const res = yield* pipe(
            auth.verifyEmailLoginByCode({ code: payload.code, attributes: loginAttributes }),
            Effect.map(({ token }) =>
              HttpServerResponse.empty({
                cookies: Cookies.fromIterable([
                  Cookies.unsafeMakeCookie(
                    SessionSecurity.key,
                    token.value,
                    toCookiesOptions(token.attributes, { httpOnly: false }),
                  ),
                ]),
              }),
            ),
            Effect.catchTags({
              SqlError: (error) => new InternalServerError({ cause: error }),
              ParseError: (error) => new InternalServerError({ cause: error }),
            }),
          )

          return res
        }),
      )
      .handleRaw('verifyEmailToken', ({ path }) =>
        Effect.gen(function* () {
          const loginAttributes = yield* getLoginAttributes

          const res = yield* pipe(
            auth.verifyEmailLoginByToken({ token: path.token, attributes: loginAttributes }),
            Effect.map(({ token }) =>
              HttpServerResponse.empty({
                cookies: Cookies.fromIterable([
                  Cookies.unsafeMakeCookie(
                    SessionSecurity.key,
                    token.value,
                    toCookiesOptions(token.attributes, { httpOnly: false }),
                  ),
                ]),
              }),
            ),
            Effect.catchTags({
              SqlError: (error) => new InternalServerError({ cause: error }),
              ParseError: (error) => new InternalServerError({ cause: error }),
            }),
          )

          return res
        }),
      )
      .handle('resendVerification', ({ payload }) => auth.resendVerification(payload.email).pipe(Effect.orDie))
  }),
)

export const HttpAuthLive = AuthHttpLayer.pipe(Layer.provide(Authentication.Default))
