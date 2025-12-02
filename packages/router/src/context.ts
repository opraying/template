import { createContext, type ReactNode } from 'react'
import type { NavigationMethods } from './navigate'

// Navigation context
export const NavigationContext = createContext<NavigationMethods | null>(null)

// Provider props for web
export interface NavigationProviderProps {
  children: ReactNode
}
