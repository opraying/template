import type { NavigateFunction } from 'react-router'
import { useLinkHandler as useLinkHandlerBase } from '@/lib/hooks/use-link-handler'

export function useLinkHandler() {
  const handle = (
    href: string,
    {
      replace,
      viewTransition,
    }: {
      replace?: boolean
      viewTransition?: boolean
    },
  ) => {
    const navigate = (globalThis as any as { __reactRouterDataRouter: { navigate: NavigateFunction } })
      .__reactRouterDataRouter.navigate

    const location = window.location
    const to = href.replace(location.origin, '')
    const current = location.pathname + location.hash + location.search

    if (to === current) {
      return
    }

    navigate(to, {
      replace: replace ?? false,
      viewTransition: viewTransition ?? false,
    })
  }

  useLinkHandlerBase(handle)
}
