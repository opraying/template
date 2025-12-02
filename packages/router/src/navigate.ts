import * as Context from 'effect/Context'
import type * as Effect from 'effect/Effect'

export type HrefObject = {
  /** The path of the route. */
  pathname: string
  /** Optional parameters for the route. */
  params?: Record<string, string | null> | undefined
}
export type Href = string | HrefObject

// Unified navigation options that work across both expo-router and react-router
export interface NavigationOptions {
  // Common options
  replace?: boolean

  // Expo-router specific options
  relativeToDirectory?: boolean
  withAnchor?: boolean

  // React-router specific options
  preventScrollReset?: boolean
  relative?: 'route' | 'path'
  state?: any
  viewTransition?: boolean
  flushSync?: boolean
}

// Generic route input params type
export type RouteInputParams<T = any> =
  T extends Record<string, any> ? T : Record<string, string | string[] | undefined>

// Core navigation interface - synchronous functions that can be used directly
export interface NavigationMethods {
  readonly back: (delta?: number) => void
  readonly canDismiss: () => boolean
  readonly canGoBack: () => boolean
  readonly dismiss: () => void
  readonly dismissAll: () => void
  readonly dismissTo: (href: Href, options?: NavigationOptions) => void
  readonly navigate: (href: Href, options?: NavigationOptions) => void
  readonly prefetch: (name: Href) => void
  readonly push: (href: Href, options?: NavigationOptions) => void
  readonly replace: (href: Href, options?: NavigationOptions) => void
  readonly setParams: <T = any>(params: Partial<RouteInputParams<T>>) => void
}

// Effect-wrapped navigation interface for use with Effect system
export interface Navigation {
  readonly back: (delta?: number) => Effect.Effect<void>
  readonly canDismiss: () => Effect.Effect<boolean>
  readonly canGoBack: () => Effect.Effect<boolean>
  readonly dismiss: () => Effect.Effect<void>
  readonly dismissAll: () => Effect.Effect<void>
  readonly dismissTo: (href: Href, options?: NavigationOptions) => Effect.Effect<void>
  readonly navigate: (href: Href, options?: NavigationOptions) => Effect.Effect<void>
  readonly prefetch: (name: Href) => Effect.Effect<void>
  readonly push: (href: Href, options?: NavigationOptions) => Effect.Effect<void>
  readonly replace: (href: Href, options?: NavigationOptions) => Effect.Effect<void>
  readonly setParams: <T = any>(params: Partial<RouteInputParams<T>>) => Effect.Effect<void>
}

export const Navigate = Context.GenericTag<Navigation>('@router:navigate')
