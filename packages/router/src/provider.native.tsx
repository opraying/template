import type * as React from 'react'
import { createContext, type ReactNode, use, useMemo } from 'react'
import { makeExpoRouterNavigate } from './expo'
import type { NavigationMethods } from './navigate'

// Navigation context
const NavigationContext = createContext<NavigationMethods | null>(null)

// Provider props for React Native
export interface NavigationProviderProps {
  children: ReactNode
}

// React Native Navigation Provider Component (defaults to Expo Router)
export function NavigationProvider({ children }: NavigationProviderProps) {
  const navigationMethods = useMemo(() => {
    try {
      return makeExpoRouterNavigate()
    } catch (error) {
      console.warn('Failed to initialize Expo Router navigation:', error)
      return createNoOpNavigation()
    }
  }, [])

  return <NavigationContext.Provider value={navigationMethods}>{children}</NavigationContext.Provider>
}

// Hook to access navigation context
export function useNavigationContext(): NavigationMethods {
  const context = use(NavigationContext)

  if (!context) {
    throw new Error('useNavigationContext must be used within a NavigationProvider')
  }

  return context
}

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

// Higher-order component for navigation
export interface WithNavigationProps {
  navigation: NavigationMethods
}

export function withNavigation<P extends WithNavigationProps>(Component: React.ComponentType<P>) {
  function WrappedComponent(props: Omit<P, 'navigation'>) {
    const navigation = useNavigationContext()

    return <Component {...(props as P)} navigation={navigation} />
  }

  WrappedComponent.displayName = `withNavigation(${Component.displayName || Component.name})`

  return WrappedComponent
}
