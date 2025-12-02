import * as HttpApi from '@effect/platform/HttpApi'
import * as HttpApiEndpoint from '@effect/platform/HttpApiEndpoint'
import * as HttpApiGroup from '@effect/platform/HttpApiGroup'
import * as OpenApi from '@effect/platform/OpenApi'
import { InternalServerError } from '@xstack/errors/server'
import * as Ratelimit from '@xstack/server/ratelimit'
import { LoginError, OAuthError, Unauthorized, VerifyError } from '@xstack/user-kit/errors'
import { SessionSecurityMiddleware } from '@xstack/user-kit/middleware'
import { OAuthStateOptions } from '@xstack/user-kit/oauth/provider'
import {
  EmailFromString,
  LoginSchema,
  OAuthProviderLower,
  ProviderID,
  SessionUser,
  Token,
} from '@xstack/user-kit/schema'
import * as Schema from 'effect/Schema'

// Auth API
export class AuthApi extends HttpApiGroup.make('auth')
  // ----- Authenticated endpoints -----
  .add(HttpApiEndpoint.post('signOut', '/signOut').addSuccess(Schema.Void).addError(Unauthorized))
  .middlewareEndpoints(SessionSecurityMiddleware)
  // ----- Unauthenticated endpoints -----
  .add(HttpApiEndpoint.post('login', '/login').setPayload(LoginSchema).addSuccess(Schema.Void).addError(LoginError))
  .add(
    HttpApiEndpoint.post('verifyEmailCode', '/verify-email-code')
      .setPayload(Schema.Struct({ code: Schema.NonEmptyString }))
      .addSuccess(Schema.Void)
      .addError(VerifyError),
  )
  .add(
    HttpApiEndpoint.get('verifyEmailToken', '/verify-email-token/:token')
      .setPath(Schema.Struct({ token: Token }))
      .addSuccess(Schema.Void)
      .addError(VerifyError),
  )
  .add(
    HttpApiEndpoint.post('resendVerification', '/resend-verification')
      .setPayload(Schema.Struct({ email: EmailFromString }))
      .addSuccess(Schema.Void),
  )
  .middleware(Ratelimit.Middleware)
  .addError(InternalServerError)
  .prefix('/api/auth')
  .annotateContext(
    OpenApi.annotations({
      title: 'Auth API',
      description: 'API for authentication',
      version: '1.0.0',
    }),
  ) {}

export class OAuthApi extends HttpApiGroup.make('oauth')
  .add(
    HttpApiEndpoint.get('oauthLogin', '/:provider')
      .setPath(Schema.Struct({ provider: OAuthProviderLower }))
      .setUrlParams(OAuthStateOptions)
      .addSuccess(Schema.Void),
  )
  .add(
    HttpApiEndpoint.get('oauthCallback', '/:provider/callback')
      .setPath(Schema.Struct({ provider: OAuthProviderLower }))
      .setPayload(
        Schema.Union(
          Schema.Struct({ state: Schema.NonEmptyString, code: Schema.NonEmptyString }),
          Schema.Struct({ state: Schema.NonEmptyString, error: Schema.String }),
        ),
      )
      .addSuccess(Schema.Void),
  )
  .middleware(Ratelimit.Middleware)
  .addError(OAuthError)
  .addError(InternalServerError)
  .prefix('/api/oauth')
  .annotateContext(
    OpenApi.annotations({
      title: 'OAuth API',
      description: 'API for OAuth',
      version: '1.0.0',
    }),
  ) {}

export class SessionApi extends HttpApiGroup.make('session')
  .add(HttpApiEndpoint.get('getSession', '/').addSuccess(SessionUser))
  .middleware(Ratelimit.Middleware)
  .middleware(SessionSecurityMiddleware)
  .addError(Unauthorized)
  .addError(InternalServerError)
  .prefix('/api/session')
  .annotateContext(
    OpenApi.annotations({
      title: 'Sessions API',
      description: 'API for managing sessions',
      version: '1.0.0',
    }),
  ) {}

export class AccountApi extends HttpApiGroup.make('account')
  .add(
    HttpApiEndpoint.get('getAccount', '/').addSuccess(
      Schema.Struct({
        providers: Schema.Array(
          Schema.Struct({
            id: ProviderID,
          }),
        ),
      }),
    ),
  )
  .middleware(Ratelimit.Middleware)
  .middleware(SessionSecurityMiddleware)
  .addError(Unauthorized)
  .addError(InternalServerError)
  .prefix('/api/account')
  .annotateContext(
    OpenApi.annotations({
      title: 'Accounts API',
      description: 'API for managing accounts',
      version: '1.0.0',
    }),
  ) {}

export class MyHttpApi extends HttpApi.make('api').add(AuthApi).add(OAuthApi).add(SessionApi).add(AccountApi) {}
