import { RedirectIfAuth } from '@xstack/user-kit/authentication/components/required-auth'
import { LoginPage } from '@xstack/user-kit/authentication/login'
import type { AuthScreenConfig } from '@xstack/user-kit/authentication/types'
import { Route, Routes } from 'react-router'
import { NotFound } from '@xstack/errors/react/errors'

export function AuthScreen({
  siteConfig,
  custom,
}: {
  siteConfig: AuthScreenConfig['siteConfig']
  custom: AuthScreenConfig['custom']
}) {
  return (
    <RedirectIfAuth>
      <Routes>
        <Route index element={<LoginPage logo={siteConfig.logo} name={siteConfig.name} custom={custom} />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </RedirectIfAuth>
  )
}
