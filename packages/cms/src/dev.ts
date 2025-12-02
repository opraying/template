import { type QueryParams, type QueryResult, type ResponseQueryOptions } from '@xstack/cms/sanity'
import { CMS, QueryError } from '@xstack/cms'
import { CacheUtil } from '@xstack/cms/cache'
import { client } from '@xstack/cms/client'
import { cmsStore } from '@xstack/cms/store'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'

let flag = false
export const CMSLive = Layer.effect(
  CMS,
  Effect.sync(() => {
    // @ts-ignore
    const projectId = process.env.SANITY_STUDIO_PROJECT_ID ?? ''
    // @ts-ignore
    const dataset = process.env.SANITY_STUDIO_DATASET ?? ''
    // @ts-ignore
    const apiToken = process.env.SANITY_STUDIO_API_TOKEN ?? ''

    if (!flag) {
      const currentConfig = client.config()

      if (!currentConfig.token) {
        client.config({
          projectId,
          dataset,
          token: apiToken,
        })
      }

      cmsStore.setServerClient(client)
      flag = true
    }

    const cache = new CacheUtil()

    const loadQuery = <T>(
      label: string,
      query: string,
      params?: QueryParams,
      options?: Pick<ResponseQueryOptions, 'perspective' | 'cache' | 'useCdn'>,
    ): Effect.Effect<QueryResult<T>, QueryError> => {
      const perspective = options?.perspective || 'drafts'
      const queryOptions: ResponseQueryOptions = {
        ...options,
        perspective,
      }

      return pipe(
        Effect.tryPromise({
          try: () =>
            cache.cachedCall(
              () => cmsStore.loadQuery(query, params, queryOptions as any),
              [projectId, dataset, label, params, queryOptions],
              {
                maxAge: 5 * 60 * 1000, // 5 minutes
              },
            ),
          catch: (error) =>
            new QueryError({
              message: error instanceof Error ? error.message : 'Unknown error in loadQuery',
              cause: error instanceof Error ? error : undefined,
            }),
        }),
        Effect.map(
          (_) =>
            ({
              initial: _,
              query,
              params,
            }) as QueryResult<T>,
        ),
        Effect.annotateSpans({
          label,
          query,
          params,
          options: queryOptions,
        }),
        Effect.withSpan('CMS.query'),
      )
    }

    return {
      loadQuery,
    }
  }),
)
