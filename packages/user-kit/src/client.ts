import { Lucia } from '@xstack/server/lucia/make'
import { Account } from '@xstack/user-kit/account'
import { Authentication } from '@xstack/user-kit/authentication'
import { OAuth } from '@xstack/user-kit/oauth'
import * as Effect from 'effect/Effect'

export class UserKitClient extends Effect.Service<UserKitClient>()('UserKitClient', {
  accessors: true,
  effect: Effect.gen(function* () {
    const _lucia = yield* Lucia

    const _auth = yield* Authentication
    const _oauth = yield* OAuth
    const _account = yield* Account

    return {}
  }),
  dependencies: [Authentication.Default, OAuth.Default, Account.Default],
}) {}
