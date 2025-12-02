import { ToManyRequests, WriteTimeoutError } from '@xstack/event-log/Error'
import type * as EventJournal from '@xstack/event-log/EventJournal'
import type * as Effect from 'effect/Effect'
import type * as Exit from 'effect/Exit'
import type * as Mailbox from 'effect/Mailbox'
import * as Redacted from 'effect/Redacted'
import * as Schema from 'effect/Schema'
import type * as Scope from 'effect/Scope'

export const MessageError = Schema.Union(ToManyRequests)

export const WriteError = Schema.Union(ToManyRequests, WriteTimeoutError)

export type WriteError = Schema.Schema.Type<typeof WriteError>

/**
 * Interface for remote event log operations.
 * Provides methods for subscribing to changes and writing events.
 * @since 1.0.0
 * @category models
 */
export interface EventLogRemote {
  readonly id: EventJournal.RemoteId
  readonly changes: (
    startSequence: number,
  ) => Effect.Effect<Mailbox.ReadonlyMailbox<EventJournal.RemoteEntry>, never, Scope.Scope>
  readonly write: (
    entries: ReadonlyArray<EventJournal.Entry>,
  ) => Effect.Effect<Exit.Exit<void, WriteError>, never, never>
}

export const PublicKey = Schema.StringFromBase64.pipe(Schema.brand('PublicKey'))
export type PublicKey = typeof PublicKey.Type

export class PrivateKey extends Schema.Redacted(Schema.Uint8ArrayFromSelf.pipe(Schema.brand('PrivateKey'))) {
  static make(value: Uint8Array<ArrayBufferLike>) {
    return Redacted.make(value) as Schema.Schema.Type<typeof PrivateKey>
  }
}

export class KeyPair extends Schema.Class<KeyPair>('KeyPair')({
  publicKey: PublicKey,
  privateKey: PrivateKey,
}) {}

export const Mnemonic = Schema.String.pipe(Schema.brand('Mnemonic'))
export type Mnemonic = typeof Mnemonic.Type
