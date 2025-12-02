import * as HttpApiBuilder from '@effect/platform/HttpApiBuilder'
import { MyHttpApi } from '@server/api'
import { tables } from '@server/db'
import { DBLive } from '@server/db/make'
import {
  HttpAccountLive,
  HttpAppLive,
  HttpAuthLive,
  HttpInternalLive,
  HttpOAuthLive,
  HttpPurchaseLive,
  HttpSessionLive,
  HttpUsersLive,
} from '@server/http'
import { authWebConfig } from '@shared/config'
import { CloudflareLive } from '@xstack/preset-cloudflare/cloudflare'
import { CloudflareFetchHandle, make } from '@xstack/cloudflare/entry'
import * as Database from '@xstack/db'
import * as RatelimitMiddleware from '@xstack/server/ratelimit/middleware'
import { SessionSecurityMiddlewareLive } from '@xstack/user-kit/authentication'
import { AuthConfigFromConfig } from '@xstack/user-kit/config'
import { pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'

const AuthLive = AuthConfigFromConfig(authWebConfig, {
  tables: {
    user: tables.user.table,
    session: tables.session.table,
  },
  getSessionAttributes: (attributes: any) => {
    return {
      ip: attributes.ip,
      userAgent: attributes.user_agent,
    }
  },
  getUserAttributes: (attributes: any) => {
    return {
      email: attributes.email,
      emailVerified: Database.toBool(attributes.email_verified),
      username: attributes.username,
      avatar: attributes.avatar,
    }
  },
})

const Live = pipe(
  HttpApiBuilder.api(MyHttpApi),
  Layer.provide([
    HttpInternalLive,
    HttpAuthLive,
    HttpOAuthLive,
    HttpSessionLive,
    HttpAccountLive,
    HttpPurchaseLive,
    HttpUsersLive,
    HttpAppLive,
  ]),
  Layer.provide([SessionSecurityMiddlewareLive, RatelimitMiddleware.api(MyHttpApi)]),
  Layer.provide([AuthLive]),
  Layer.provide([DBLive, CloudflareLive]),
)

const FetchLive = CloudflareFetchHandle.make(Live)

export default make({ fetch: FetchLive })
