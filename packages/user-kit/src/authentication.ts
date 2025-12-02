import * as Headers from '@effect/platform/Headers'
import * as HttpApiBuilder from '@effect/platform/HttpApiBuilder'
import { HttpServerRequest } from '@effect/platform/HttpServerRequest'
import * as Database from '@xstack/db'
import { DefaultEmailTemplates } from '@xstack/emails/default'
import * as ServerConfig from '@xstack/server/config'
import { Lucia } from '@xstack/server/lucia/make'
import { Unauthorized, VerifyError } from '@xstack/user-kit/errors'
import { type CurrentAuthSession, SessionSecurityMiddleware } from '@xstack/user-kit/middleware'
import { AccountRepo, UserRepo, VerificationCodeRepo } from '@xstack/user-kit/repo'
import {
  type Auth,
  accessTokenFromRedacted,
  Email,
  type EmailVerificationAction,
  SessionId,
  SessionUser,
  UserId,
} from '@xstack/user-kit/schema'
import { SessionSecurity } from '@xstack/user-kit/security'
import * as Config from 'effect/Config'
import * as Context from 'effect/Context'
import * as DateTime from 'effect/DateTime'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import * as Match from 'effect/Match'
import * as Option from 'effect/Option'
import * as Redacted from 'effect/Redacted'

interface LoginAttributes {
  ip?: string
  userAgent?: string
}

export const getLoginAttributes = Effect.gen(function* () {
  const request = yield* HttpServerRequest

  const ip = pipe(
    Headers.get(request.headers, 'x-forwarded-for'),
    Option.orElse(() => Headers.get(request.headers, 'x-real-ip')),
    Option.getOrElse(() => 'global'),
  )

  const userAgent = pipe(
    Headers.get(request.headers, 'user-agent'),
    Option.getOrElse(() => 'unknown'),
  )

  return { ip, userAgent }
})

const make = Effect.gen(function* () {
  const _accountRepo = yield* AccountRepo
  const userRepo = yield* UserRepo
  const emailVerificationCodeRepo = yield* VerificationCodeRepo
  const lucia = yield* Lucia

  // ----- Login -----

  const emailLogin = ({ email }: { email: Email }) =>
    Effect.gen(function* () {
      const user = yield* userRepo.findByEmail(email)

      const userEmail = Option.match(user, {
        onNone: () => email,
        onSome: (_) => _.email,
      })

      const action: EmailVerificationAction = Option.isNone(user) ? 'create-user' : 'login'
      const { code, token } = yield* emailVerificationCodeRepo.generate({ email: userEmail, action: action })

      yield* Effect.annotateCurrentSpan({ email })
      yield* Effect.annotateLogsScoped({
        action,
        email,
      })

      yield* DefaultEmailTemplates.template(
        'magic-link',
        {
          to: email,
          from: 'onboarding@resend.dev',
          subject: 'Login verification code',
        },
        {
          loginCode: code,
        },
      ).pipe(Effect.ignoreLogged)

      yield* Effect.logDebug('send verification code successfully')
    }).pipe(Effect.withSpan('auth.emailLogin'))

  const verifyLogin = ({ userId, attributes }: { userId: UserId; attributes: LoginAttributes }) =>
    Effect.gen(function* () {
      /**
       * 每一个会话都不会主动失效（很长的期限）
       */
      const session = yield* lucia.createSession(userId, {
        ip: attributes.ip,
        user_agent: attributes.userAgent,
      })

      yield* Effect.logDebug('created new session')

      const token = yield* lucia.createSessionCookie(session.id)

      return token
    }).pipe(Effect.withSpan('auth.verifyLogin', { attributes: { userId } }))

  const verifyEmailLoginByCode = ({ code, attributes }: { code: string; attributes: LoginAttributes }) =>
    Effect.gen(function* () {
      const now = yield* DateTime.now

      const data = yield* pipe(
        emailVerificationCodeRepo.findByCode(code),
        Effect.flatten,
        Effect.catchTag(
          'NoSuchElementException',
          () => new VerifyError({ message: 'invalid code', cause: new Error('code not found') }),
        ),
        Effect.tap((item) => {
          const isValid = DateTime.lessThanOrEqualTo(now, DateTime.unsafeMake(item.expiresAt))

          if (isValid) {
            return pipe(
              Effect.logDebug('delete verification code'),
              Effect.zipRight(emailVerificationCodeRepo.invalidateAll({ email: item.email, action: item.action })),
              Effect.ignore,
            )
          }

          return pipe(
            Effect.logDebug('delete expired verification code'),
            Effect.zipRight(emailVerificationCodeRepo.deleteById(item.id)),
            Effect.ignore,
            Effect.zipRight(new VerifyError({ message: 'code expired', cause: new Error('code expired') })),
          )
        }),
      )

      yield* Effect.annotateLogsScoped({
        email: data.email,
        action: data.action,
      })

      yield* Effect.logDebug('verify code passed')

      const handleAction = Match.type<EmailVerificationAction>().pipe(
        Match.when('create-user', () => {
          return userRepo.insert({
            email: data.email,
            username: data.email.split('@')[0],
            avatar: '',
            emailVerified: true,
          })
        }),
        Match.when(
          'login',
          Effect.fn(function* () {
            const user = yield* userRepo.findByEmail(data.email).pipe(
              Effect.flatten,
              Effect.catchTag(
                'NoSuchElementException',
                () =>
                  new VerifyError({
                    message: 'user not found',
                    cause: new Error('user not found after token verification'),
                  }),
              ),
            )

            return user
          }),
        ),
        Match.orElseAbsurd,
      )

      const user = yield* handleAction(data.action as EmailVerificationAction)

      const token = yield* verifyLogin({ userId: user.id, attributes })

      return { token }
    }).pipe(Effect.withSpan('auth.verifyEmailLoginByCode'))

  const verifyEmailLoginByToken = ({ token, attributes }: { token: Auth.Token; attributes: LoginAttributes }) =>
    Effect.gen(function* () {
      const now = yield* DateTime.now

      const data = yield* pipe(
        emailVerificationCodeRepo.findByToken(Redacted.value(token)),
        Effect.flatten,
        Effect.catchTag(
          'NoSuchElementException',
          () => new VerifyError({ message: 'invalid token', cause: new Error('token not found') }),
        ),
        Effect.tap((item) => {
          const isValid = DateTime.lessThanOrEqualTo(now, DateTime.unsafeMake(item.expiresAt))

          if (isValid) {
            return pipe(
              Effect.logDebug('delete verification code'),
              Effect.zipRight(emailVerificationCodeRepo.invalidateAll({ email: item.email, action: item.action })),
              Effect.ignore,
            )
          }

          return pipe(
            Effect.logDebug('delete expired verification code'),
            Effect.zipRight(emailVerificationCodeRepo.deleteById(item.id)),
            Effect.ignore,
            Effect.zipRight(new VerifyError({ message: 'token expired', cause: new Error('token expired') })),
          )
        }),
      )

      yield* Effect.annotateLogsScoped({
        email: data.email,
        action: data.action,
      })

      yield* Effect.logDebug('verify token passed')

      const handleAction = Match.type<EmailVerificationAction>().pipe(
        Match.when('create-user', () =>
          userRepo.insert({
            email: data.email,
            username: data.email.split('@')[0],
            avatar: '',
          }),
        ),
        Match.when(
          'login',
          Effect.fn(function* () {
            const user = yield* userRepo.findByEmail(data.email).pipe(
              Effect.flatten,
              Effect.catchTag(
                'NoSuchElementException',
                () =>
                  new VerifyError({
                    message: 'user not found',
                    cause: new Error('user not found after token verification'),
                  }),
              ),
            )

            return user
          }),
        ),
        Match.orElseAbsurd,
      )

      const user = yield* handleAction(data.action as EmailVerificationAction)

      const sessionToken = yield* verifyLogin({ userId: user.id, attributes })

      return { token: sessionToken }
    }).pipe(Effect.withSpan('auth.verifyEmailLoginByToken'))

  const resendVerification = (email: Email) =>
    Effect.gen(function* () {
      const user = yield* userRepo.findByEmail(email)

      const action: EmailVerificationAction = Option.isNone(user) ? 'create-user' : 'login'
      const { code, token } = yield* emailVerificationCodeRepo.generate({
        email,
        action,
      })

      yield* DefaultEmailTemplates.template(
        'magic-link',
        {
          to: email,
          from: 'onboarding@resend.dev',
          subject: 'Login verification code',
        },
        {
          loginCode: code,
        },
      ).pipe(Effect.ignoreLogged)

      yield* Effect.logDebug('resend verification successfully')
    }).pipe(Effect.withSpan('auth.resendVerification', { attributes: { email } }))

  // ----- Logout -----

  const signOutUser = ({ userId }: { userId: UserId }) =>
    Effect.gen(function* () {
      yield* Effect.annotateLogsScoped({
        userId,
      })

      yield* lucia.invalidateUserSessions(userId)

      const newBlankCookie = yield* lucia.createBlankSessionCookie

      yield* Effect.logDebug('sign out user sessions')

      return { token: newBlankCookie }
    }).pipe(Effect.withSpan('auth.logoutUser', { attributes: { userId } }))

  const signOutSession = ({ sessionId }: { sessionId: SessionId }) =>
    Effect.gen(function* () {
      yield* Effect.annotateLogsScoped({
        sessionId,
      })

      yield* lucia.invalidateSession(sessionId)

      const newBlankCookie = yield* lucia.createBlankSessionCookie

      yield* Effect.logDebug('sign out session')

      return { token: newBlankCookie }
    }).pipe(Effect.withSpan('auth.logoutSession', { attributes: { sessionId } }))

  return {
    emailLogin,
    verifyLogin,
    verifyEmailLoginByCode,
    verifyEmailLoginByToken,
    resendVerification,
    signOutSession,
    signOutUser,
  } as const
})

const sessionSecurity = (lucia: Context.Tag.Service<typeof Lucia>, accessToken: Auth.AccessToken) =>
  Effect.gen(function* () {
    const value = Redacted.value(accessToken)

    if (!value) {
      return yield* new Unauthorized({
        actorId: UserId.make('unauthorized'),
        entity: 'User',
        action: 'read',
      })
    }

    const config = yield* Config.all({
      bucketDomain: ServerConfig.BUCKET_DOMAIN,
    }).pipe(Effect.orDie)

    return yield* lucia.validateSession(value).pipe(
      Effect.flatten,
      Effect.map((session) => {
        const userId = UserId.make(session.user.id)
        const email = Email.make((session.user as any).email as string)
        const emailVerified = Database.toBool((session.user as any).emailVerified) as boolean
        const username = (session.user as any).username as string
        const avatar = (session.user as any).avatar as string | null

        const authSession = {
          user: SessionUser.make({
            id: userId,
            email,
            emailVerified,
            username,
            avatar: avatar ? `https://${config.bucketDomain}/${avatar}` : '',
          }),
          sessionId: SessionId.make(session.session.id),
        } satisfies CurrentAuthSession as CurrentAuthSession

        return authSession
      }),
      Effect.catchAllCause(() =>
        Effect.fail(
          new Unauthorized({
            actorId: UserId.make('unauthorized'),
            entity: 'User',
            action: 'read',
          }),
        ),
      ),
      Effect.withSpan('auth.sessionSecurity'),
    )
  })

export class Authentication extends Context.Tag('@userkit:authentication')<
  Authentication,
  Effect.Effect.Success<typeof make>
>() {
  static layer = Layer.effect(this, make)

  static Default = this.layer.pipe(
    Layer.provide(UserRepo.Default),
    Layer.provide(AccountRepo.Default),
    Layer.provide(VerificationCodeRepo.Default),
  )
}

export const securityCookieDecode = HttpApiBuilder.securityDecode(SessionSecurity).pipe(
  Effect.map(accessTokenFromRedacted),
)

export const SessionSecurityMiddlewareLive = Layer.effect(
  SessionSecurityMiddleware,
  Effect.gen(function* () {
    const lucia = yield* Lucia

    return SessionSecurityMiddleware.of({
      cookie: (token) => sessionSecurity(lucia, accessTokenFromRedacted(token)),
    })
  }),
)
