import { CloudflareBindings } from '@xstack/cloudflare/bindings'
import { CloudflareExecutionContext } from '@xstack/cloudflare/execution-context'
import { CMS, QueryError } from '@xstack/cms'
import { CacheUtil } from '@xstack/cms/cache'
import { type QueryParams, type QueryResult, type ResponseQueryOptions } from '@xstack/cms/sanity'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import * as Predicate from 'effect/Predicate'

const encodeQueryString = ({
  query,
  params = {},
  options = {},
}: {
  query: string
  params?: QueryParams | undefined
  options?: ResponseQueryOptions | undefined
}) => {
  const searchParams = new URLSearchParams()
  // We generally want tag at the start of the query string
  const { tag, returnQuery, ...opts } = options
  // We're using `append` instead of `set` to support React Native: https://github.com/facebook/react-native/blob/1982c4722fcc51aa87e34cf562672ee4aff540f1/packages/react-native/Libraries/Blob/URL.js#L86-L88
  if (tag) searchParams.append('tag', tag)
  searchParams.append('query', query)

  // Iterate params, the keys are prefixed with `$` and their values JSON stringified
  for (const [key, value] of Object.entries(params)) {
    searchParams.append(`$${key}`, JSON.stringify(value))
  }
  // Options are passed as-is
  for (const [key, value] of Object.entries(opts)) {
    // Skip falsy values
    if (value) searchParams.append(key, `${value}`)
  }

  // `returnQuery` is default `true`, so needs an explicit `false` handling
  if (returnQuery === false) searchParams.append('returnQuery', 'false')

  return `?${searchParams}`
}

export const CMSLive = Layer.effect(
  CMS,
  Effect.gen(function* () {
    // @ts-ignore
    const projectId = process.env.SANITY_STUDIO_PROJECT_ID ?? ''
    // @ts-ignore
    const dataset = process.env.SANITY_STUDIO_DATASET ?? ''
    // @ts-ignore
    const apiToken = process.env.SANITY_STUDIO_API_TOKEN ?? ''

    const BASE_URL = `https://${projectId}.apicdn.sanity.io/v2024-07-17/data/query/${dataset}`

    // /data/query/<dataset>?query=<GROQ-query>&$string="es"&$bool=true&$number=12.8
    const request = <T>(query: string, params?: QueryParams, options?: any) => {
      const encodeQuery = encodeQueryString({ query, params, options })

      return fetch(`${BASE_URL}${encodeQuery}`, {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
      }).then((res) => res.json() as Promise<{ result: T; ms: number; query: string }>)
    }

    const executionContext = yield* CloudflareExecutionContext.getRawContext()
    const kv = yield* CloudflareBindings.use((bindings) => bindings.getKVNamespace('CMS_KV'))
    const cache = new CacheUtil(kv)

    const loadQuery = <T>(
      label: string,
      query: string,
      params?: QueryParams,
      options?: Pick<ResponseQueryOptions, 'cache' | 'useCdn'>,
    ): Effect.Effect<QueryResult<T>, QueryError> => {
      return pipe(
        Effect.tryPromise({
          try: () =>
            cache.cachedCall(() => request<T>(query, params, options), [projectId, dataset, label, params, options], {
              waitUntil: executionContext.waitUntil,
            }),
          catch: (error) =>
            new QueryError({
              message: error instanceof Error ? error.message : 'Unknown error in loadQuery',
              cause: error instanceof Error ? error : undefined,
            }),
        }),
        Effect.filterOrFail(
          (_) => {
            if (Predicate.hasProperty(_, 'error')) {
              return false
            }

            return true
          },
          (error) =>
            new QueryError({
              message: (error as any)?.error.description || 'Unknown error in loadQuery',
              cause: (error as any)?.error,
            }),
        ),
        Effect.map(
          (res) =>
            ({
              initial: { data: res.result },
              query,
              params,
            }) as QueryResult<T>,
        ),
        Effect.annotateSpans({
          label,
          query,
          params,
          options,
        }),
        Effect.withSpan('CMS.query'),
      )
    }

    return {
      loadQuery,
    }
  }),
)
