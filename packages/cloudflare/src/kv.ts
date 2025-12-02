import type {
  KVNamespace,
  KVNamespaceGetOptions,
  KVNamespaceGetWithMetadataResult,
  KVNamespaceListResult,
  KVNamespacePutOptions,
} from '@cloudflare/workers-types'
import {
  ATTR_DB_NAMESPACE,
  ATTR_DB_OPERATION_NAME,
  ATTR_DB_QUERY_TEXT,
  ATTR_DB_SYSTEM,
} from '@opentelemetry/semantic-conventions/incubating'
import { CloudflareBindings } from '@xstack/cloudflare/bindings'
import { DB_NAME, KV, KV_ATTRS, KVError, type KVGetOptions } from '@xstack/server/kv'
import * as Effect from 'effect/Effect'
import { type LazyArg, pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import * as Option from 'effect/Option'
import * as RcRef from 'effect/RcRef'

const DB_SYSTEM = 'Cloudflare KV'

const make = Effect.fnUntraced(function* (bindingName: LazyArg<string>) {
  const acquire = CloudflareBindings.use((bindings) => bindings.getKVNamespace(bindingName())).pipe(
    Effect.flatMap(
      Option.match({
        onNone: () => Effect.dieMessage(`KV Namespace ${bindingName} not found`),
        onSome: Effect.succeed,
      }),
    ),
  )
  const kvRef = yield* RcRef.make({ acquire, idleTimeToLive: 100 })

  const catcher = (cause: any) => new KVError({ message: 'kv call error', cause })

  const wrap =
    <A, Args extends any[]>(
      f: (_: KVNamespace) => (...args: Args) => Promise<A>,
      operation: string,
      getExtraAttributes?: (args: Args, result?: A) => Record<string, any>,
    ) =>
    (...args: Args) => {
      const spanName = `kv.${operation}`
      const baseAttributes = {
        [ATTR_DB_OPERATION_NAME]: operation,
        [ATTR_DB_SYSTEM]: DB_SYSTEM,
        [ATTR_DB_NAMESPACE]: DB_NAME,
        binding_type: 'KV',
      } as Record<string, any>

      if (operation !== 'list') {
        baseAttributes[ATTR_DB_QUERY_TEXT] = `${operation} ${args[0]}`
        baseAttributes[KV_ATTRS.KEY] = args[0]
      }

      return pipe(
        kvRef.get,
        Effect.flatMap((kv) =>
          Effect.tryPromise({
            try: () => f(kv).apply(kv, args),
            catch: catcher,
          }),
        ),
        Effect.tap((result) => {
          const extraAttrs = getExtraAttributes?.(args, result) || {}
          const hasResult = operation === 'getWithMetadata' ? !!(result && (result as any).value) : !!result

          return Effect.annotateCurrentSpan({
            ...extraAttrs,
            [KV_ATTRS.HAS_RESULT]: hasResult,
          })
        }),
        Effect.withSpan(spanName, {
          attributes: baseAttributes,
        }),
        Effect.scoped,
      )
    }

  const get = (key: string, options?: KVGetOptions) =>
    Effect.flatMap(
      wrap(
        (_) => _.get as (key: string, options?: KVNamespaceGetOptions<'text'>) => Promise<string | null>,
        'get',
        (_, result) => ({
          [KV_ATTRS.TYPE]: 'text',
          [KV_ATTRS.CACHE_TTL]: options?.cacheTtl,
          [KV_ATTRS.HAS_RESULT]: !!result,
        }),
      )(key, { ...options, type: 'text' }),
      Option.fromNullable,
    )

  const getJson = (key: string, options?: KVGetOptions) =>
    Effect.flatMap(
      wrap(
        (_) => _.get as (key: string, options?: KVNamespaceGetOptions<'json'>) => Promise<string | null>,
        'getJson',
        (_, _result) => ({
          [KV_ATTRS.TYPE]: 'json',
          [KV_ATTRS.CACHE_TTL]: options?.cacheTtl,
        }),
      )(key, { ...options, type: 'json' }),
      Option.fromNullable,
    )

  const getArrayBuffer = (key: string, options?: KVGetOptions) =>
    Effect.flatMap(
      wrap(
        (_) => _.get as (key: string, options?: KVNamespaceGetOptions<'arrayBuffer'>) => Promise<string | null>,
        'getArrayBuffer',
        (_, _result) => ({
          [KV_ATTRS.TYPE]: 'arrayBuffer',
          [KV_ATTRS.CACHE_TTL]: options?.cacheTtl,
        }),
      )(key, { ...options, type: 'arrayBuffer' }),
      Option.fromNullable,
    )

  const getStream = <T = unknown>(key: string, options?: KVGetOptions) =>
    Effect.flatMap(
      wrap(
        (_) =>
          _.get as (
            key: string,
            options?: KVNamespaceGetOptions<'stream'>,
          ) => Promise<KVNamespaceGetWithMetadataResult<ReadableStream, any>>,
        'getStream',
        (_, _result) => ({
          [KV_ATTRS.TYPE]: 'stream',
          [KV_ATTRS.CACHE_TTL]: options?.cacheTtl,
        }),
      )(key, { ...options, type: 'stream' }),
      (_) => (_ === null ? Option.none<ReadableStream<T>>() : Option.some<ReadableStream<T>>(_ as any)),
    )

  const list = wrap(
    (_) => _.list,
    'list',
    (args, result) => {
      const opts = args[0] || {}
      const { cursor, limit, prefix } = opts
      const listResult = result as KVNamespaceListResult<any, any>

      return {
        [KV_ATTRS.LIST.REQUEST_CURSOR]: cursor,
        [KV_ATTRS.LIST.LIMIT]: limit,
        [KV_ATTRS.LIST.COMPLETE]: listResult.list_complete,
        [KV_ATTRS.LIST.RESPONSE_CURSOR]: !listResult.list_complete ? listResult.cursor : undefined,
        [KV_ATTRS.CACHE_STATUS]: listResult.cacheStatus,
        [ATTR_DB_OPERATION_NAME]: `list ${prefix || ''}`,
      }
    },
  )

  const put = wrap(
    (_) => _.put,
    'put',
    (args) => {
      const options = args[2] as KVNamespacePutOptions | undefined
      return {
        [KV_ATTRS.EXPIRATION]: options?.expiration,
        [KV_ATTRS.EXPIRATION_TTL]: options?.expirationTtl,
        [KV_ATTRS.METADATA]: !!options?.metadata,
      }
    },
  ) as any

  const delete_ = wrap((_) => _.delete, 'delete')

  const metadata = {
    get: (key: string, options?: KVGetOptions) =>
      wrap(
        (_) =>
          _.getWithMetadata as (
            key: string,
            options?: KVNamespaceGetOptions<'text'>,
          ) => Promise<KVNamespaceGetWithMetadataResult<string, any>>,
        'metadata.get',
        (_, result) => ({
          [KV_ATTRS.TYPE]: 'text',
          [KV_ATTRS.CACHE_TTL]: options?.cacheTtl,
          [KV_ATTRS.METADATA]: true,
          [KV_ATTRS.CACHE_STATUS]: (result as KVNamespaceGetWithMetadataResult<any, any>).cacheStatus,
        }),
      )(key, { ...options, type: 'text' }),

    getJson: (key: string, options?: KVGetOptions) =>
      wrap(
        (_) =>
          _.getWithMetadata as (
            key: string,
            options?: KVNamespaceGetOptions<'json'>,
          ) => Promise<KVNamespaceGetWithMetadataResult<string, any>>,
        'metadata.getJson',
        (_, result) => ({
          [KV_ATTRS.TYPE]: 'json',
          [KV_ATTRS.CACHE_TTL]: options?.cacheTtl,
          [KV_ATTRS.METADATA]: true,
          [KV_ATTRS.CACHE_STATUS]: (result as KVNamespaceGetWithMetadataResult<any, any>).cacheStatus,
        }),
      )(key, { ...options, type: 'json' }),

    getArrayBuffer: (key: string, options?: KVGetOptions) =>
      wrap(
        (_) =>
          _.getWithMetadata as (
            key: string,
            options?: KVNamespaceGetOptions<'arrayBuffer'>,
          ) => Promise<KVNamespaceGetWithMetadataResult<ArrayBuffer, any>>,
        'metadata.getArrayBuffer',
        (_, result) => ({
          [KV_ATTRS.TYPE]: 'arrayBuffer',
          [KV_ATTRS.CACHE_TTL]: options?.cacheTtl,
          [KV_ATTRS.METADATA]: true,
          [KV_ATTRS.CACHE_STATUS]: (result as KVNamespaceGetWithMetadataResult<any, any>).cacheStatus,
        }),
      )(key, { ...options, type: 'arrayBuffer' }),

    getStream: (key: string, options?: KVGetOptions) =>
      wrap(
        (_) =>
          _.getWithMetadata as (
            key: string,
            options: KVNamespaceGetOptions<'stream'>,
          ) => Promise<KVNamespaceGetWithMetadataResult<ReadableStream, any>>,
        'metadata.getStream',
        (_, result) => ({
          [KV_ATTRS.TYPE]: 'stream',
          [KV_ATTRS.CACHE_TTL]: options?.cacheTtl,
          [KV_ATTRS.METADATA]: true,
          [KV_ATTRS.CACHE_STATUS]: (result as KVNamespaceGetWithMetadataResult<any, any>).cacheStatus,
        }),
      )(key, { ...options, type: 'stream' }) as any,
  }

  return {
    get,
    getJson,
    getArrayBuffer,
    getStream,
    list,
    put,
    delete: delete_,
    metadata,
  } as const
})

export const Default = Layer.scoped(
  KV,
  make(() => 'KV'),
)

export const fromName = (bindingName: LazyArg<string>) => Layer.scoped(KV, make(bindingName))
