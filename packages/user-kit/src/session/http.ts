import * as HttpApiBuilder from '@effect/platform/HttpApiBuilder'
import { MyHttpApi } from '@xstack/user-kit/api'
import { CurrentAuthSession } from '@xstack/user-kit/middleware'
import * as Effect from 'effect/Effect'

export const SessionHttpLayer = HttpApiBuilder.group(MyHttpApi, 'session', (handles) =>
  Effect.gen(function* () {
    return handles.handle('getSession', () =>
      Effect.gen(function* () {
        const { user } = yield* CurrentAuthSession

        return user
      }),
    )
  }),
)

export const HttpSessionLive = SessionHttpLayer
