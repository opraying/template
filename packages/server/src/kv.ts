import type {
  KVNamespaceGetWithMetadataResult,
  KVNamespaceListOptions,
  KVNamespaceListResult,
  KVNamespacePutOptions,
} from '@cloudflare/workers-types'
import type { NoSuchElementException } from 'effect/Cause'
import * as Data from 'effect/Data'
import * as DateTime from 'effect/DateTime'
import * as Duration from 'effect/Duration'
import * as Effect from 'effect/Effect'
import { flow } from 'effect/Function'

export const DB_NAME = 'kv'

export const KV_ATTRS = {
  TYPE: 'kv.type',
  CACHE_TTL: 'kv.cache_ttl',
  CACHE_STATUS: 'kv.cache_status',
  HAS_RESULT: 'kv.has_result',
  KEY: 'kv.key',
  METADATA: 'kv.metadata',
  EXPIRATION: 'kv.expiration',
  EXPIRATION_TTL: 'kv.expiration_ttl',
  LIST: {
    REQUEST_CURSOR: 'kv.list_request_cursor',
    RESPONSE_CURSOR: 'kv.list_response_cursor',
    LIMIT: 'kv.list_limit',
    COMPLETE: 'kv.list_complete',
  },
} as const

export class KVError extends Data.TaggedError('KVError')<{
  message: string
  cause?: Error | undefined
}> {}

export interface KVGetOptions {
  cacheTtl?: number
}

/**
 * TODO: A more general definition
 */

export class KV extends Effect.Tag('@kv')<
  KV,
  {
    readonly get: (
      key: string,
      options?: KVGetOptions,
    ) => Effect.Effect<string, KVError | NoSuchElementException, never>

    readonly getJson: (
      key: string,
      options?: KVGetOptions,
    ) => Effect.Effect<string, KVError | NoSuchElementException, never>

    readonly getArrayBuffer: (
      key: string,
      options?: KVGetOptions,
    ) => Effect.Effect<string, KVError | NoSuchElementException, never>

    readonly getStream: <T = unknown>(
      key: string,
      options?: KVGetOptions,
    ) => Effect.Effect<ReadableStream<T>, KVError | NoSuchElementException, never>

    readonly list: <_Metadata = unknown>(
      options?: KVNamespaceListOptions | undefined,
    ) => Effect.Effect<KVNamespaceListResult<ReadableStream, string>, KVError, never>

    readonly put: (
      key: string,
      value: string | ArrayBuffer | ArrayBufferView<ArrayBufferLike> | ReadableStream<any>,
      options?: KVNamespacePutOptions | undefined,
    ) => Effect.Effect<void, KVError, never>

    readonly delete: (key: string) => Effect.Effect<void, KVError, never>

    readonly metadata: {
      get: (
        key: string,
        options?: KVGetOptions,
      ) => Effect.Effect<KVNamespaceGetWithMetadataResult<string, any>, KVError, never>

      getJson: (
        key: string,
        options?: KVGetOptions,
      ) => Effect.Effect<KVNamespaceGetWithMetadataResult<string, any>, KVError, never>

      getArrayBuffer: (
        key: string,
        options?: KVGetOptions,
      ) => Effect.Effect<KVNamespaceGetWithMetadataResult<ArrayBuffer, any>, KVError, never>

      getStream: <T = unknown>(
        key: string,
        options?: KVGetOptions,
      ) => Effect.Effect<KVNamespaceGetWithMetadataResult<ReadableStream<T>, unknown>, KVError, never>
    }
  }
>() {
  static getExpiration = (duration: Duration.DurationInput) =>
    DateTime.now.pipe(
      Effect.map(
        flow(DateTime.add({ seconds: Duration.toSeconds(duration) }), DateTime.toEpochMillis, (_) =>
          Math.floor(_ / 1000),
        ),
      ),
    )
}
