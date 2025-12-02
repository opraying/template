import { useState } from 'react'

export interface UseInfiniteQueryOptions<T> {
  initial?: T[]
}

export function useInfiniteQuery<T>(
  _key: string,
  fetcher: (cursor: string | null) => Promise<{
    data: T[]
    nextCursor: string | null
    previousCursor: string | null
  }>,
  options?: UseInfiniteQueryOptions<T>,
) {
  const initialData = options?.initial ?? []
  const [data, setData] = useState<T[]>(initialData)

  const [isFetching, setIsFetching] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [previousCursor, setPreviousCursor] = useState<string | null>(null)

  const fetchNextPage = async () => {
    if (isFetching) return
    setIsFetching(true)
    setError(null)

    try {
      const { data: newData, nextCursor: newNextCursor } = await fetcher(nextCursor)
      setData((prevData) => [...prevData, ...newData])
      setNextCursor(newNextCursor)
    } catch (error: any) {
      setError(error)
    } finally {
      setIsFetching(false)
    }
  }

  const hasNextPage = nextCursor !== null
  const hasPreviousPage = previousCursor !== null

  const fetchPreviousPage = async () => {
    if (isFetching) return
    setIsFetching(true)
    setError(null)

    try {
      const { data: newData, previousCursor: newPreviousCursor } = await fetcher(previousCursor)
      setData((prevData) => [...newData, ...prevData])
      setPreviousCursor(newPreviousCursor)
    } catch (error: any) {
      setError(error)
    } finally {
      setIsFetching(false)
    }
  }

  const _hasData = data.length > 0

  return {
    data,

    isFetching,
    isLoading: isFetching && !data,

    isError: error !== null,

    fetchNextPage,
    hasNextPage,

    fetchPreviousPage,
    hasPreviousPage,
  }
}
