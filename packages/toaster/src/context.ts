import { createContext, type ReactNode } from 'react'
import type { ToasterMethods } from './toaster'

export const ToasterContext = createContext<ToasterMethods | null>(null)

export interface ToasterProviderProps {
  children: ReactNode
}
