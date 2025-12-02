import { authWebConfig, siteConfig } from '@shared/config'
import { AuthConfigProvider } from '@xstack/user-kit/authentication/components/auth-provider'
import { AuthScreen } from '@xstack/user-kit/components/auth-screens'
import { Footer, Page } from '@xstack/user-kit/components/page'

export function Component() {
  return (
    <AuthConfigProvider config={authWebConfig}>
      <Page footer={<Footer copyright={siteConfig.copyright} />}>
        <AuthScreen siteConfig={siteConfig} custom={{}} />
      </Page>
    </AuthConfigProvider>
  )
}
