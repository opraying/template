import { ApiClient as PaymentApiClient } from '@xstack/app-kit/http'
import { UserKitClient } from '@xstack/user-kit/client'
import type { CurrentAuthSession } from '@xstack/user-kit/middleware'
import * as Config from 'effect/Config'
import * as Effect from 'effect/Effect'

const useConfig = Config.all({
  namespace: Config.string('NAMESPACE'),
}).pipe(Effect.orDie)

export class Users extends Effect.Service<Users>()('Users', {
  accessors: true,
  effect: Effect.gen(function* () {
    const _userKit = yield* UserKitClient
    const _client = yield* PaymentApiClient

    return {
      embellishUser: (_currentAuthSession: CurrentAuthSession) =>
        Effect.gen(function* () {
          const { namespace } = yield* useConfig

          return {}
        }),
    }
  }),
  dependencies: [UserKitClient.Default, PaymentApiClient.Default],
}) {}
