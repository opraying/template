import type * as React from 'react'
import { createContext, type ReactNode, use, useMemo } from 'react'
import { makeNativeToaster } from './expo'
import type { ToasterMethods } from './toaster'

const ToasterContext = createContext<ToasterMethods | null>(null)

export interface ToasterProviderProps {
  children: ReactNode
}

export function ToasterProvider({ children }: ToasterProviderProps) {
  const methods = useMemo(() => {
    try {
      return makeNativeToaster()
    } catch (error) {
      console.warn('Failed to initialize toaster', error)
      return createNoOpToaster()
    }
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

function createNoOpToaster(): ToasterMethods {
  const noOp = (message?: any, data?: any) => {
    console.warn('Toaster method called but no valid toaster implementation is available', { message, data })
    return 0
  }

  const toast = noOp as ToasterMethods
  toast.success = noOp
  toast.info = noOp
  toast.warning = noOp
  toast.error = noOp
  toast.custom = noOp
  toast.message = noOp
  toast.promise = ((promise: any, _data?: any) => {
    console.warn('Toast promise method called but no valid toaster implementation is available')
    return { unwrap: () => promise }
  }) as any
  toast.dismiss = noOp
  toast.loading = noOp

  return toast
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
