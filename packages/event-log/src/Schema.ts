import { InvalidMnemonicError, ToManyRequests, WriteTimeoutError, WriteUnknownError } from '@xstack/event-log/Error'
import * as EventJournal from '@xstack/event-log/EventJournal'
import { Mnemonic, PrivateKey, PublicKey } from '@xstack/event-log/Types'
import * as Effect from 'effect/Effect'
import type * as Exit from 'effect/Exit'
import * as ParseResult from 'effect/ParseResult'
import * as Schema from 'effect/Schema'

/**
 * 客户端设备信息
 * @since 1.0.0
 * @category protocol
 */
export class ConnectedDevice extends Schema.Class<ConnectedDevice>('ConnectedDevice')({
  id: Schema.String,
  browser: Schema.Literal('chrome', 'firefox', 'safari', 'edge', 'opera', 'ie', 'other').pipe(
    Schema.optional,
    Schema.withDefaults({
      constructor: () => 'other' as const,
      decoding: () => 'other' as const,
    }),
  ),
  type: Schema.Literal('mobile', 'tablet', 'desktop'),
  os: Schema.Literal('ios', 'android', 'windows', 'macos', 'linux', 'other'),
  lastSeenAt: Schema.Date.pipe(
    Schema.optional,
    Schema.withDefaults({
      constructor: () => new Date(),
      decoding: () => new Date(),
    }),
  ),
}) {}

export class StoragePublicKeyItem extends Schema.Class<StoragePublicKeyItem>('StoragePublicKeyItem')({
  /**
   * 备注
   */
  note: Schema.String.pipe(
    Schema.optional,
    Schema.withDefaults({
      constructor: () => '',
      decoding: () => '',
    }),
  ),
  /**
   * 公钥 hash
   */
  publicKey: Schema.String,
  /**
   * 同步状态
   */
  synced: Schema.Boolean.pipe(
    Schema.propertySignature,
    Schema.withConstructorDefault(() => false),
  ),
  /**
   * 最后同步时间
   */
  lastSyncedAt: Schema.DateFromSelf.pipe(Schema.UndefinedOr),
  /**
   * 同步次数
   */
  syncCount: Schema.Number.pipe(
    Schema.propertySignature,
    Schema.withConstructorDefault(() => 0),
  ),
  /**
   * 已使用空间
   */
  usedStorageSize: Schema.Number.pipe(
    Schema.propertySignature,
    Schema.withConstructorDefault(() => 0),
  ),
  /**
   * 最大空间
   */
  maxStorageSize: Schema.Number.pipe(
    Schema.propertySignature,
    Schema.withConstructorDefault(() => 0),
  ),
  /**
   * 创建时间
   */
  createdAt: Schema.DateFromSelf,
  /**
   * 更新时间
   */
  updatedAt: Schema.DateFromSelf,
}) {
  static decodeMany = Schema.decodeUnknownSync(Schema.Array(StoragePublicKeyItem))
}

export const RemotePublicKeyItem = Schema.Struct({
  /**
   * 备注
   */
  note: Schema.String,
  /**
   * 公钥 hash
   */
  publicKey: Schema.String,
  /**
   * 最后同步时间
   */
  lastSyncedAt: Schema.Date,
  /**
   * 同步次数
   */
  syncCount: Schema.Number,
  /**
   * 已使用空间
   */
  usedStorageSize: Schema.Number,
  /**
   * 最大空间
   */
  maxStorageSize: Schema.Number,
  /**
   * 创建时间
   */
  createdAt: Schema.Date,
  /**
   * 更新时间
   */
  updatedAt: Schema.Date,
})

/**
 * 远端同步状态
 */
export const RemotePublicKeySyncStats = Schema.Struct({
  /**
   * 最后同步时间
   */
  lastSyncAt: Schema.optional(Schema.Date),
  /**
   * 同步次数
   */
  syncCount: Schema.Number,
  /**
   * 已使用空间
   */
  usedStorageSize: Schema.Number,
  /**
   * 最大空间
   */
  maxStorageSize: Schema.Number,
})

// -----

export class EventLogWriteRequest extends Schema.TaggedRequest<EventLogWriteRequest>()('EventLogWriteRequest', {
  failure: Schema.Defect,
  success: Schema.Any,
  payload: {
    event: Schema.Any,
    payload: Schema.Any,
  },
}) {}

export class EventLogEntriesRequest extends Schema.TaggedRequest<EventLogEntriesRequest>()('EventLogEntriesRequest', {
  failure: EventJournal.EventJournalError,
  success: Schema.Array(EventJournal.Entry),
  payload: {},
}) {}

// -----

export class GetMnemonicEvent extends Schema.TaggedRequest<GetMnemonicEvent>()('GetMnemonicEvent', {
  failure: Schema.Never,
  success: Schema.Option(Schema.Redacted(Mnemonic)),
  payload: {},
}) {}

export class ParseMnemonicEvent extends Schema.TaggedRequest<ParseMnemonicEvent>()('ParseMnemonicEvent', {
  failure: InvalidMnemonicError,
  success: Schema.Void,
  payload: {
    mnemonic: Schema.Union(Schema.Redacted(Mnemonic), Schema.Redacted(Schema.String)),
  },
}) {}

export class RandomMnemonicEvent extends Schema.TaggedRequest<RandomMnemonicEvent>()('RandomMnemonicEvent', {
  failure: Schema.Never,
  success: Schema.Redacted(Mnemonic),
  payload: {},
}) {}

export class ImportFromMnemonicEvent extends Schema.TaggedRequest<ImportFromMnemonicEvent>()(
  'ImportFromMnemonicEvent',
  {
    failure: InvalidMnemonicError,
    success: Schema.Void,
    payload: {
      mnemonic: Schema.Union(Schema.Redacted(Mnemonic), Schema.Redacted(Schema.String)),
      data: Schema.Struct({ note: Schema.String }).pipe(Schema.optional),
    },
  },
) {}

export class CreateMnemonicEvent extends Schema.TaggedRequest<CreateMnemonicEvent>()('CreateMnemonicEvent', {
  failure: Schema.Never,
  success: Schema.Void,
  payload: {},
}) {}

const IdentityPayload = Schema.Struct({
  publicKey: PublicKey,
  privateKey: PrivateKey,
})

export class GetIdentityEvent extends Schema.TaggedRequest<GetIdentityEvent>()('GetIdentityEvent', {
  failure: Schema.Never,
  success: Schema.Option(IdentityPayload),
  payload: {},
}) {}

export class ClearEvent extends Schema.TaggedRequest<ClearEvent>()('ClearEvent', {
  failure: Schema.Never,
  success: Schema.Void,
  payload: {},
}) {}

// -----

export class PublicKeyStream extends Schema.TaggedRequest<PublicKeyStream>()('PublicKeyStream', {
  failure: Schema.Never,
  success: Schema.String,
  payload: {},
}) {}

export class SyncPublicKeys extends Schema.TaggedRequest<SyncPublicKeys>()('SyncPublicKeys', {
  failure: Schema.Never,
  success: Schema.Void,
  payload: {},
}) {}

export class SyncPublicKey extends Schema.TaggedRequest<SyncPublicKey>()('SyncPublicKey', {
  failure: Schema.Never,
  success: Schema.Option(RemotePublicKeySyncStats),
  payload: {
    publicKey: Schema.String,
  },
}) {}

export class UpsertPublicKey extends Schema.TaggedRequest<UpsertPublicKey>()('UpsertPublicKey', {
  failure: Schema.Never,
  success: Schema.Void,
  payload: {
    publicKey: Schema.String,
    data: Schema.Struct({
      synced: Schema.Boolean.pipe(Schema.optionalWith({ exact: true })),
      lastSyncedAt: Schema.Date.pipe(Schema.UndefinedOr, Schema.optionalWith({ exact: true })),
      syncCount: Schema.Number.pipe(Schema.optionalWith({ exact: true })),
      usedStorageSize: Schema.Number.pipe(Schema.optionalWith({ exact: true })),
      maxStorageSize: Schema.Number.pipe(Schema.optionalWith({ exact: true })),
    }),
  },
}) {}

export class UpdatePublicKey extends Schema.TaggedRequest<UpdatePublicKey>()('UpdatePublicKey', {
  failure: Schema.Never,
  success: Schema.Void,
  payload: {
    publicKey: Schema.String,
    data: Schema.Struct({
      note: Schema.String,
    }),
  },
}) {}

export class DeletePublicKey extends Schema.TaggedRequest<DeletePublicKey>()('DeletePublicKey', {
  failure: Schema.Never,
  success: Schema.Void,
  payload: {
    publicKey: Schema.String,
  },
}) {}

export class GetAllPublicKeyStream extends Schema.TaggedRequest<GetAllPublicKeyStream>()('GetAllPublicKeyStream', {
  failure: Schema.Never,
  success: Schema.Array(StoragePublicKeyItem),
  payload: {},
}) {}

// ----- Audit -----

export interface AuditSyncEvents {
  type: 'sync'
  result: 'ok' | 'error'
  error?: string
}

export interface AuditGenerateMnemonicEvent {
  type: 'generate-mnemonic'
}

export interface AuditImportFromMnemonicEvent {
  type: 'import-mnemonic'
}

// ----- Event log event -----

const syncEvents = {
  staring: Schema.TaggedStruct('starting', {}),
  end: Schema.TaggedStruct('end', {
    exit: Schema.Exit({
      defect: Schema.Defect,
      failure: Schema.Union(ToManyRequests, WriteTimeoutError, WriteUnknownError, EventJournal.EventJournalError),
      success: Schema.Void,
    }),
  }),
}

export class SyncEvents extends Schema.TaggedRequest<SyncEvents>()('SyncEvents', {
  failure: Schema.Never,
  success: Schema.Void,
  payload: {
    payload: Schema.Union(syncEvents.staring, syncEvents.end),
  },
}) {
  static is = Schema.is(SyncEvents)

  static get SyncStart() {
    return new SyncEvents({ payload: syncEvents.staring.make({}) })
  }

  static SyncEnd = <E extends ToManyRequests | WriteTimeoutError | WriteUnknownError>(exit: Exit.Exit<void, E>) =>
    new SyncEvents({ payload: syncEvents.end.make({ exit }) })
}

export const EventLogEvent = Schema.Union(SyncEvents)
export type EventLogEvent = typeof EventLogEvent.Type

/**
 * Worker 内的 eventlog event
 **/
export class EventLogEventStreamEvent extends Schema.TaggedRequest<EventLogEventStreamEvent>()(
  'EventLogEventStreamEvent',
  {
    failure: Schema.Never,
    success: EventLogEvent,
    payload: {},
  },
) {}

export const LocalFirstEvent = Schema.Union(
  EventLogWriteRequest,
  EventLogEntriesRequest,

  // ----- Mnemonic -----

  GetMnemonicEvent,
  ParseMnemonicEvent,
  RandomMnemonicEvent,
  ImportFromMnemonicEvent,
  CreateMnemonicEvent,
  GetIdentityEvent,
  ClearEvent,

  // ----- Public Key -----

  PublicKeyStream,
  SyncPublicKeys,
  SyncPublicKey,
  UpsertPublicKey,
  UpdatePublicKey,
  DeletePublicKey,
  GetAllPublicKeyStream,

  EventLogEventStreamEvent,
)
export type LocalFirstEvent = typeof LocalFirstEvent.Type

export const RpcHeaders = Schema.transformOrFail(
  Schema.Any,
  Schema.Struct({
    namespace: Schema.String,
    publicKey: Schema.NonEmptyString.annotations({
      message: () => 'Public key is required',
    }),
  }),
  {
    decode(fa: { get: (key: string) => any }) {
      return Effect.try({
        try: () => {
          const namespace = fa.get('x-namespace')
          const publicKey = fa.get('x-public-key')

          if (!namespace || !publicKey) {
            throw new Error('Invalid params')
          }

          return {
            namespace,
            publicKey,
          }
        },
        catch: () => {
          return new ParseResult.Unexpected(fa, 'Invalid query string')
        },
      })
    },
    encode(ti) {
      return Effect.succeed(ti)
    },
  },
)

export const RpcQueryParams = Schema.transformOrFail(
  Schema.String.annotations({
    message: () => 'Invalid query string',
  }),
  Schema.Struct({
    namespace: Schema.String,
    publicKey: Schema.NonEmptyString.annotations({
      message: () => 'Public key is required',
    }),
    token: Schema.NonEmptyString.pipe(
      Schema.annotations({
        message: () => 'Token is required',
      }),
      Schema.Redacted,
    ),
  }),
  {
    decode(fa) {
      return Effect.try({
        try: () => {
          const [namespace, publicKey, token] = atob(fa).split(':')
          return {
            namespace,
            publicKey,
            token,
          }
        },
        catch: () => {
          return new ParseResult.Unexpected(fa, 'Invalid query string')
        },
      })
    },
    encode(ti) {
      return Effect.succeed(atob(`${ti.namespace}:${ti.publicKey}:${ti.token}`))
    },
  },
)
