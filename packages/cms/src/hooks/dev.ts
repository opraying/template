import type { ContentSourceMap, StudioPathLike } from '@sanity/react-loader'
import { type QueryResult, type ClientPerspective } from '@xstack/cms/sanity'
import { useQuery } from '@xstack/cms/store'

type EncodeDataAttributeFunction = {
  (path: StudioPathLike): string | undefined
  scope: (path: StudioPathLike) => EncodeDataAttributeFunction
}

export const useInitialLoaderData = <T>(result: QueryResult<T>) => {
  const { data, error, loading, ...rest } = useQuery<T, Error>(result.query, result.params, {
    initial: result.initial,
  })

  return {
    data,
    error,
    loading: !result.initial && loading,
    ...(rest as {
      sourceMap?: ContentSourceMap
      perspective?: ClientPerspective
      encodeDataAttribute: EncodeDataAttributeFunction
    }),
  } as const
}

export const useInitialLoaderDataWithPagination = <T>(
  result: QueryResult<T> & {
    pagination: {
      page: number
      size: number
      total: number
      totalPages: number
    }
  },
) => {
  const { data, error, loading, ...rest } = useQuery<T, Error>(result.query, result.params, {
    initial: result.initial,
  })

  return {
    data,
    error,
    loading: !result.initial && loading,
    ...(rest as {
      sourceMap?: ContentSourceMap
      perspective?: ClientPerspective
      encodeDataAttribute: EncodeDataAttributeFunction
    }),
    pagination: {
      ...result.pagination,
      hasNext: result.pagination.page < result.pagination.totalPages,
      hasPrev: result.pagination.page > 1,
      next: result.pagination.page + 1,
      prev: result.pagination.page - 1,
    },
  } as const
}
