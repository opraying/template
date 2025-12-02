import type { AuthScreenConfig } from '@xstack/user-kit/authentication/types'
import type { InitOptions } from 'i18next'

export const appRoutes = ['/test/*', '/example/*', '/settings/*', '/']

export const dynamicPaths = [
  // Marketing
  '/home/*',
  '/about/*',
  '/changelog/*',
  '/pricing/*',
  '/terms/*',
  '/privacy/*',

  '/login/*',

  // Application
  ...appRoutes,
]

export const siteConfig = {
  name: 'Template App',
  short_name: 'Template App',
  app_name: 'Template App',
  description: 'Template App for building web apps',
  namespace: 'template',
  theme_color: '#DCF521',
  background_color: '#000000',
  url: 'https://template.opraying.com',
  email: 'hi@opraying.com',
  logo: 'https://template.opraying.com/pwa-512x512.png',

  copyright: '@ 2024 - Opraying',

  // title
  title: 'Template App',
  titleSeparator: '-',

  // social
  social: {
    twitter: 'https://twitter.com/opraying_',
    github: 'https://github.com/opraying',
  },
  websiteId: '706d9e98-46b0-4085-a88f-b894fd48ee82',
}

export const titleTemplate = (
  title: string,
  opt: {
    separator?: boolean | undefined
  } = { separator: true },
) => {
  if (title === siteConfig.title) {
    return siteConfig.title
  }

  let s = title

  if (opt?.separator) {
    s += ` ${siteConfig.titleSeparator} ${siteConfig.title}`
  }

  return s
}

export const languageOptions = [
  {
    label: 'English',
    value: 'en',
  },
  {
    label: '简体中文',
    value: 'zh-Hans',
  },
] as const

export const i18nConfig = {
  supportedLngs: languageOptions.map((_) => _.value),
  fallbackLng: languageOptions[0].value,
  defaultNS: 'translation',
  react: {},
  interpolation: {
    escapeValue: false,
  },
  fallbackNS: 'translation',
} satisfies InitOptions

export const authWebConfig = {
  providers: ['Github', 'Google'],
  allowEmailLogin: true,
  allowSignup: true,
  loginRedirect: '/',
  signOutRedirect: '/',
  unauthorizedRedirect: '/',
} satisfies AuthScreenConfig['webConfig']

export const changelogConfig = {
  startPage: 1,
  size: 4,
}
