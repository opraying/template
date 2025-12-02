/**
 * This module provides reactive state management using Effect-Atom for:
 * - Menu opened/closed state with localStorage persistence
 * - Settings navigation state synchronized with URL routing
 * - Screen size responsive hooks
 *
 * Key features:
 * - Race condition prevention in URL/state synchronization
 * - Proper error handling and fallback states
 * - TypeScript strict mode compatibility
 * - Memory leak prevention with proper cleanup
 * - Backward compatibility maintained
 *
 * @version 1.0.0
 */
import { useAtom, Atom } from '@xstack/atom-react'
import { useCallback, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useIsDesktopScreen, useIsLargeScreen, useScreenQuery } from '@xstack/app-kit/lib/screen-utils'

/**
 * Type for menu opened state setter function
 */
type MenuOpenedSetter = (value: boolean) => void

/**
 * Type for settings item setter function
 */
type SettingsItemSetter = (item: SettingsOpenItem | null) => void

/**
 * Navigation functions for settings
 */
interface SettingsNavigation {
  readonly navigateToSetting: (settingId: string) => void
  readonly navigateToSettingsList: () => void
}

/**
 * Hook to check if screen is greater than small (md and above)
 * @returns boolean indicating if screen is md or larger
 */
export const useGtSmallScreen = () => {
  return useScreenQuery('md')
}

/**
 * Hook to check if screen is greater than medium (lg and above)
 * @returns boolean indicating if screen is lg or larger
 */
export const useGtLargeScreen = () => {
  return useIsLargeScreen()
}

/**
 * Safely gets the initial menu opened state
 * @returns boolean indicating if menu should be opened by default
 */
const getInitialMenuOpenedState = (): boolean => {
  if (typeof window === 'undefined') return true

  try {
    const storedValue = window.localStorage.getItem('menu-opened')
    if (storedValue !== null) {
      return storedValue === 'true'
    }

    // Fallback to screen size detection
    return window.innerWidth >= 1024 // lg breakpoint
  } catch (error) {
    // localStorage might not be available (private browsing, etc.)
    console.warn('Failed to access localStorage for menu state:', error)
    return window.innerWidth >= 1024
  }
}

/**
 * Global atom for menu opened state
 */
export const menuOpenedAtom = Atom.make(getInitialMenuOpenedState())

/**
 * Hook for managing menu opened state with localStorage persistence
 * Automatically handles large screens where menu state doesn't apply
 * @returns tuple of [opened state, setter function]
 */
export const useMenuOpened = (): readonly [boolean, MenuOpenedSetter] => {
  const [opened, setOpened] = useAtom(menuOpenedAtom)
  const isLargeScreen = useGtLargeScreen()

  const setMenuOpened = useCallback(
    (value: boolean) => {
      // On large screens, menu is always considered "opened"
      if (isLargeScreen) return

      setOpened(value)

      // Safely persist to localStorage
      try {
        window.localStorage.setItem('menu-opened', value.toString())
      } catch (error) {
        console.warn('Failed to persist menu state to localStorage:', error)
      }
    },
    [isLargeScreen, setOpened],
  )

  return [opened, setMenuOpened] as const
}

/**
 * Interface for settings open item state
 */
export interface SettingsOpenItem {
  readonly id: string
}

/**
 * Type guard to check if value is a valid SettingsOpenItem
 * @param value - Value to check
 * @returns true if value is a valid SettingsOpenItem
 */
export const isSettingsOpenItem = (value: unknown): value is SettingsOpenItem => {
  return (
    typeof value === 'object' && value !== null && typeof (value as any).id === 'string' && (value as any).id.length > 0
  )
}

/**
 * Global atom for currently opened settings item
 */
const settingOpenItemAtom = Atom.make<SettingsOpenItem | null>(null)

/**
 * Hook for programmatic settings navigation with proper error handling
 * Can be called from anywhere in the app to switch settings
 * @returns object with navigation functions
 */
export const useSettingsNavigation = (): SettingsNavigation => {
  const navigate = useNavigate()
  const [, setSettingOpenItem] = useAtom(settingOpenItemAtom)

  const navigateToSetting = useCallback(
    (settingId: string) => {
      if (!settingId || typeof settingId !== 'string' || settingId.trim().length === 0) {
        console.warn('Invalid settingId provided to navigateToSetting:', settingId)
        return
      }

      const trimmedId = settingId.trim()

      try {
        // Update both state and URL simultaneously
        setSettingOpenItem({ id: trimmedId })
        navigate(`/settings/${trimmedId}`, { replace: false })
      } catch (error) {
        console.warn('Failed to navigate to setting:', error)
      }
    },
    [setSettingOpenItem, navigate],
  )

  const navigateToSettingsList = useCallback(() => {
    try {
      setSettingOpenItem(null)
      navigate('/settings', { replace: false })
    } catch (error) {
      console.warn('Failed to navigate to settings list:', error)
    }
  }, [setSettingOpenItem, navigate])

  return {
    navigateToSetting,
    navigateToSettingsList,
  } as const
}

// Utility functions for external consumers

/**
 * Utility functions for testing and external access
 * Note: These provide direct access to atoms without React hooks
 */

/**
 * Get the current menu opened state atom (for advanced usage)
 * @returns the menu opened atom
 */
export const getMenuOpenedAtom = () => menuOpenedAtom

/**
 * Get the current settings open item atom (for advanced usage)
 * @returns the settings open item atom
 */
export const getSettingsOpenItemAtom = () => settingOpenItemAtom

/**
 * Enhanced hook that syncs settings state with URL history
 * Supports both URL navigation and programmatic switching with proper race condition handling
 * @returns tuple of [current settings item, setter function]
 */
export const useSettingOpenItem = (): readonly [SettingsOpenItem | null, SettingsItemSetter] => {
  const [settingOpenItem, setSettingOpenItemRaw] = useAtom(settingOpenItemAtom)
  const location = useLocation()
  const navigate = useNavigate()
  const isDesktop = useIsDesktopScreen()

  // Use refs to track state and prevent infinite loops
  const lastProcessedUrlRef = useRef<string>('')
  const lastProcessedStateIdRef = useRef<string | null>(null)
  const isNavigatingRef = useRef<boolean>(false)

  // Extract and validate current module from URL
  const moduleFromUrl = location.pathname.startsWith('/settings/')
    ? location.pathname.split('/settings/')[1]?.split('/')[0] || ''
    : ''

  // Sync URL changes to global state with race condition prevention
  useEffect(() => {
    const currentStateId = settingOpenItem?.id || null
    const currentUrl = location.pathname

    // Skip if we're in the middle of a programmatic navigation
    if (isNavigatingRef.current) {
      isNavigatingRef.current = false
      return
    }

    // Only update if URL or state actually changed
    const urlChanged = currentUrl !== lastProcessedUrlRef.current
    const stateChanged = currentStateId !== lastProcessedStateIdRef.current

    if (urlChanged || stateChanged) {
      if (moduleFromUrl && moduleFromUrl !== currentStateId) {
        // URL has a module that differs from current state
        setSettingOpenItemRaw({ id: moduleFromUrl })
      } else if (!moduleFromUrl && currentStateId) {
        // URL shows base settings but state has a specific item
        setSettingOpenItemRaw(null)
      }

      // Update tracking refs
      lastProcessedUrlRef.current = currentUrl
      lastProcessedStateIdRef.current = currentStateId
    }
  }, [location.pathname, moduleFromUrl, settingOpenItem?.id, setSettingOpenItemRaw])

  // Cleanup effect to reset navigation flag on unmount
  useEffect(() => {
    return () => {
      isNavigatingRef.current = false
    }
  }, [])

  // Enhanced setter with proper navigation handling
  const setSettingOpenItem = useCallback(
    (item: SettingsOpenItem | null) => {
      // Validate input
      if (item !== null && !isSettingsOpenItem(item)) {
        console.warn('Invalid SettingsOpenItem provided:', item)
        return
      }

      const targetPath = item?.id ? `/settings/${item.id}` : '/settings'
      const currentPath = location.pathname

      // Only navigate if path actually changes
      if (currentPath !== targetPath) {
        isNavigatingRef.current = true

        // Navigation strategy:
        // - Desktop: always replace for seamless switching
        // - Mobile: push when selecting item, replace when going back to list
        const shouldReplace = isDesktop || (!item?.id && currentPath.startsWith('/settings/'))

        try {
          navigate(targetPath, { replace: shouldReplace })
        } catch (error) {
          console.warn('Navigation failed:', error)
          isNavigatingRef.current = false
          // Fallback to direct state update
          setSettingOpenItemRaw(item)
        }
      } else if (settingOpenItem?.id !== item?.id) {
        // Path is the same but state differs - update state directly
        setSettingOpenItemRaw(item)
      }
    },
    [location.pathname, navigate, settingOpenItem?.id, setSettingOpenItemRaw, isDesktop],
  )

  return [settingOpenItem, setSettingOpenItem] as const
}
