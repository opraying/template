// @ts-nocheck
import { use, useCallback, useEffect, useLayoutEffect } from 'react'
import {
  UNSAFE_DataRouterContext,
  UNSAFE_DataRouterStateContext,
  useLocation,
  useMatches,
  useNavigation,
} from 'react-router'

function usePageHide(
  callback: () => void,
  options?: {
    capture?: boolean
  },
) {
  const { capture } = options || {}

  useEffect(() => {
    const opts =
      capture != null
        ? {
            capture,
          }
        : undefined
    window.addEventListener('pagehide', callback, opts)
    return () => {
      window.removeEventListener('pagehide', callback, opts)
    }
  }, [callback, capture])
}

const SCROLL_RESTORATION_STORAGE_KEY = 'react-router-scroll-positions'
let savedScrollPositions = {}

function useScrollRestoration({ getKey, storageKey } = {}) {
  const { router } = use(UNSAFE_DataRouterContext)
  const { preventScrollReset, restoreScrollPosition } = use(UNSAFE_DataRouterStateContext)
  const location = useLocation()
  const matches = useMatches()
  const navigation = useNavigation()

  // Trigger manual scroll restoration while we're active
  useEffect(() => {
    window.history.scrollRestoration = 'manual'
    return () => {
      window.history.scrollRestoration = 'auto'
    }
  }, [])

  // Save positions on pagehide
  usePageHide(
    useCallback(() => {
      if (navigation.state === 'idle') {
        const key = (getKey ? getKey(location, matches) : null) || location.key
        const root = document.getElementById('root-layout')
        savedScrollPositions[key] = root.scrollTop
      }

      try {
        sessionStorage.setItem(storageKey || SCROLL_RESTORATION_STORAGE_KEY, JSON.stringify(savedScrollPositions))
      } catch (error) {
        console.log(
          `Failed to save scroll positions in sessionStorage, <ScrollRestoration /> will not work properly (${error}).`,
        )
      }
      window.history.scrollRestoration = 'auto'
    }, [storageKey, getKey, navigation.state, location, matches]),
  )

  const basename = '/'

  // Read in any saved scroll locations
  useLayoutEffect(() => {
    try {
      const sessionPositions = sessionStorage.getItem(storageKey || SCROLL_RESTORATION_STORAGE_KEY)
      if (sessionPositions) {
        savedScrollPositions = JSON.parse(sessionPositions)
      }
    } catch (_e) {
      // no-op, use default empty object
    }
  }, [storageKey])

  // Enable scroll restoration in the router
  useLayoutEffect(() => {
    const getKeyWithoutBasename =
      getKey && basename !== '/'
        ? (location, matches) =>
            getKey(
              // Strip the basename to match useLocation()
              {
                ...location,
                pathname: location.pathname,
              },
              matches,
            )
        : getKey

    const disableScrollRestoration = router?.enableScrollRestoration(
      savedScrollPositions,
      () => {
        const top = document.getElementById('root-layout').scrollTop
        return top
      },
      getKeyWithoutBasename,
    )
    return () => disableScrollRestoration?.()
  }, [router, getKey])

  // Restore scrolling when state.restoreScrollPosition changes

  useLayoutEffect(() => {
    // Explicit false means don't do anything (used for submissions)
    if (restoreScrollPosition === false) {
      return
    }

    // been here before, scroll to it
    if (typeof restoreScrollPosition === 'number') {
      const top = restoreScrollPosition || savedScrollPositions[location.pathname] || 0

      setTimeout(() => {
        const root = document.getElementById('root-layout')

        root.scroll({
          top,
          behavior: 'instant',
        })
      }, 0)
      return
    }

    // try to scroll to the hash
    if (location.hash) {
      const el = document.getElementById(decodeURIComponent(location.hash.slice(1)))
      if (el) {
        el.scrollIntoView()
        return
      }
    }

    // Don't reset if this navigation opted out
    if (preventScrollReset === true) {
      return
    }

    // otherwise go to the top on new locations
    window.scrollTo(0, 0)
  }, [location])
}

export function useAppScrollRestoration() {
  useScrollRestoration({
    getKey: (location, _matches) => {
      // default behavior
      return location.pathname
    },
    storageKey: SCROLL_RESTORATION_STORAGE_KEY,
  })
}
