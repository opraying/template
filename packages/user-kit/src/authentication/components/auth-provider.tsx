import type { AuthWebConfig } from '@xstack/user-kit/config'
import { createContext, type ReactNode, use } from 'react'

export const AuthConfigContext = createContext<AuthWebConfig | undefined>(undefined)

export const AuthConfigProvider = ({ children, config }: { children: ReactNode; config: AuthWebConfig }) => {
  return <AuthConfigContext.Provider value={config}>{children}</AuthConfigContext.Provider>
}

export const useAuthConfig = () => {
  const config = use(AuthConfigContext)
  if (!config) {
    throw new Error('useAuthConfig must be used within an AuthConfigProvider')
  }
  return config
}
