import type {
  Blob,
  R2Conditional,
  R2HTTPMetadata,
  R2ListOptions,
  R2Object,
  R2ObjectBody,
  R2Objects,
  R2Range,
  ReadableStream,
} from '@cloudflare/workers-types'
import type { NoSuchElementException } from 'effect/Cause'
import * as Data from 'effect/Data'
import * as Effect from 'effect/Effect'

export const DB_NAME = 's3'

export const R2_ATTRS = {
  KEY: 's3.key',
  HAS_RESULT: 's3.has_result',
  GET: {
    RANGE_START: 's3.get.range_start',
    RANGE_END: 's3.get.range_end',
    CONDITIONAL_ETAG: 's3.get.conditional_etag',
    CONDITIONAL_MODIFIED: 's3.get.conditional_modified',
    CONDITIONAL_UNMODIFIED: 's3.get.conditional_unmodified',
  },
  PUT: {
    CONTENT_TYPE: 's3.put.content_type',
    CONTENT_ENCODING: 's3.put.content_encoding',
    CONTENT_LANGUAGE: 's3.put.content_language',
    CACHE_CONTROL: 's3.put.cache_control',
    CONTENT_DISPOSITION: 's3.put.content_disposition',
    HAS_CUSTOM_METADATA: 's3.put.has_custom_metadata',
  },
  LIST: {
    PREFIX: 's3.list.prefix',
    DELIMITER: 's3.list.delimiter',
    LIMIT: 's3.list.limit',
    CURSOR: 's3.list.cursor',
    TRUNCATED: 's3.list.truncated',
  },
} as const

export class S3Error extends Data.TaggedError('S3Error')<{
  message: string
  cause?: Error | unknown | undefined
}> {}

export interface R2GetOptions {
  onlyIf?: R2Conditional
  range?: R2Range
}

export interface R2PutOptions {
  customMetadata?: Record<string, string>
  httpMetadata?: R2HTTPMetadata
}

/**
 * TODO: A more general definition
 */

export class S3 extends Effect.Tag('@s3')<
  S3,
  {
    readonly get: (
      key: string,
      options?: R2GetOptions,
    ) => Effect.Effect<R2ObjectBody, S3Error | NoSuchElementException, never>

    readonly put: (
      key: string,
      value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob,
      options?: R2PutOptions,
    ) => Effect.Effect<R2Object, S3Error, never>

    readonly delete: (keys: string | string[]) => Effect.Effect<void, S3Error, never>

    readonly list: (options?: R2ListOptions | undefined) => Effect.Effect<R2Objects, S3Error, never>

    readonly head: (key: string) => Effect.Effect<R2Object, S3Error | NoSuchElementException, never>
  }
>() {}
