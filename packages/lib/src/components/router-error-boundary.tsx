import type { ReactElement } from 'react'
import { type ErrorResponse, isRouteErrorResponse, useParams, useRouteError } from 'react-router'

export function getErrorMessage(error: unknown) {
  if (typeof error === 'string') {
    return error
  }

  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message
  }

  console.error('Unable to get error message for error', error)

  return ''
}

type StatusHandler = (info: { error: ErrorResponse; params: Record<string, string | undefined> }) => ReactElement | null

export function GeneralErrorBoundary({
  defaultStatusHandler = ({ error }) => {
    return (
      <p>
        {error.status} {error.data}
      </p>
    )
  },
  statusHandlers,
  unexpectedErrorHandler = (error) => <p>{getErrorMessage(error)}</p>,
}: {
  defaultStatusHandler?: StatusHandler
  statusHandlers?: Record<number, StatusHandler>
  unexpectedErrorHandler?: (error: unknown) => ReactElement | null
}) {
  const error = useRouteError()
  const params = useParams()

  if (typeof document !== 'undefined') {
    let err = error as any
    if (err instanceof Error) {
      err.cause = new Error('General Error Boundary')
    } else {
      err = new Error(err, { cause: new Error('General Error Boundary') })
    }
    console.error(err)
  }

  return (
    <div className="text-h2 container flex items-center justify-center p-20">
      {isRouteErrorResponse(error)
        ? (statusHandlers?.[error.status] ?? defaultStatusHandler)({
            error,
            params,
          })
        : unexpectedErrorHandler(error)}
    </div>
  )
}
