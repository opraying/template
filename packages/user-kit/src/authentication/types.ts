import type { AuthWebConfig } from '@xstack/user-kit/config'
import type { ReactNode } from 'react'

export interface AuthScreenConfig {
  siteConfig: {
    name: string
    logo: string
  }
  webConfig: AuthWebConfig
  custom?: {
    login?: {
      headerRight?: ReactNode
    }
    emailVerification?: {}
  }
}
