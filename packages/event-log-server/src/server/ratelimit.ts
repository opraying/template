import type * as ServerSchema from '@xstack/event-log-server/server/schema'
import * as Context from 'effect/Context'
import type * as Effect from 'effect/Effect'
import type * as Redacted from 'effect/Redacted'

export interface Ratelimit {
  readonly connectCheck: (params: {
    request: Request
    token?: Redacted.Redacted<string> | undefined
  }) => Effect.Effect<boolean, never, never>

  readonly limit: (params: { key: string }) => Effect.Effect<boolean, never, ServerSchema.Tier>
}

export const Ratelimit = Context.GenericTag<Ratelimit>('@local-first:ratelimit')
