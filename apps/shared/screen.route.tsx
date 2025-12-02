import { homeLoader } from '@server/loaders'
import { appRoutes, siteConfig, titleTemplate } from '@shared/config'
import * as MarketingHomeScreenServer from '@shared/marketing/screen'
import * as MarketingHomeScreenClient from '@shared/marketing/screen.client'
import * as AppMainScreenClient from '@shared/screen.client'
import { useAppEnable } from '@xstack/app/hooks/use-app-utils'
import { appStatusUtils, isAppRoute, type MetaFunction } from '@xstack/react-router/utils'
import type { ReactElement } from 'react'
import { type LoaderFunction, Outlet, useLocation } from 'react-router'
import { RouterDataErrorBoundary } from '@xstack/errors/react/error-boundary'
import type { RootLoader } from '@/root'

export const loader: LoaderFunction = (args) => {
  const request = args.request
  const cookie = request.headers.get('Cookie') || ''
  const isAppEnable = appStatusUtils.isAppEnabled(cookie)

  if (isAppEnable) {
    return {}
  }

  return homeLoader(args as any)
}

export const meta: MetaFunction = (ctx) => {
  const root = ctx.matches[0]?.data as Awaited<ReturnType<RootLoader>>

  if (!root) {
    return [
      {
        title: titleTemplate('Home'),
      },
    ]
  }

  if (!root.success) {
    throw new Error('Failed to load data')
  }
  const { isAppEnable } = root.result
  const title = isAppEnable ? 'Home' : siteConfig.description

  return [
    {
      title: titleTemplate(title, { separator: isAppEnable }),
    },
  ]
}

export default function MainHome() {
  const appEnable = useAppEnable()
  const { pathname } = useLocation()
  const isIndexPath = pathname === '/'

  let content: ReactElement | null = null

  if (import.meta.env.SSR) {
    if (isIndexPath) {
      content = appEnable ? null : <MarketingHomeScreenServer.Component />
    } else if (isAppRoute(appRoutes, pathname)) {
      content = null
    } else {
      content = <Outlet />
    }
  } else {
    if (isIndexPath) {
      content = appEnable ? <AppMainScreenClient.Component /> : <MarketingHomeScreenClient.Component />
    } else if (isAppRoute(appRoutes, pathname)) {
      content = <AppMainScreenClient.Component />
    } else {
      content = <Outlet />
    }
  }

  return content
}

export function ErrorBoundary() {
  return <RouterDataErrorBoundary />
}
