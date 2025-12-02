import * as Context from 'effect/Context'
import * as Data from 'effect/Data'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import { type ResponseQueryOptions, type QueryResult } from '@xstack/cms/sanity'

export class QueryError extends Data.TaggedError('QueryError')<{
  readonly message: string
  readonly cause?: Error | undefined
}> {}

export interface CMS {
  loadQuery: <T>(
    label: string,
    query: string,
    params?:
      | {
          [key: string]: any
        }
      | undefined,
    options?: ResponseQueryOptions,
  ) => Effect.Effect<QueryResult<T>, QueryError>
}
export const CMS = Context.GenericTag<CMS>('@cms')

export const loadQuery = <T>(
  label: string,
  query: string,
  params?:
    | {
        [key: string]: any
      }
    | undefined,
  options?: ResponseQueryOptions,
) => Effect.flatMap(CMS, (cms) => cms.loadQuery<T>(label, query, params, options))

export const loadQueryWithPagination = <
  T extends {
    total: number
  },
>(
  label: string,
  query: string,
  params: Record<string, unknown> & { page: number; size?: number | undefined },
  options?: ResponseQueryOptions,
) => {
  const { page, size, ...restParams } = params
  const sizeNumber = size || 10
  const pageNumber = Math.min(Math.max(1, page), 100)

  // start and end are 0-indexed
  const start = (pageNumber - 1) * sizeNumber
  const end = pageNumber * sizeNumber

  return pipe(
    Effect.flatMap(CMS, (cms) =>
      cms.loadQuery<T>(
        label,
        query,
        {
          ...restParams,
          start,
          end,
        },
        options,
      ),
    ),
    Effect.map((result) => {
      return {
        ...result,
        pagination: {
          page: pageNumber,
          size: sizeNumber,
          total: result.initial.data.total,
          totalPages: Math.ceil(result.initial.data.total / sizeNumber),
        },
      } as QueryResult<T> & {
        pagination: {
          page: number
          size: number
          total: number
          totalPages: number
        }
      }
    }),
  )
}
