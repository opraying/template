import * as Effect from 'effect/Effect'
import { globalValue } from 'effect/GlobalValue'
import * as Option from 'effect/Option'
import type * as Redacted from 'effect/Redacted'
import * as SubscriptionRef from 'effect/SubscriptionRef'

export const GlobalAccessToken = globalValue('@x/global-access-token', () =>
  Effect.runSync(SubscriptionRef.make(Option.none<Redacted.Redacted<string>>())),
)

export class WorkerSession extends Effect.Service<WorkerSession>()('WorkerSession', {
  accessors: true,
  effect: Effect.gen(function* () {
    const changes = GlobalAccessToken.changes

    return {
      changes,
    }
  }),
  dependencies: [],
}) {}
