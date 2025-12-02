import { useMemo } from 'react'
import { NavigationContext, type NavigationProviderProps } from './context'
import type { NavigationMethods } from './navigate'

// No-op navigation implementation for fallback
function createNoOpNavigation(): NavigationMethods {
  const noOp = () => {
    console.warn('Navigation method called but no valid navigation implementation is available')
  }

  return {
    back: noOp,
    canDismiss: () => false,
    canGoBack: () => false,
    dismiss: noOp,
    dismissAll: noOp,
    dismissTo: noOp,
    navigate: noOp,
    prefetch: noOp,
    push: noOp,
    replace: noOp,
    setParams: noOp,
  }
}

// Web Navigation Provider Component (defaults to React Router)
export function NavigationProvider({ children }: NavigationProviderProps) {
  const navigationMethods = useMemo(() => {
    return createNoOpNavigation()
  }, [])

  return <NavigationContext.Provider value={navigationMethods}>{children}</NavigationContext.Provider>
}
