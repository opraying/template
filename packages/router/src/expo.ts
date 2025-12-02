import { router } from 'expo-router'
import type { Href, NavigationMethods, NavigationOptions, RouteInputParams } from './navigate'

// Helper function to convert our Href to expo-router's format
const convertToExpoHref = (href: Href): string | { pathname: string; params?: Record<string, string> } => {
  if (typeof href === 'string') {
    return href
  }
  return {
    pathname: href.pathname,
    params: href.params || ({} as any),
  }
}

// Helper function to convert our NavigationOptions to expo-router's format
const convertToExpoOptions = (options?: NavigationOptions) => {
  if (!options) return undefined

  // Expo router only supports these specific options
  const expoOptions: { relativeToDirectory?: boolean; withAnchor?: boolean } = {}

  if (options.relativeToDirectory !== undefined) {
    expoOptions.relativeToDirectory = options.relativeToDirectory
  }

  if (options.withAnchor !== undefined) {
    expoOptions.withAnchor = options.withAnchor
  }

  return Object.keys(expoOptions).length > 0 ? expoOptions : undefined
}

// Core Expo Router navigation implementation - synchronous functions
export const makeExpoRouterNavigate = (): NavigationMethods => {
  return {
    canDismiss: () => router.canDismiss(),
    canGoBack: () => router.canGoBack(),
    dismiss: () => router.dismiss(),
    dismissAll: () => router.dismissAll(),
    dismissTo: (href: Href, _options?: NavigationOptions) => {
      const expoHref = convertToExpoHref(href)
      if (typeof expoHref === 'string') {
        router.dismissTo(expoHref)
      } else {
        // For object hrefs, expo-router expects the full object
        router.dismissTo(expoHref as any)
      }
    },
    navigate: (href: Href, _options?: NavigationOptions) => {
      const expoHref = convertToExpoHref(href)
      if (typeof expoHref === 'string') {
        router.navigate(expoHref)
      } else {
        // For object hrefs, expo-router expects the full object
        router.navigate(expoHref as any)
      }
    },
    prefetch: (name: Href) => {
      const path = typeof name === 'string' ? name : name.pathname
      router.prefetch(path)
    },
    push: (href: Href, options?: NavigationOptions) => {
      const expoHref = convertToExpoHref(href)
      const expoOptions = convertToExpoOptions(options)

      if (typeof expoHref === 'string') {
        if (expoOptions) {
          router.push(expoHref, expoOptions)
        } else {
          router.push(expoHref)
        }
      } else {
        if (expoOptions) {
          router.push(expoHref as any, expoOptions)
        } else {
          router.push(expoHref as any)
        }
      }
    },
    replace: (href: Href, options?: NavigationOptions) => {
      const expoHref = convertToExpoHref(href)
      const expoOptions = convertToExpoOptions(options)

      if (typeof expoHref === 'string') {
        if (expoOptions) {
          router.replace(expoHref, expoOptions)
        } else {
          router.replace(expoHref)
        }
      } else {
        if (expoOptions) {
          router.replace(expoHref as any, expoOptions)
        } else {
          router.replace(expoHref as any)
        }
      }
    },
    setParams: <T = any>(params: Partial<RouteInputParams<T>>) => {
      // Convert params to string format as expo-router expects
      const stringParams: Record<string, string> = {}
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          if (Array.isArray(value)) {
            // For arrays, join with comma or use first value
            stringParams[key] = value.join(',')
          } else {
            stringParams[key] = String(value)
          }
        }
      })
      router.setParams(stringParams)
    },
    back: (_delta?: number) => router.back(),
  }
}
