import { useAuthConfig } from '@xstack/user-kit/authentication/components/auth-provider'
import { useAuthInit, useAuthSession } from '@xstack/user-kit/authentication/hooks'
import { type ReactNode, useEffect } from 'react'
import { Navigate } from 'react-router'

export function RequiredAuth({ children }: { children?: ReactNode }) {
  const initStatus = useAuthInit()
  const authConfig = useAuthConfig()
  const authSession = useAuthSession()

  useEffect(() => {
    if (initStatus._tag === 'Failure') {
      return
    }

    if (initStatus._tag === 'Success') {
    }
  }, [initStatus])

  if (initStatus.waiting) {
    return null
  }

  /**
   * TODO: add more error refinement here
   */
  if (initStatus._tag === 'Failure' || authSession.user._tag === 'None') {
    return <Navigate replace to={authConfig.unauthorizedRedirect} />
  }

  return children
}

export function RedirectIfAuth({ children }: { children?: ReactNode }) {
  const initStatus = useAuthInit()
  const authSession = useAuthSession()
  const authConfig = useAuthConfig()

  if (initStatus.waiting) {
    return children
  }

  if (authSession.user._tag === 'Some') {
    return <Navigate replace to={authConfig.loginRedirect} />
  }

  return children
}
