import * as Context from 'effect/Context'
import type * as Effect from 'effect/Effect'
import type * as Option from 'effect/Option'

export type Params = {
  namespace: string
  userId: string
  publicKey: string
}

export interface DestroyVault {
  // [TODO] rename to exist
  readonly get: (params: Params) => Effect.Effect<Option.Option<any>, never>

  // [TODO] rename to retrieve
  readonly access: (params: Params) => Effect.Effect<void, never>

  readonly destroy: (params: Params) => Effect.Effect<void, never>
}

export const DestroyVault = Context.GenericTag<DestroyVault>('@local-first:destroy-vault')
