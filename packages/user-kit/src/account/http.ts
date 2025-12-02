import * as HttpApiBuilder from '@effect/platform/HttpApiBuilder'
import { Account } from '@xstack/user-kit/account'
import { MyHttpApi } from '@xstack/user-kit/api'
import { CurrentAuthSession } from '@xstack/user-kit/middleware'
import type { ProviderID } from '@xstack/user-kit/schema'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'

export const AccountHttpLayer = HttpApiBuilder.group(MyHttpApi, 'account', (handles) =>
  Effect.gen(function* () {
    return handles.handle('getAccount', () =>
      Effect.gen(function* () {
        const { user } = yield* CurrentAuthSession
        const account = yield* Account

        const accounts = yield* account.getAccount(user.id).pipe(Effect.orDie)

        return {
          providers: accounts.map((_) => {
            return {
              id: _.providerId as typeof ProviderID.Type,
            }
          }),
        }
      }),
    )
  }),
)

export const HttpAccountLive = AccountHttpLayer.pipe(Layer.provide(Account.Default))
