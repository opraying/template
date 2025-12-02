import { AppearanceToggle } from '@shared/components/appearance-toggle'
import { authWebConfig, siteConfig } from '@shared/config'
import { LanguageSelect } from '@xstack/app/components/language-select'
import { useAppEnable } from '@xstack/app/hooks/use-app-utils'
import { MarketingRootClient } from '@xstack/app/layout/marketing-root-client'
import { Footer, type FooterProps, Header } from '@xstack/app/minimalism/marketing'
import { useLanguageChangeRevalidator } from '@xstack/react-router/utils'
import { AuthConfigProvider } from '@xstack/user-kit/authentication/components/auth-provider'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet } from 'react-router'

export function MarketingLayout({ children }: { children?: ReactNode }) {
  const { t } = useTranslation()
  const appEnable = useAppEnable()

  useLanguageChangeRevalidator()

  const headerLinks = [
    {
      to: '/pricing',
      title: t('nav.pricing'),
    },
    {
      to: '/changelog',
      title: t('nav.changelog'),
    },
  ]

  const footerLinks: FooterProps['links'] = {
    product: [
      {
        href: appEnable ? '/home' : '/',
        label: t('nav.home'),
      },
      {
        href: '/pricing',
        label: t('nav.pricing'),
      },
      {
        href: '/changelog',
        label: t('nav.changelog'),
      },
    ],
    company: [
      {
        href: '/about',
        label: t('nav.about'),
      },
      {
        href: '/contact',
        label: t('nav.contact'),
      },
      {
        href: '/faqs',
        label: t('nav.faqs'),
      },
    ],
    legal: [
      {
        href: '/terms',
        label: t('nav.terms'),
      },
      {
        href: '/privacy',
        label: t('nav.privacy'),
      },
    ],
  }

  return (
    <AuthConfigProvider config={authWebConfig}>
      <MarketingRootClient>
        <div className="flex flex-col min-h-dvh">
          <Header name={siteConfig.name} links={headerLinks} />
          <div className="flex flex-col flex-grow">{children || <Outlet />}</div>
          <Footer
            links={footerLinks}
            copyright={siteConfig.copyright}
            right={
              <>
                <div className="min-w-[60px]">
                  <LanguageSelect />
                </div>
                <div className="min-w-[60px]">
                  <AppearanceToggle />
                </div>
              </>
            }
            socialLinks={[
              {
                href: 'https://github.com/opraying',
                icon: <i className="i-logos-github-icon dark:invert w-5 h-5" />,
              },
              {
                href: 'https://twitter.com/@opraying_',
                icon: <i className="i-logos-twitter w-5 h-5" />,
              },
            ]}
          />
        </div>
      </MarketingRootClient>
    </AuthConfigProvider>
  )
}
