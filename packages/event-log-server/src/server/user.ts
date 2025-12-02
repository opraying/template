import type * as ServerSchema from '@xstack/event-log-server/server/schema'
import * as Context from 'effect/Context'
import type * as Effect from 'effect/Effect'
import type * as Option from 'effect/Option'
import type * as Redacted from 'effect/Redacted'

export const Tier = Context.GenericTag<ServerSchema.Tier>('@local-first:tier')
export type Tier = ServerSchema.Tier

export interface Authentication {
  readonly fromToken: (_: {
    namespace: string
    token: Redacted.Redacted<string>
  }) => Effect.Effect<Option.Option<ServerSchema.UserSession>, never>

  readonly fromRequest: (request: Request) => Effect.Effect<Option.Option<ServerSchema.UserSession>, never>
}

export const Authentication = Context.GenericTag<Authentication>('@local-first:authentication')
