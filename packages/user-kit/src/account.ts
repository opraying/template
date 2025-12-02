import { AccountRepo } from '@xstack/user-kit/repo'
import type { UserId } from '@xstack/user-kit/schema'
import * as Effect from 'effect/Effect'

export class Account extends Effect.Service<Account>()('Account', {
  accessors: true,
  effect: Effect.gen(function* () {
    const accountRepo = yield* AccountRepo

    const getAccount = Effect.fn(function* (id: UserId) {
      const accounts = yield* accountRepo.findAccountsByUserId(id)

      return accounts
    })

    return {
      getAccount,
    }
  }),
  dependencies: [AccountRepo.Default],
}) {}
