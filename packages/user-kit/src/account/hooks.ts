import * as ApiClient from '@xstack/app-kit/api/client'
import { BasicLive } from '@xstack/preset-web/browser'
import { useAtomSuspense, Atom } from '@xstack/atom-react'
import type { MyHttpApi } from '@xstack/user-kit/api'
import { authSession } from '@xstack/user-kit/authentication/hooks'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'

const useClient = ApiClient.client.getClient<typeof MyHttpApi>('default')

const runtime = Atom.runtime(Layer.mergeAll(BasicLive, Layer.empty))

const accountInfo = runtime
  .atom((ctx) =>
    Effect.gen(function* () {
      const client = yield* useClient

      const { user } = ctx.get(authSession)

      const account = yield* client.account.getAccount().pipe(
        Effect.orElseSucceed(() => {
          return {
            providers: [],
          }
        }),
      )

      return {
        user,
        oauthProviders: account.providers,
      }
    }),
  )
  .pipe(Atom.keepAlive)

export const useAccount = () => useAtomSuspense(accountInfo)
