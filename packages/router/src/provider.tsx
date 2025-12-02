import type * as React from 'react'
import { use, useMemo } from 'react'
import { NavigationContext, type NavigationProviderProps } from './context'
import type { NavigationMethods } from './navigate'
import { makeReactRouterNavigate } from './react-router'

// Web Navigation Provider Component (defaults to React Router)
export function NavigationProvider({ children }: NavigationProviderProps) {
  const navigationMethods = useMemo(() => {
    return makeReactRouterNavigate()
  }, [])

  return <NavigationContext.Provider value={navigationMethods}>{children}</NavigationContext.Provider>
}

// Hook to access navigation context
export function useNavigationContext(): NavigationMethods {
  const context = use(NavigationContext)

  if (!context) {
    throw new Error('useNavigationContext must be used within a NavigationProvider')
  }

  return context ?? {}
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
