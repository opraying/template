import type * as React from 'react'
import { use, useMemo } from 'react'
import { ToasterContext, type ToasterProviderProps } from './context'
import type { ToasterMethods } from './toaster'
import { makeWebToaster } from './web'

export function ToasterProvider({ children }: ToasterProviderProps) {
  const methods = useMemo(() => {
    return makeWebToaster()
  }, [])

  return <ToasterContext.Provider value={methods}>{children}</ToasterContext.Provider>
}

export function useToasterContext(): ToasterMethods {
  const context = use(ToasterContext)

  if (!context) {
    throw new Error('useToasterContext must be used within a ToasterProvider')
  }

  return context
}

export interface WithToasterProps {
  toaster: ToasterMethods
}

export function withToaster<P extends WithToasterProps>(Component: React.ComponentType<P>) {
  function WrappedComponent(props: Omit<P, 'toaster'>) {
    const toaster = useToasterContext()

    return <Component {...(props as P)} toaster={toaster} />
  }

  WrappedComponent.displayName = `withToaster(${Component.displayName || Component.name})`

  return WrappedComponent
}
