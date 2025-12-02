import type { NavigateFunction, NavigateOptions } from 'react-router'
import type { Href, NavigationMethods, NavigationOptions, RouteInputParams } from './navigate'

// Helper function to convert our NavigationOptions to react-router's NavigateOptions
const convertToReactRouterOptions = (options?: NavigationOptions): NavigateOptions | undefined => {
  if (!options) return undefined

  const result: NavigateOptions = {}

  if (options.replace !== undefined) result.replace = options.replace
  if (options.preventScrollReset !== undefined) result.preventScrollReset = options.preventScrollReset
  if (options.relative !== undefined) result.relative = options.relative
  if (options.state !== undefined) result.state = options.state
  if (options.viewTransition !== undefined) result.viewTransition = options.viewTransition
  if (options.flushSync !== undefined) result.flushSync = options.flushSync

  return Object.keys(result).length > 0 ? result : undefined
}

// Core React Router navigation implementation - synchronous functions
export const makeReactRouterNavigate = (): NavigationMethods => {
  const navigate = (...args: any) => {
    // @ts-ignore
    let fn = globalThis.__reactRouterDataRouter.navigate as NavigateFunction
    return fn.apply(fn, args)
  }

  return {
    canDismiss: () => false,
    canGoBack: () => window.history.length > 1,
    dismiss: () => window.history.back(),
    dismissAll: () => window.history.go(-window.history.length + 1),
    dismissTo: (href: Href, options?: NavigationOptions) => {
      const path = typeof href === 'string' ? href : href.pathname
      navigate(path, convertToReactRouterOptions(options))
    },
    navigate: (href: Href, options?: NavigationOptions) => {
      if (typeof href === 'string') {
        navigate(href, convertToReactRouterOptions(options))
      } else {
        const searchParams = new URLSearchParams()
        if (href.params) {
          Object.entries(href.params).forEach(([key, value]) => {
            if (value !== undefined) {
              searchParams.set(key, value ?? '')
            }
          })
        }
        const path = href.pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '')
        navigate(path, convertToReactRouterOptions(options))
      }
    },
    prefetch: (name: Href) => {
      // React Router doesn't have built-in prefetching, but we can implement basic link prefetching
      const path = typeof name === 'string' ? name : name.pathname
      const link = document.createElement('link')
      link.rel = 'prefetch'
      link.href = path
      document.head.appendChild(link)
    },
    push: (href: Href, options?: NavigationOptions) => {
      if (typeof href === 'string') {
        navigate(href, {
          ...convertToReactRouterOptions(options),
          replace: false,
        })
      } else {
        const searchParams = new URLSearchParams()
        if (href.params) {
          Object.entries(href.params).forEach(([key, value]) => {
            if (value !== undefined) {
              searchParams.set(key, value ?? '')
            }
          })
        }
        const path = href.pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '')
        navigate(path, {
          ...convertToReactRouterOptions(options),
          replace: false,
        })
      }
    },
    replace: (href: Href, options?: NavigationOptions) => {
      if (typeof href === 'string') {
        navigate(href, {
          ...convertToReactRouterOptions(options),
          replace: true,
        })
      } else {
        const searchParams = new URLSearchParams()
        if (href.params) {
          Object.entries(href.params).forEach(([key, value]) => {
            if (value !== undefined) {
              searchParams.set(key, value ?? '')
            }
          })
        }
        const path = href.pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '')
        navigate(path, {
          ...convertToReactRouterOptions(options),
          replace: true,
        })
      }
    },
    setParams: <T = any>(params: Partial<RouteInputParams<T>>) => {
      const url = new URL(window.location.href)
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          if (Array.isArray(value)) {
            url.searchParams.delete(key)
            value.forEach((v) => url.searchParams.append(key, String(v)))
          } else {
            url.searchParams.set(key, String(value))
          }
        } else {
          url.searchParams.delete(key)
        }
      })
      navigate(url.pathname + url.search, { replace: true })
    },
    back: (delta?: number) => navigate(delta ?? -1),
  }
}
