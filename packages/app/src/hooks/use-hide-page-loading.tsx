import { useIsomorphicEffect } from '@/lib/hooks/use-isomorphic-effect'

export function useHidePageLoading() {
  useIsomorphicEffect(() => {
    // @ts-ignore
    window.hideLoading?.()
  }, [])
}

export function usePageIndicatorActions() {
  return {
    // @ts-ignore
    hide: () => window.hideLoading?.(),
    // @ts-ignore
    show: () => window.showLoading?.(),
  }
}
