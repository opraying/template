import { Identity } from '@xstack/event-log'
import { Navigate } from '@xstack/router'
import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'

export const init = Effect.gen(function* () {
  // yield* Scheduler.init

  const navigate = yield* Navigate
  const identity = yield* Identity

  yield* identity.mnemonic.pipe(
    Effect.tap(
      Option.match({
        onNone: () =>
          Effect.gen(function* () {
            yield* identity.createMnemonic()
            yield* navigate.replace('/?onboarding')
          }),
        onSome: () => Effect.void,
      }),
    ),
  )
})
