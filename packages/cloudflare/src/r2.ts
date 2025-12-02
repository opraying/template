import type { R2Bucket } from '@cloudflare/workers-types'
import {
  ATTR_DB_NAMESPACE,
  ATTR_DB_OPERATION_NAME,
  ATTR_DB_QUERY_TEXT,
  ATTR_DB_SYSTEM,
} from '@opentelemetry/semantic-conventions/incubating'
import { CloudflareBindings } from '@xstack/cloudflare/bindings'
import { DB_NAME, R2_ATTRS, type R2GetOptions, type R2PutOptions, S3, S3Error } from '@xstack/server/s3'
import * as Effect from 'effect/Effect'
import { type LazyArg, pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import * as Option from 'effect/Option'
import * as RcRef from 'effect/RcRef'

const DB_SYSTEM = 'Cloudflare R2'

const make = Effect.fn(function* (bindingName: LazyArg<string>) {
  const acquire = CloudflareBindings.use((bindings) => bindings.getR2Bucket(bindingName())).pipe(
    Effect.flatMap(
      Option.match({
        onNone: () => Effect.dieMessage(`R2 Bucket ${bindingName} not found`),
        onSome: Effect.succeed,
      }),
    ),
  )
  const bucketRef = yield* RcRef.make({ acquire, idleTimeToLive: 100 })

  const catcher = (cause: any) => new S3Error({ message: 'r2 call error', cause })

  const wrap =
    <A, Args extends any[]>(
      f: (_: R2Bucket) => (...args: Args) => Promise<A>,
      operation: string,
      getExtraAttributes?: (args: Args, result?: A) => Record<string, any>,
    ) =>
    (...args: Args) => {
      const spanName = `S3.${operation}`
      const baseAttributes = {
        [ATTR_DB_OPERATION_NAME]: operation,
        [ATTR_DB_SYSTEM]: DB_SYSTEM,
        [ATTR_DB_NAMESPACE]: DB_NAME,
        binding_type: 'R2',
      } as Record<string, any>

      if (operation !== 'list') {
        baseAttributes[ATTR_DB_QUERY_TEXT] = `${operation} ${args[0]}`
        baseAttributes[R2_ATTRS.KEY] = args[0]
      }

      return pipe(
        bucketRef.get,
        Effect.flatMap((bucket) =>
          Effect.tryPromise({
            try: () => f(bucket).apply(bucketRef, args),
            catch: catcher,
          }),
        ),
        Effect.tap((result) => {
          const extraAttrs = getExtraAttributes?.(args, result) || {}
          return Effect.annotateCurrentSpan({
            ...extraAttrs,
            [R2_ATTRS.HAS_RESULT]: !!result,
          })
        }),
        Effect.withSpan(spanName, {
          attributes: baseAttributes,
        }),
        Effect.scoped,
      )
    }

  const get = (key: string, options?: R2GetOptions) =>
    Effect.flatMap(
      wrap(
        (_) => _.get,
        'get',
        (_, _result) => {
          const rangeAttrs: Record<string, number | undefined> = {}

          if (options?.range) {
            if ('offset' in options.range) {
              rangeAttrs[R2_ATTRS.GET.RANGE_START] = options.range.offset
              if (options.range.length !== undefined) {
                rangeAttrs[R2_ATTRS.GET.RANGE_END] = options.range.offset + options.range.length
              }
            } else if ('suffix' in options.range) {
              rangeAttrs[R2_ATTRS.GET.RANGE_END] = options.range.suffix
            }
          }

          return {
            ...rangeAttrs,
            [R2_ATTRS.GET.CONDITIONAL_ETAG]: options?.onlyIf?.etagMatches,
            [R2_ATTRS.GET.CONDITIONAL_MODIFIED]: options?.onlyIf?.uploadedAfter,
            [R2_ATTRS.GET.CONDITIONAL_UNMODIFIED]: options?.onlyIf?.uploadedBefore,
          }
        },
      )(key, options),
      Option.fromNullable,
    )

  const put = (
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob,
    options?: R2PutOptions,
  ) =>
    wrap(
      (_) => _.put,
      'put',
      () => ({
        [R2_ATTRS.PUT.CONTENT_TYPE]: options?.httpMetadata?.contentType,
        [R2_ATTRS.PUT.CONTENT_ENCODING]: options?.httpMetadata?.contentEncoding,
        [R2_ATTRS.PUT.CONTENT_LANGUAGE]: options?.httpMetadata?.contentLanguage,
        [R2_ATTRS.PUT.CACHE_CONTROL]: options?.httpMetadata?.cacheControl,
        [R2_ATTRS.PUT.CONTENT_DISPOSITION]: options?.httpMetadata?.contentDisposition,
        [R2_ATTRS.PUT.HAS_CUSTOM_METADATA]: !!options?.customMetadata,
      }),
    )(key, value as any, options)

  const delete_ = wrap((_) => _.delete, 'delete')

  const list = wrap(
    (_) => _.list,
    'list',
    (args, result) => {
      const options = args[0] || {}
      return {
        [R2_ATTRS.LIST.PREFIX]: options.prefix,
        [R2_ATTRS.LIST.DELIMITER]: options.delimiter,
        [R2_ATTRS.LIST.LIMIT]: options.limit,
        [R2_ATTRS.LIST.CURSOR]: options.cursor,
        [R2_ATTRS.LIST.TRUNCATED]: result?.truncated,
        [ATTR_DB_QUERY_TEXT]: `list ${options.prefix || ''}`,
      }
    },
  )

  const head = (key: string) => Effect.flatMap(wrap((_) => _.head, 'head')(key), Option.fromNullable)

  return {
    get,
    put,
    delete: delete_,
    list,
    head,
  } as any
})

export const Default = Layer.scoped(
  S3,
  make(() => 'R2'),
)

export const fromName = (bindingName: LazyArg<string>) => Layer.scoped(S3, make(bindingName))
