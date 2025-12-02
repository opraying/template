import type { NavigationMethods } from './navigate'
import { useNavigationContext } from './provider'

export const useNavigate = (): NavigationMethods => {
  const navigation = useNavigationContext()

  return navigation
}
