import * as MsgPack from '@xstack/event-log/MsgPack'
import * as Context from 'effect/Context'
import * as DateTime from 'effect/DateTime'
import type * as Effect from 'effect/Effect'
import type * as Queue from 'effect/Queue'
import * as Schema from 'effect/Schema'
import type { Scope } from 'effect/Scope'
import * as Uuid from 'uuid'

/**
 * Error type for EventJournal operations
 * @since 1.0.0
 * @category errors
 */
export const ErrorTypeId: unique symbol = Symbol.for('@xstack/event-log/EventJournal/ErrorId')

/**
 * @since 1.0.0
 * @category errors
 */
export type ErrorTypeId = typeof ErrorTypeId

/**
 * @since 1.0.0
 * @category errors
 */
export class EventJournalError extends Schema.TaggedError<EventJournalError>('@xstack/event-log/EventJournal/Error')(
  'EventJournalError',
  {
    method: Schema.String,
    cause: Schema.Defect,
  },
) {
  /**
   * @since 1.0.0
   */
  readonly [ErrorTypeId]: ErrorTypeId = ErrorTypeId
}

/**
 * EventJournal is a core module that provides event sourcing capabilities.
 * It manages the storage and retrieval of events, supporting both local and remote synchronization.
 *
 * @since 1.0.0
 */
export class EventJournal extends Context.Tag('@xstack/event-log/EventJournal')<
  EventJournal,
  {
    /**
     * Read all the entries in the journal.
     * Retrieves the complete history of events in chronological order.
     */
    readonly entries: Effect.Effect<ReadonlyArray<Entry>, EventJournalError>

    /**
     * Write an event to the journal, performing an effect before committing.
     * This ensures atomic operations where both the effect and event write succeed or fail together.
     */
    readonly write: <A, E, R>(options: {
      readonly event: string
      readonly primaryKey: string
      readonly payload: Uint8Array<ArrayBufferLike>
      readonly effect: (entry: Entry) => Effect.Effect<A, E, R>
    }) => Effect.Effect<A, EventJournalError | E, R>

    /**
     * Write events from a remote source to the journal.
     * Handles conflict resolution and maintains remote sequence numbers.
     */
    readonly writeFromRemote: (options: {
      readonly remoteId: RemoteId
      readonly entries: ReadonlyArray<RemoteEntry>
      readonly compact?:
        | ((
            uncommitted: ReadonlyArray<RemoteEntry>,
          ) => Effect.Effect<
            ReadonlyArray<[compacted: ReadonlyArray<Entry>, remoteEntries: ReadonlyArray<RemoteEntry>]>,
            EventJournalError
          >)
        | undefined
      readonly effect: (options: {
        readonly entry: Entry
        readonly conflicts: ReadonlyArray<Entry>
      }) => Effect.Effect<void, EventJournalError>
    }) => Effect.Effect<void, EventJournalError>

    /**
     * Return the uncommitted entries for a remote source.
     * Used for synchronization to determine which entries need to be sent to remote.
     */
    readonly withRemoteUncommited: <A, E, R>(
      remoteId: RemoteId,
      f: (entries: ReadonlyArray<Entry>) => Effect.Effect<A, E, R>,
    ) => Effect.Effect<A, EventJournalError | E, R>

    /**
     * Retrieve the last known sequence number for a remote source.
     * Used to track synchronization progress with remote sources.
     */
    readonly nextRemoteSequence: (remoteId: RemoteId) => Effect.Effect<number, EventJournalError>

    /**
     * Subscribe to changes in the journal.
     * Provides real-time notifications of new entries.
     */
    readonly changes: Effect.Effect<Queue.Dequeue<Entry>, never, Scope>

    /**
     * Remove all data from the journal.
     * Use with caution as this is irreversible.
     */
    readonly destroy: Effect.Effect<void, EventJournalError>
  }
>() {}

/**
 * Unique identifier for remote connections
 * @since 1.0.0
 * @category remote
 */
export const RemoteIdTypeId: unique symbol = Symbol.for('@xstack/event-log/EventJournal/RemoteId')

/**
 * @since 1.0.0
 * @category remote
 */
export const RemoteId = Schema.Uint8ArrayFromSelf.pipe(Schema.brand(RemoteIdTypeId))

/**
 * @since 1.0.0
 * @category remote
 */
export type RemoteId = typeof RemoteId.Type

/**
 * Create a new remote ID
 * @since 1.0.0
 * @category remote
 */
export const makeRemoteId = (): RemoteId => Uuid.v4({}, new Uint8Array(16)) as RemoteId

/**
 * Unique identifier for journal entries
 * @since 1.0.0
 * @category entry
 */
export const EntryIdTypeId: unique symbol = Symbol.for('@xstack/event-log/EventJournal/EntryId')

/**
 * @since 1.0.0
 * @category entry
 */
export const EntryId = Schema.Uint8ArrayFromSelf.pipe(Schema.brand(EntryIdTypeId))

/**
 * @since 1.0.0
 * @category entry
 */
export type EntryId = typeof EntryId.Type

/**
 * Create a new entry ID with timestamp
 * @since 1.0.0
 * @category entry
 */
export const makeEntryId = (options: { msecs?: number } = {}): EntryId => {
  return Uuid.v7(options, new Uint8Array(16)) as EntryId
}

/**
 * Extract timestamp from entry ID
 * @since 1.0.0
 * @category entry
 */
export const entryIdMillis = (entryId: EntryId): number => {
  const bytes = new Uint8Array(8)
  bytes.set(entryId.subarray(0, 6), 2)
  return Number(new DataView(bytes.buffer).getBigUint64(0))
}

/**
 * Represents an event entry in the journal
 * @since 1.0.0
 * @category entry
 */
export class Entry extends Schema.Class<Entry>('@xstack/event-log/EventJournal/Entry')({
  id: EntryId,
  event: Schema.String,
  primaryKey: Schema.String,
  payload: Schema.Uint8ArrayFromSelf,
}) {
  /**
   * Schema for array of entries with MsgPack encoding
   * @since 1.0.0
   */
  static arrayMsgPack = Schema.Array(MsgPack.schema(Entry))

  /**
   * Encode array of entries to MsgPack format
   * @since 1.0.0
   */
  static encodeArray = Schema.encode(Entry.arrayMsgPack)

  /**
   * Decode array of entries from MsgPack format
   * @since 1.0.0
   */
  static decodeArray = Schema.decode(Entry.arrayMsgPack)

  /**
   * Get string representation of entry ID
   * @since 1.0.0
   */
  get idString(): string {
    return Uuid.stringify(this.id)
  }

  /**
   * Get timestamp in milliseconds
   * @since 1.0.0
   */
  get createdAtMillis(): number {
    return entryIdMillis(this.id)
  }

  /**
   * Get creation timestamp as DateTime
   * @since 1.0.0
   */
  get createdAt(): DateTime.Utc {
    return DateTime.unsafeMake(this.createdAtMillis)
  }
}

/**
 * Remote entry with sequence number
 * @since 1.0.0
 * @category entry
 */
export class RemoteEntry extends Schema.Class<RemoteEntry>('@xstack/event-log/EventJournal/RemoteEntry')({
  remoteSequence: Schema.Number,
  entry: Entry,
}) {}
