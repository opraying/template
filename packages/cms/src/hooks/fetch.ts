import type { StudioPathLike } from '@sanity/react-loader'
import { type QueryResult } from '@xstack/cms/sanity'

type EncodeDataAttributeFunction = {
  (path: StudioPathLike): string | undefined
  scope: (path: StudioPathLike) => EncodeDataAttributeFunction
}

// @ts-ignore
const mockEncodeDataAttribute: EncodeDataAttributeFunction = () => undefined
// @ts-ignore
mockEncodeDataAttribute.scope = (_path: StudioPathLike) => undefined

export const useInitialLoaderData = <T>(result: QueryResult<T>) => {
  const { data, error, loading } = {
    data: result.initial.data,
    error: null,
    loading: false,
  }

  return {
    data,
    error,
    loading: !result.initial && loading,
    encodeDataAttribute: mockEncodeDataAttribute,
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
  const { data, error, loading } = {
    data: result.initial.data,
    error: null,
    loading: false,
  }

  return {
    data,
    error,
    loading: !result.initial && loading,
    encodeDataAttribute: mockEncodeDataAttribute,
    pagination: {
      ...result.pagination,
      hasNext: result.pagination.page < result.pagination.totalPages,
      hasPrev: result.pagination.page > 1,
      next: result.pagination.page + 1,
      prev: result.pagination.page - 1,
    },
  } as const
}
