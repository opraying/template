import { DebugPanel } from '@xstack/app/debug/debug-panel'
import { EffectDebug } from '@xstack/app/layout/effect-debug'
import { isAppRoute } from '@xstack/react-router/utils'
import { lazy, useMemo } from 'react'
import { Inspector } from 'react-dev-inspector'
import { useLocation } from 'react-router'
import { useHydrated } from '@/lib/hooks/use-hydrated'

const LazyDatabaseItem = lazy(() =>
  import('@xstack/app/debug/database/view').then((_) => ({ default: _.DatabaseItem })),
)

function isIframe(): boolean {
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}

const View = ({ appRoutes }: { appRoutes: Array<string> }) => {
  const { pathname } = useLocation()
  const appRoute = isAppRoute(appRoutes, pathname)
  const right = useMemo(
    () => [
      appRoute && <LazyDatabaseItem key="database" />,
      <EffectDebug key="effect" sqlEnable={appRoute} isAppRoute={appRoute} />,
    ],
    [appRoute],
  )

  return <DebugPanel right={right} />
}

export const Debug = ({ appRoutes }: { appRoutes: string[] }) => {
  const hydrated = useHydrated()

  return hydrated && !isIframe() ? (
    <>
      <View appRoutes={appRoutes} />
      <Inspector keys={['Alt', 'A']} />
    </>
  ) : null
}
