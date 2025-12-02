import * as Predicate from 'effect/Predicate'
import * as Schema from 'effect/Schema'

export type QueryResult = ReadonlyArray<any>

export class WorkerDefect extends Schema.transform(Schema.Unknown, Schema.Unknown, {
  strict: true,
  decode: (u) => {
    if (Predicate.isObject(u) && 'message' in u && typeof u.message === 'string') {
      const err = new Error(u.message, { cause: u })
      if (err.cause) {
        err.cause = undefined
      }
      if ('name' in u && typeof u.name === 'string') {
        err.name = u.name
      }
      err.stack = 'stack' in u && typeof u.stack === 'string' ? u.stack : ''
      return err
    }
    return String(u)
  },
  encode: (defect) => {
    if (defect instanceof Error) {
      return {
        name: defect.name,
        message: defect.message,
        stack: defect.stack,
        cause: defect.cause,
      }
    }
    return String(defect)
  },
}).annotations({ identifier: 'WorkerDefect' }) {}

export class SqlError extends Schema.TaggedError<SqlError>('SqlError')('SqlError', {
  cause: WorkerDefect.pipe(Schema.optionalWith({ exact: true })),
  message: Schema.String.pipe(Schema.optionalWith({ exact: true })),
}) {}

export class WorkerError extends Schema.TaggedError<WorkerError>('WorkerError')('WorkerError', {
  cause: WorkerDefect.pipe(Schema.optionalWith({ exact: true })),
  reason: Schema.Literal('unknown', 'spawn', 'decode', 'send', 'encode'),
}) {}

export const SqliteRunError = Schema.Union(SqlError, WorkerError, WorkerDefect)

const SqliteParamsPrimitive = Schema.Union(
  Schema.String,
  Schema.Number,
  Schema.BigInt,
  Schema.Boolean,
  Schema.Date,
  Schema.Null,
)
const SqliteParams_ = Schema.Array(SqliteParamsPrimitive)
export interface SqliteParams extends Schema.Schema.Type<typeof SqliteParams_> {}
export interface SqliteParamsEncoded extends Schema.Schema.Encoded<typeof SqliteParams_> {}
export const SqliteParams: Schema.Schema<SqliteParams, SqliteParamsEncoded> = SqliteParams_

const SqliteRows_ = Schema.Array(
  Schema.Union(
    // [[col1, value2], [col1, value2]]
    Schema.Array(Schema.Any),
    // [{}, {}]
    Schema.Object,
  ),
)
export interface SqliteRows extends Schema.Schema.Type<typeof SqliteRows_> {}
export interface SqliteRowsEncoded extends Schema.Schema.Encoded<typeof SqliteRows_> {}
export const SqliteRows: Schema.Schema<SqliteRows, SqliteRowsEncoded> = SqliteRows_

export const SqliteRowMode = Schema.Literal('array', 'object')
export type SqliteRowMode = typeof SqliteRowMode.Type

export const SqliteQueryParams = Schema.Struct({
  sql: Schema.String,
  params: Schema.Any as typeof SqliteParams,
  rowMode: SqliteRowMode,
})
export type SqliteQueryParams = typeof SqliteQueryParams.Type

export class SqliteQueryExecute extends Schema.TaggedRequest<SqliteQueryExecute>()('SqliteQueryExecute', {
  failure: SqliteRunError,
  success: Schema.Any as typeof SqliteRows,
  payload: {
    ...SqliteQueryParams.fields,
  },
}) {}

export class SqliteQueryStreamExecute extends Schema.TaggedRequest<SqliteQueryStreamExecute>()(
  'SqliteQueryStreamExecute',
  {
    failure: SqliteRunError,
    success: Schema.Object,
    payload: {
      sql: Schema.String,
      params: SqliteParams,
    },
  },
) {}

export class SqliteExportExecute extends Schema.TaggedRequest<SqliteExportExecute>()('SqliteExportExecute', {
  failure: SqliteRunError,
  success: Schema.Uint8ArrayFromSelf,
  payload: {},
}) {}

export class SqliteImportExecute extends Schema.TaggedRequest<SqliteImportExecute>()('SqliteImportExecute', {
  failure: SqliteRunError,
  success: Schema.Void,
  payload: {
    data: Schema.Uint8ArrayFromSelf,
  },
}) {}

export class SqliteStorageSize extends Schema.TaggedRequest<SqliteStorageSize>()('SqliteStorageSize', {
  failure: SqliteRunError,
  success: Schema.Number,
  payload: {},
}) {}

export class SqliteQueryStream extends Schema.TaggedRequest<SqliteQueryStream>()('SqliteQueryStream', {
  failure: SqliteRunError,
  success: Schema.UndefinedOr(Schema.Object),
  payload: {
    sql: Schema.String,
    params: SqliteParams,
    index: Schema.Number,
  },
}) {}

export class SqliteUpdateHookEvent extends Schema.TaggedClass<SqliteUpdateHookEvent>('SqliteUpdateHookEvent')(
  'SqliteUpdateHookEvent',
  {
    op: Schema.Number,
    db: Schema.String,
    table: Schema.String,
    rowid: Schema.String,
  },
) {}

export class SqliteLockChangeHookEvent extends Schema.TaggedClass<SqliteLockChangeHookEvent>(
  'SqliteLockChangeHookEvent',
)('SqliteLockChangeHookEvent', {
  lockAcquire: Schema.Boolean,
}) {}

export const SqliteUpdateEvent = Schema.Union(SqliteUpdateHookEvent, SqliteLockChangeHookEvent)
export type SqliteUpdateEvent = typeof SqliteUpdateEvent.Type

export class SqliteWorkerReadyEvent extends Schema.TaggedRequest<SqliteWorkerReadyEvent>()('SqliteWorkerReadyEvent', {
  failure: WorkerDefect,
  success: Schema.Struct({
    state: Schema.Literal('alive', 'unknown'),
  }),
  payload: {},
}) {}

/**
 * Worker 内的 sqlite event notification
 **/
export class SqliteStreamEvent extends Schema.TaggedRequest<SqliteStreamEvent>()('SqliteStreamEvent', {
  failure: Schema.Never,
  success: SqliteUpdateEvent,
  payload: {},
}) {}

export const SqliteBroadcastEvent = Schema.Union(SqliteUpdateHookEvent)

export class SqliteBroadcastUpdates extends Schema.TaggedRequest<SqliteBroadcastUpdates>()('SqliteBroadcastUpdates', {
  failure: WorkerDefect,
  success: Schema.String,
  payload: {
    event: SqliteBroadcastEvent,
  },
}) {}

export const SqliteEvent = Schema.Union(
  SqliteQueryExecute,
  SqliteQueryStreamExecute,
  SqliteExportExecute,
  SqliteImportExecute,
  SqliteStorageSize,
  SqliteStreamEvent,
)
export type SqliteEvent = typeof SqliteEvent.Type
