import { useLayoutEffect } from 'react'
import { useHotkeysContext } from 'react-hotkeys-hook'

export function useHotKeyScope<T extends string[]>(scopes: T) {
  const { disableScope, enableScope } = useHotkeysContext()

  useLayoutEffect(() => {
    scopes.forEach((scope) => enableScope(scope))
    return () => {
      scopes.forEach((scope) => disableScope(scope))
    }
  }, [scopes, enableScope, disableScope])

  return null
}
