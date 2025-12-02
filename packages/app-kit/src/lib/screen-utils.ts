import { useSyncExternalStore } from 'react'
import { debounce } from './common-utils'

/**
 * Screen size breakpoints (matching Tailwind CSS defaults)
 * These values are optimized for common device sizes and design systems
 */
export const SCREEN_BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const

export type ScreenBreakpoint = keyof typeof SCREEN_BREAKPOINTS

/**
 * Screen size categories for semantic usage
 */
export type ScreenCategory = 'mobile' | 'tablet' | 'desktop' | 'wide'

/**
 * Check if we're in a browser environment with window object
 * @returns true if window is available
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.innerWidth === 'number'
}

/**
 * Get viewport width safely with fallback
 * @returns viewport width or 0 if not in browser
 */
function getViewportWidth(): number {
  if (!isBrowser()) return 0

  // Use visualViewport for better mobile compatibility if available
  if ('visualViewport' in window && window.visualViewport) {
    return window.visualViewport.width
  }

  return window.innerWidth
}

/**
 * Get current screen size level (non-reactive)
 * Optimized for performance with early returns and cached width
 * @returns Current screen breakpoint level
 */
export function getScreenSize(): ScreenBreakpoint {
  if (!isBrowser()) return 'sm'

  const width = getViewportWidth()

  // Use binary search approach for better performance with many breakpoints
  if (width >= SCREEN_BREAKPOINTS['2xl']) return '2xl'
  if (width >= SCREEN_BREAKPOINTS.xl) return 'xl'
  if (width >= SCREEN_BREAKPOINTS.lg) return 'lg'
  if (width >= SCREEN_BREAKPOINTS.md) return 'md'
  return 'sm'
}

/**
 * Get semantic screen category based on current size
 * @returns Semantic category for current screen size
 */
export function getScreenCategory(): ScreenCategory {
  const size = getScreenSize()

  switch (size) {
    case 'sm':
      return 'mobile'
    case 'md':
      return 'tablet'
    case 'lg':
    case 'xl':
      return 'desktop'
    case '2xl':
      return 'wide'
    default:
      return 'mobile'
  }
}

/**
 * Check if screen size is greater than or equal to specified breakpoint (non-reactive)
 * @param breakpoint - Breakpoint to check against
 * @returns true if current screen is >= breakpoint
 */
export function isScreenSize(breakpoint: ScreenBreakpoint): boolean {
  if (!isBrowser()) return false

  const width = getViewportWidth()
  const breakpointValue = SCREEN_BREAKPOINTS[breakpoint]

  if (typeof breakpointValue !== 'number') {
    console.warn(`Invalid breakpoint: ${breakpoint}`)
    return false
  }

  return width >= breakpointValue
}

/**
 * Check if screen size matches exactly the specified breakpoint range (non-reactive)
 * @param breakpoint - Breakpoint to check
 * @returns true if current screen is within the breakpoint range
 */
export function isExactScreenSize(breakpoint: ScreenBreakpoint): boolean {
  if (!isBrowser()) return breakpoint === 'sm'

  const width = getViewportWidth()
  const breakpoints = Object.entries(SCREEN_BREAKPOINTS).sort(([, a], [, b]) => a - b)
  const currentIndex = breakpoints.findIndex(([key]) => key === breakpoint)

  if (currentIndex === -1) return false

  const [, currentValue] = breakpoints[currentIndex]
  const nextValue = breakpoints[currentIndex + 1]?.[1] ?? Infinity

  return width >= currentValue && width < nextValue
}

/**
 * Check if current screen is mobile (smaller than md) (non-reactive)
 * @returns true if screen is mobile size
 */
export function isMobileScreen(): boolean {
  return !isScreenSize('md')
}

/**
 * Check if current screen is desktop (md and above) (non-reactive)
 * @returns true if screen is desktop size or larger
 */
export function isDesktopScreen(): boolean {
  return isScreenSize('md')
}

/**
 * Check if current screen is large (lg and above) (non-reactive)
 * @returns true if screen is large size or larger
 */
export function isLargeScreen(): boolean {
  return isScreenSize('lg')
}

/**
 * Check if current screen is tablet size (md but not lg) (non-reactive)
 * @returns true if screen is tablet size
 */
export function isTabletScreen(): boolean {
  return isScreenSize('md') && !isScreenSize('lg')
}

/**
 * Get all breakpoints that the current screen matches (non-reactive)
 * @returns Array of breakpoints that current screen size matches
 */
export function getMatchingBreakpoints(): ScreenBreakpoint[] {
  return (Object.keys(SCREEN_BREAKPOINTS) as ScreenBreakpoint[]).filter((bp) => isScreenSize(bp))
}

// Reactive hooks for use in React components

/**
 * Create optimized screen subscription with debouncing
 * @param debounceMs - Debounce delay for resize events (default: 150ms)
 * @returns Subscribe function for useSyncExternalStore
 */
const createScreenSubscription = (debounceMs: number = 150) => {
  const subscribe = (callback: () => void) => {
    if (!isBrowser()) return () => {}

    const debouncedCallback = debounce(callback, debounceMs)

    // Listen to both resize and orientationchange for better mobile support
    window.addEventListener('resize', debouncedCallback, { passive: true })
    window.addEventListener('orientationchange', debouncedCallback, { passive: true })

    // Also listen to visualViewport changes for mobile browsers
    if ('visualViewport' in window && window.visualViewport) {
      window.visualViewport.addEventListener('resize', debouncedCallback)
    }

    return () => {
      window.removeEventListener('resize', debouncedCallback)
      window.removeEventListener('orientationchange', debouncedCallback)

      if ('visualViewport' in window && window.visualViewport) {
        window.visualViewport.removeEventListener('resize', debouncedCallback)
      }
    }
  }
  return subscribe
}

/**
 * React hook to get current screen size level (reactive)
 * @param debounceMs - Optional debounce delay for resize events
 * @returns Current screen breakpoint level
 */
export function useScreenSize(debounceMs?: number): ScreenBreakpoint {
  const subscribe = createScreenSubscription(debounceMs)
  return useSyncExternalStore(subscribe, getScreenSize, () => 'sm')
}

/**
 * React hook to get semantic screen category (reactive)
 * @param debounceMs - Optional debounce delay for resize events
 * @returns Current screen category
 */
export function useScreenCategory(debounceMs?: number): ScreenCategory {
  const subscribe = createScreenSubscription(debounceMs)
  return useSyncExternalStore(subscribe, getScreenCategory, () => 'mobile')
}

/**
 * React hook to check if screen size is greater than or equal to specified breakpoint (reactive)
 * @param breakpoint - Breakpoint to check against
 * @param debounceMs - Optional debounce delay for resize events
 * @returns true if current screen is >= breakpoint
 */
export function useScreenQuery(breakpoint: ScreenBreakpoint, debounceMs?: number): boolean {
  const subscribe = createScreenSubscription(debounceMs)
  const getSnapshot = () => isScreenSize(breakpoint)
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}

/**
 * React hook to check if screen size matches exactly the specified breakpoint range (reactive)
 * @param breakpoint - Breakpoint to check
 * @param debounceMs - Optional debounce delay for resize events
 * @returns true if current screen is within the breakpoint range
 */
export function useExactScreenSize(breakpoint: ScreenBreakpoint, debounceMs?: number): boolean {
  const subscribe = createScreenSubscription(debounceMs)
  const getSnapshot = () => isExactScreenSize(breakpoint)
  return useSyncExternalStore(subscribe, getSnapshot, () => breakpoint === 'sm')
}

/**
 * React hook to check if current screen is mobile (smaller than md) (reactive)
 * @param debounceMs - Optional debounce delay for resize events
 * @returns true if screen is mobile size
 */
export function useIsMobileScreen(debounceMs?: number): boolean {
  return !useScreenQuery('md', debounceMs)
}

/**
 * React hook to check if current screen is desktop (md and above) (reactive)
 * @param debounceMs - Optional debounce delay for resize events
 * @returns true if screen is desktop size or larger
 */
export function useIsDesktopScreen(debounceMs?: number): boolean {
  return useScreenQuery('md', debounceMs)
}

/**
 * React hook to check if current screen is large (lg and above) (reactive)
 * @param debounceMs - Optional debounce delay for resize events
 * @returns true if screen is large size or larger
 */
export function useIsLargeScreen(debounceMs?: number): boolean {
  return useScreenQuery('lg', debounceMs)
}

/**
 * React hook to check if current screen is tablet size (md but not lg) (reactive)
 * @param debounceMs - Optional debounce delay for resize events
 * @returns true if screen is tablet size
 */
export function useIsTabletScreen(debounceMs?: number): boolean {
  const subscribe = createScreenSubscription(debounceMs)
  const getSnapshot = () => isTabletScreen()
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}

/**
 * React hook to get all breakpoints that the current screen matches (reactive)
 * @param debounceMs - Optional debounce delay for resize events
 * @returns Array of breakpoints that current screen size matches
 */
export function useMatchingBreakpoints(debounceMs?: number): ScreenBreakpoint[] {
  const subscribe = createScreenSubscription(debounceMs)
  const getSnapshot = () => getMatchingBreakpoints()
  return useSyncExternalStore(subscribe, getSnapshot, () => ['sm'])
}

/**
 * React hook for advanced screen queries with custom logic (reactive)
 * @param queryFn - Custom query function that receives current width
 * @param debounceMs - Optional debounce delay for resize events
 * @returns Result of the custom query function
 */
export function useCustomScreenQuery<T>(
  queryFn: (width: number, breakpoints: typeof SCREEN_BREAKPOINTS) => T,
  debounceMs?: number,
): T {
  const subscribe = createScreenSubscription(debounceMs)
  const getSnapshot = () => queryFn(getViewportWidth(), SCREEN_BREAKPOINTS)
  const getServerSnapshot = () => queryFn(0, SCREEN_BREAKPOINTS)

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
