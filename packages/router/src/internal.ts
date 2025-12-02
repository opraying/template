import * as Effect from 'effect/Effect'
import type { Href, Navigation, NavigationMethods, NavigationOptions, RouteInputParams } from './navigate'

// Helper function to wrap synchronous navigation methods with Effect.sync
export const wrapWithEffect = (methods: NavigationMethods): Navigation => ({
  back: (delta?: number) => Effect.sync(() => methods.back(delta)),
  canDismiss: () => Effect.sync(methods.canDismiss),
  canGoBack: () => Effect.sync(methods.canGoBack),
  dismiss: () => Effect.sync(methods.dismiss),
  dismissAll: () => Effect.sync(methods.dismissAll),
  dismissTo: (href: Href, options?: NavigationOptions) => Effect.sync(() => methods.dismissTo(href, options)),
  navigate: (href: Href, options?: NavigationOptions) => Effect.sync(() => methods.navigate(href, options)),
  prefetch: (name: Href) => Effect.sync(() => methods.prefetch(name)),
  push: (href: Href, options?: NavigationOptions) => Effect.sync(() => methods.push(href, options)),
  replace: (href: Href, options?: NavigationOptions) => Effect.sync(() => methods.replace(href, options)),
  setParams: <T = any>(params: Partial<RouteInputParams<T>>) => Effect.sync(() => methods.setParams(params)),
})
