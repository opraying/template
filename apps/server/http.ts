import * as HttpApiBuilder from '@effect/platform/HttpApiBuilder'
import { MyHttpApi } from '@server/api'
import { Users } from '@server/users'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'

export { HttpPurchaseLive } from '@xstack/app-kit/http'
export { HttpInternalLive } from '@xstack/internal-kit/http'
export { HttpAccountLive } from '@xstack/user-kit/account/http'
export { HttpAuthLive } from '@xstack/user-kit/authentication/http'
export { HttpOAuthLive } from '@xstack/user-kit/oauth/http'
export { HttpSessionLive } from '@xstack/user-kit/session/http'

export const HttpUsersLive = HttpApiBuilder.group(MyHttpApi, 'users', (handles) =>
  Effect.gen(function* () {
    const _users = yield* Users

    return handles.handle('info', () => Effect.succeed({} as any)).handle('update', () => Effect.succeed({} as any))
  }),
).pipe(Layer.provide(Users.Default))

export const HttpAppLive = HttpApiBuilder.group(MyHttpApi, 'app', (handles) =>
  Effect.gen(function* () {
    return handles.handle('health', () => Effect.succeed('OK'))
  }),
)
