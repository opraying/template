import { appRoutes } from '@shared/config'
import * as AppLayoutClient from '@shared/layout.client'
import * as MarketingLayoutServer from '@shared/marketing/layout'
import * as MarketingLayoutClient from '@shared/marketing/layout.client'
import { useAppEnable } from '@xstack/app/hooks/use-app-utils'
import { isAppRoute } from '@xstack/react-router/utils'
import type { ReactElement } from 'react'
import { Outlet, useLocation } from 'react-router'
import { RouterDataErrorBoundary } from '@xstack/errors/react/error-boundary'

let appLayout: ReactElement | null = null
let marketingLayout: ReactElement | null = null
if (!import.meta.env.SSR) {
  appLayout = <AppLayoutClient.Component />
  marketingLayout = <MarketingLayoutClient.MarketingLayout />
}

function MainLayout() {
  const appEnable = useAppEnable()
  const { pathname } = useLocation()
  const isIndexPath = pathname === '/'

  let content: ReactElement | null = null

  // Server side
  // Reduce server bundle size, don't import client side files
  if (import.meta.env.SSR) {
    if (isIndexPath) {
      content = appEnable ? null : <MarketingLayoutServer.MarketingLayout />
    } else if (isAppRoute(appRoutes, pathname)) {
      content = null
    } else {
      content = <Outlet />
    }
  } else {
    // Client side
    if (isIndexPath) {
      // 首页需要验证是否启用 APP
      content = appEnable ? appLayout : marketingLayout
    } else if (isAppRoute(appRoutes, pathname)) {
      // 规则内的路由直接进入，会有 Auth Provider 进行验证
      content = appLayout
    } else {
      content = <Outlet />
    }
  }

  return content
}

export default MainLayout

export function shouldRevalidate() {
  return false
}

export function ErrorBoundary() {
  return <RouterDataErrorBoundary />
}
