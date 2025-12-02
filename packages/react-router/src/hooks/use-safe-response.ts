import { useStableHandler } from '@/lib/hooks/use-stable-handler'
import {
  type FilterReactRouterServerError,
  type ImplicitServerError,
  isServerError,
  type ReactRouterServerError,
} from '@xstack/react-router/errors/common'
import type { ReactRouterData } from '@xstack/react-router/response'
import { useToaster } from '@xstack/toaster'
import { useEffect } from 'react'
import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router'
import {
  type FetcherWithComponents,
  useActionData as useActionData_,
  useFetcher,
  useLoaderData as useLoaderData_,
  useRouteLoaderData as useRouteLoaderData_,
} from 'react-router'

export function useLoaderData<T extends (args: LoaderFunctionArgs) => Promise<ReactRouterData<any, any>>>() {
  const data = useLoaderData_() as ReactRouterData.ReduceError<ReactRouterData.SafeData<T>>

  if (!data) {
    throw new Error('Unexpected error occurred', {
      cause: new Error('No data returned from useLoaderData'),
    })
  }

  if (!data.success && isServerError(data.error)) {
    throw data.error
  }

  return data
}

export const useRouteLoaderData = <T extends (args: LoaderFunctionArgs) => Promise<ReactRouterData<any, any>>>(
  routeId: string,
) => {
  const data = useRouteLoaderData_(routeId) as ReactRouterData.ReduceError<ReactRouterData.SafeData<T>>

  if (!data) {
    throw new Error('Unexpected error occurred', {
      cause: new Error('No data returned from useRouteLoaderData'),
    })
  }

  if (!data.success && isServerError(data.error)) {
    throw data.error
  }

  return data
}

/**
 * @example
 * ```ts
 * error: {
 *   "_tag": "BadRequestError",
 *   "message": "Login failed",
 *   "cause": {
 *       "message": "User not found",
 *       "stack": "Error: User not found\n    at <anonymous>...."
 *   },
 *   "code": 400
 *}
 * ```
 */
const formatServerError = (error: ReactRouterServerError) => {
  return `${error._tag}: ${error.message}`
}

const devLog = (error: ReactRouterServerError) => {
  if (import.meta.env.DEV) {
    console.log(JSON.stringify(error, null, 2))
  }
}

export function useFetcherData<T extends (args: LoaderFunctionArgs) => Promise<ReactRouterData<any, any>>>(options: {
  key?: string
  onSuccess?: (result: ReactRouterData.ExtractSuccess<ReactRouterData.SafeData<T>>) => void
  onFailure?: (error: ReactRouterData.ExtractFailure<ReactRouterData.ReduceError<ReactRouterData.SafeData<T>>>) => void
  onServerError?: (error: ImplicitServerError | FilterReactRouterServerError<ReactRouterData.ErrorData<T>>) => void
}) {
  const toast = useToaster()
  const fetcher = useFetcher(options.key ? { key: options.key } : {}) as FetcherWithComponents<
    ReactRouterData.SafeData<T>
  >
  const onSuccess = useStableHandler(options.onSuccess || (() => {}))
  const onFailure = useStableHandler(options.onFailure || (() => {}))
  const onServerError = useStableHandler(options.onServerError || (() => {}))
  const data = fetcher.data as ReactRouterData<any, any>

  useEffect(() => {
    if (fetcher.state === 'idle') {
      if (!data) {
        return
      }

      if (data.success) {
        onSuccess(data.result)
        return
      }

      const error = data.error as ReactRouterServerError
      if (isServerError(error)) {
        if (options.onServerError) {
          onServerError(error as any)
          return
        }

        toast.error(formatServerError(error))
        devLog(error)
        return
      }

      onFailure(data.error)
      devLog(data.error)
      return
    }
  }, [fetcher.state, data, onFailure, onSuccess, onServerError])

  return fetcher
}

export function useActionData<T extends (args: ActionFunctionArgs) => Promise<ReactRouterData<any, any>>>(options: {
  onFailure?: (error: ReactRouterData.ExtractFailure<ReactRouterData.ReduceError<ReactRouterData.SafeData<T>>>) => void
  onServerError?: (error: ImplicitServerError | FilterReactRouterServerError<ReactRouterData.ErrorData<T>>) => void
}) {
  const toast = useToaster()
  const data = useActionData_() as ReactRouterData.ReduceError<ReactRouterData.SafeData<T>>
  const onFailure = useStableHandler(options.onFailure || (() => {}))
  const onServerError = useStableHandler(options.onServerError || (() => {}))

  useEffect(() => {
    if (!data) return
    if (!data.success) {
      const error = data.error as ReactRouterServerError
      if (isServerError(error)) {
        if (options.onServerError) {
          onServerError(error as any)
          return
        }

        toast.error(formatServerError(error))
        devLog(error)
        return
      }
    }
  }, [data, onFailure, onServerError])

  return data
}
