import { useBoot } from '@xstack/app-kit/boot'
import { useAtomResult } from '@xstack/atom-react'
import * as Cause from 'effect/Cause'
import * as Effect from 'effect/Effect'
import type * as Layer from 'effect/Layer'
import type { ReactNode } from 'react'
// import { ErrorBoundary } from 'react-error-boundary'
// import { Button } from '@/components/ui/button'
// import { ErrorFullPageFallback } from '@xstack/errors/react/error-boundary'

export const Boot = <A, E, R>({
  layer,
  init,
  onLoaded,
  onError,
  children,
}: {
  layer: Layer.Layer<R, never, never>
  init?: Effect.Effect<A, E, R> | undefined
  onLoaded?: (() => void) | undefined
  onError?: (error: unknown) => void
  children: ReactNode
}) => {
  return (
    // <ErrorBoundary
    //   onError={(error) => {
    //     // @ts-ignore
    //     globalThis.hideLoading()

    //     onError?.(error)
    //   }}
    //   fallbackRender={({ error, resetErrorBoundary }) => (
    //     <ErrorFullPageFallback error={error}>
    //       <Button onClick={resetErrorBoundary}>Retry</Button>
    //     </ErrorFullPageFallback>
    //   )}
    // >
      <BootRun init={init} layer={layer} onLoaded={onLoaded}>
        {children}
      </BootRun>
    // </ErrorBoundary>
  )
}

const BootRun = <A, E, R>({
  init,
  layer,
  onLoaded,
  children,
}: {
  layer: Layer.Layer<R, never, never>
  init?: Effect.Effect<A, E, R> | undefined
  onLoaded?: (() => void) | undefined
  children: ReactNode
}) => {
  const { initAtom } = useBoot(layer, init ?? (Effect.void as any))
  const result = useAtomResult(initAtom)

  if (result._tag === 'Initial') {
    return null
  }

  if (result._tag === 'Failure') {
    throw Cause.squash(result.cause)
  }

  if (result._tag === 'Success') {
    onLoaded?.()

    return children
  }

  return null
}
