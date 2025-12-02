import * as RootProviderClient from '@shared/components/root-provider.client'
import { languageOptions, siteConfig } from '@shared/config'
import globalCss from '@shared/styles/global.css?url'
import { RootHTML } from '@xstack/app/document'
import { getSanityEnv, SanityEnv } from '@xstack/cms/react-router'
import * as RR from '@xstack/react-router/effect'
import { GlobalConfigProvider } from '@xstack/react-router/global/config'
import { appStatusUtils, type LoaderType, useRouteLoaderData } from '@xstack/react-router/utils'
import * as Effect from 'effect/Effect'
import type { ReactNode } from 'react'
import { ErrorBoundary as BaseErrorBoundary } from 'react-error-boundary'
import { Outlet, ScrollRestoration, type ShouldRevalidateFunction } from 'react-router'
import { ErrorFullPageFallback, RouterDataErrorBoundary } from '@xstack/errors/react/error-boundary'

const Provider = import.meta.env.SSR
  ? ({ children }: { children: ReactNode }) => children
  : RootProviderClient.RootProvider

const meta = (
  <>
    <meta name="theme-color" content="hsl(240, 0%, 98%)" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="hsl(225, 5%, 15%)" media="(prefers-color-scheme: dark)" />
    <meta name="apple-mobile-web-app-title" content={siteConfig.name} />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  </>
)

const something = (
  <>
    <ScrollRestoration />
    <SanityEnv />
  </>
)

export const shouldRevalidate: ShouldRevalidateFunction = ({ currentUrl, nextUrl }) => {
  if (currentUrl.search !== nextUrl.search) return true

  return false
}

export const loader = RR.loader(
  Effect.gen(function* () {
    const request = yield* RR.request
    const cookie = yield* RR.Cookies.fromHeader

    const url = request.url
    const isShell = url.indexOf('?shell') > -1
    const isAppEnable = appStatusUtils.isAppEnabled(cookie)
    const sanity = getSanityEnv()

    return {
      isShell,
      isAppEnable,
      sanity,
    }
  }),
  {
    name: 'root',
  },
)
export type RootLoader = LoaderType<typeof loader>

export function Component({ children }: any) {
  return (
    <BaseErrorBoundary FallbackComponent={ErrorFullPageFallback}>
      <GlobalConfigProvider languages={languageOptions}>
        <Provider>{children ?? <Outlet />}</Provider>
      </GlobalConfigProvider>
    </BaseErrorBoundary>
  )
}

export function Layout({ children }: { children: ReactNode }) {
  const res = useRouteLoaderData<LoaderType<typeof loader>>('root')
  const { isShell } = res.result

  return (
    <RootHTML
      isShell={isShell}
      meta={meta}
      links={
        <>
          <link rel="icon" href="/favicon.ico" sizes="any" />
          <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
          <link rel="manifest" href="/manifest.webmanifest" />
          <link rel="stylesheet" href={globalCss} type="text/css" />
        </>
      }
      something={something}
      websiteId={siteConfig.websiteId}
    >
      <Component>{children}</Component>
    </RootHTML>
  )
}

export default function Root() {
  return <Outlet />
}

export function ErrorBoundary() {
  return <RouterDataErrorBoundary fullPage={true} />
}
