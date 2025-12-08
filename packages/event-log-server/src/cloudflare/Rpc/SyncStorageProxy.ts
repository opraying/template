import * as Rpc from '@effect/rpc/Rpc'
import * as RpcClient from '@effect/rpc/RpcClient'
import * as RpcGroup from '@effect/rpc/RpcGroup'
import * as RpcSerialization from '@effect/rpc/RpcSerialization'
import * as SqlError from '@effect/sql/SqlError'
import { CloudflareBindings } from '@xstack/cloudflare/bindings'
import * as SqlDoProxy from '@xstack/sql-do-proxy/SqlClient'
import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import * as Option from 'effect/Option'
import * as Schema from 'effect/Schema'
import * as RpcClient_ from './Client'

// string
// number
// Uint8Array
// null
const SqlValue = Schema.Union(Schema.String, Schema.Number, Schema.Uint8Array, Schema.Null)

// string
// number
// bigint
// boolean
// Date
// null
// Int8Array
// Uint8Array
const SqlBinding = Schema.Union(
  Schema.String,
  Schema.Number,
  Schema.BigInt,
  Schema.Boolean,
  Schema.Date,
  Schema.Null,
  Schema.Uint8Array,
)

export const SqlExecPayload = Schema.Struct({
  sql: Schema.String,
  bindings: Schema.Array(SqlBinding),
})

// [
//  [
//    'table',
//    'Cooking',
//    false,
//    2,
//    'CREATE TABLE Test (\n' +
//      '          id TEXT PRIMARY KEY,\n' +
//      '          name TEXT,\n' +
//      '          COMPLETED BOOLEAN\n' +
//      '        )'
//  ]
// ]

export const SqlRawResult = Schema.Struct({
  columnNames: Schema.Array(Schema.String),
  raw: Schema.Array(Schema.Array(SqlValue)),
})

export const DatabaseInfoResult = Schema.Struct({
  databaseSize: Schema.Number,
})

export class ExecError extends Schema.TaggedError<ExecError>('ExecError')('ExecError', {
  message: Schema.String,
  cause: Schema.Defect,
}) {}

export const SerializationLive = RpcSerialization.layerMsgPack

export class StorageProxyRpcs extends RpcGroup.make(
  Rpc.make('Exec', {
    payload: SqlExecPayload,
    success: SqlRawResult,
    error: ExecError,
  }),
  Rpc.make('DatabaseInfo', {
    success: DatabaseInfoResult,
  }),
  Rpc.make('Destroy', {
    success: Schema.Void,
  }),
) {}

const Client = RpcClient.make(StorageProxyRpcs).pipe(
  Effect.provide(pipe(RpcClient_.layerProtocolSocket(), Layer.provide(SerializationLive))),
)

export interface SyncStorageProxyConfig {
  binding: string
  rpcPath: string
}
export const SyncStorageProxyConfig = Context.GenericTag<SyncStorageProxyConfig>(
  '@xstack/event-log-server/RpcClient/SyncStorageProxyConfig',
)

export class SyncStorageProxyClient extends Context.Tag('@xstack/event-log-server/RpcClient/SyncStorageProxyClient')<
  SyncStorageProxyClient,
  {
    exec: (query: {
      sql: string
      bindings: SqlStorageValue[]
    }) => Effect.Effect<typeof SqlRawResult.Type, SqlError.SqlError, never>

    databaseInfo: () => Effect.Effect<{ databaseSize: number }, SqlError.SqlError, never>
  }
>() {
  static Live = Layer.scoped(
    this,
    Effect.gen(function* () {
      const config = yield* SyncStorageProxyConfig
      const binding = yield* CloudflareBindings.use((_) => _.getFetcher(config.binding)).pipe(
        Effect.flatMap(
          Option.match({
            onNone: () => Effect.dieMessage(`No binding found for ${config.binding}`),
            onSome: Effect.succeed,
          }),
        ),
      )

      const rpcClientRef = yield* RpcClient_.makeFetchFromWebsocket(binding.fetch, Client, {
        rpcPath: config.rpcPath,
      })

      const exec = Effect.fn(
        function* ({ sql, bindings }: { sql: string; bindings: SqlStorageValue[] }) {
          const client = yield* rpcClientRef.get
          return yield* client.Exec({ sql, bindings: bindings as any })
        },
        Effect.scoped,
        Effect.catchAll((e) => {
          if (e?._tag === ExecError._tag) {
            return new SqlError.SqlError({ message: e.message, cause: e.cause })
          }
          return new SqlError.SqlError({ cause: e })
        }),
      )

      const databaseInfo = Effect.fn(
        function* () {
          const client = yield* rpcClientRef.get
          return yield* client.DatabaseInfo()
        },
        Effect.scoped,
        Effect.catchAll((e) => new SqlError.SqlError({ cause: e })),
      )

      return {
        exec,
        databaseInfo,
      }
    }),
  )
}

export const SqlProxyLive = SqlDoProxy.effect(
  Effect.gen(function* () {
    const storageProxy = yield* SyncStorageProxyClient

    return {
      query: Effect.fn(function* (sql, ...bindings) {
        return yield* storageProxy.exec({ sql, bindings: bindings as any })
      }),
      databaseSize: Effect.fn(function* () {
        const { databaseSize } = yield* storageProxy.databaseInfo()
        return databaseSize
      }),
    }
  }),
).pipe(Layer.provide(SyncStorageProxyClient.Live))
