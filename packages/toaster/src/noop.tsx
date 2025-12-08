import { useMemo } from 'react'
import { ToasterContext, type ToasterProviderProps } from './context'
import type { ToasterMethods } from './toaster'

function createNoOpToaster(): ToasterMethods {
  const noOp = (message?: any, data?: any) => {
    console.warn('Toaster method called but no valid toaster implementation is available', {
      message,
      data,
    })
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

export function ToasterProvider({ children }: ToasterProviderProps) {
  const methods = useMemo(() => {
    return createNoOpToaster()
  }, [])

  return <ToasterContext.Provider value={methods}>{children}</ToasterContext.Provider>
}
