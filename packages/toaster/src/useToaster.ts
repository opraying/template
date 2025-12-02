import { useToasterContext } from './provider'
import type { ToasterMethods } from './toaster'

export interface UseToasterReturn extends ToasterMethods {}

export const useToaster = (): UseToasterReturn => {
  const toaster = useToasterContext()

  return toaster
}
