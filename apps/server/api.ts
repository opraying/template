import * as HttpApi from '@effect/platform/HttpApi'
import * as HttpApiEndpoint from '@effect/platform/HttpApiEndpoint'
import * as HttpApiGroup from '@effect/platform/HttpApiGroup'
import * as OpenApi from '@effect/platform/OpenApi'
import { UserWithSensitive } from '@server/schema'
import { PurchaseHttpApi } from '@xstack/app-kit/api/purchase'
import { InternalApi } from '@xstack/internal-kit/api'
import { InternalServerError } from '@xstack/errors/server'
import * as Ratelimit from '@xstack/server/ratelimit'
import { AccountApi, AuthApi, OAuthApi, SessionApi } from '@xstack/user-kit/api'
import { Unauthorized } from '@xstack/user-kit/errors'
import { SessionSecurityMiddleware } from '@xstack/user-kit/middleware'
import * as Schema from 'effect/Schema'

class AppApi extends HttpApiGroup.make('app')
  .add(HttpApiEndpoint.get('health', '/health').addSuccess(Schema.String))
  .prefix('/api')
  .annotateContext(
    OpenApi.annotations({
      title: 'App API',
      description: 'App API for Template',
      version: '0.0.1',
    }),
  ) {}

class UserApi extends HttpApiGroup.make('users')
  .add(HttpApiEndpoint.get('info', '/me').addSuccess(UserWithSensitive))
  .add(HttpApiEndpoint.post('update', '/update').addSuccess(UserWithSensitive))
  .middleware(Ratelimit.Middleware)
  .middleware(SessionSecurityMiddleware)
  .addError(Unauthorized)
  .addError(InternalServerError)
  .prefix('/api/users')
  .annotateContext(
    OpenApi.annotations({
      title: 'User API',
      description: 'API for managing users',
      version: '1.0.0',
    }),
  ) {}

export class MyHttpApi extends HttpApi.make('api')
  .add(AuthApi)
  .add(OAuthApi)
  .add(SessionApi)
  .add(AccountApi)
  .addHttpApi(PurchaseHttpApi)
  .add(InternalApi)
  .add(AppApi)
  .add(UserApi)
  .annotateContext(
    OpenApi.annotations({
      title: 'Template API',
      description: 'API for Template',
      version: '0.0.1',
    }),
  ) {}
