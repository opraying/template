import { createContext, type ReactNode, useEffect, useState } from 'react'

export type Appearance = 'dark' | 'light' | 'system'

export type Theme = 'default' | 'custom' | string

export interface ThemeConfig {
  name: Theme
  light: Record<string, any>
  dark: Record<string, any>
}
export type Themes = ThemeConfig[]

export interface ThemeV2 {
  /**
   * @example "minimal"
   */
  type: string
  /**
   * @example "Minimal Light" | "Minimal Dark"
   */
  name: string
  /**
   * @example "minimal-light" | "minimal-dark"
   */
  theme: string
  /**
   * @example "minimal-modern" | "minimal-rounded"
   */
  shape?: string | undefined
  /**
   * @example "#fff"
   */
  color?: string
}

export interface ThemeV2Group {
  name: string
  icon: ReactNode
  themes: ThemeV2[]
  config: {
    // 允许手动切换 Light/Dark
    allowSwitch?: boolean | 'auto'
  }
}

export const DefaultStorageKeys = {
  appearance: 'ui-appearance',
  theme: 'ui-theme',
} as const

export interface AppearanceProviderProps {
  children: ReactNode
  appearances?: Appearance[]
  defaultAppearance?: Appearance

  storageKeys?: {
    appearance?: string
    theme?: string | undefined
  }
}

interface AppearanceProviderState {
  appearance: Appearance
  resolvedAppearance: 'light' | 'dark'
  appearances: Appearance[]
  setAppearance: (appearance: Appearance) => void
  toggleAppearance: () => void
}

const initialState: AppearanceProviderState = {
  appearance: 'system',
  resolvedAppearance: 'light',
  appearances: ['light', 'dark', 'system'],
  setAppearance: () => null,
  toggleAppearance: () => null,
}

export const AppearanceProviderContext = createContext<AppearanceProviderState>(initialState)

export const getMatchMedia = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') {
    return 'light' // Server-side fallback
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const resolveAppearanceToTheme = (appearance: Appearance): 'light' | 'dark' => {
  if (appearance === 'system') {
    return getMatchMedia()
  }
  return appearance
}

export const getStoredAppearance = (storageKey: string = DefaultStorageKeys.appearance): Appearance => {
  if (typeof localStorage === 'undefined') {
    return 'system' // Server-side fallback
  }
  return (localStorage.getItem(storageKey) as Appearance) || 'system'
}

export const getStoredTheme = (storageKey: string = DefaultStorageKeys.theme): Theme => {
  if (typeof localStorage === 'undefined') {
    return 'default' // Server-side fallback
  }
  return (localStorage.getItem(storageKey) as Theme) || 'default'
}

export const updateDocumentAppearance = (
  resolvedAppearance: 'light' | 'dark',
  appearances: Appearance[] = ['light', 'dark', 'system'],
) => {
  if (typeof document === 'undefined') return

  const root = document.documentElement
  root.classList.remove(...appearances.filter((a) => a !== 'system'))
  root.classList.add(resolvedAppearance)
}

export function AppearanceProvider(props: AppearanceProviderProps) {
  const appearances = props.appearances || initialState.appearances
  const appearanceStorageKey = props.storageKeys?.appearance ?? DefaultStorageKeys.appearance

  const [appearance, setAppearance] = useState<Appearance>(
    () => getStoredAppearance(appearanceStorageKey) || props.defaultAppearance || initialState.appearance,
  )

  const [resolvedAppearance, setResolvedAppearance] = useState<AppearanceProviderState['resolvedAppearance']>(() =>
    resolveAppearanceToTheme(appearance),
  )

  const updateAppearanceResolved = (appearance: Appearance) => {
    const resolved = resolveAppearanceToTheme(appearance)
    setResolvedAppearance(resolved)
    return resolved
  }

  const setAppearance_ = (appearance: Appearance) => {
    setAppearance(appearance)
    const resolved = updateAppearanceResolved(appearance)
    localStorage.setItem(appearanceStorageKey, appearance)
    updateDocumentAppearance(resolved, appearances)
  }

  const toggleAppearance = () => {
    const newAppearance: Appearance = resolvedAppearance === 'dark' ? 'light' : 'dark'
    setAppearance_(newAppearance)
  }

  useEffect(() => {
    updateDocumentAppearance(resolvedAppearance, appearances)
  }, [resolvedAppearance, appearances])

  // listen system scheme change
  useEffect(() => {
    const listener = (event: MediaQueryListEvent) => {
      if (appearance !== 'system') return
      const resolved = event.matches ? 'dark' : 'light'
      setResolvedAppearance(resolved)
      updateDocumentAppearance(resolved, appearances)
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', listener)

    return () => mediaQuery.removeEventListener('change', listener)
  }, [appearance, appearances])

  const value = {
    appearance,
    resolvedAppearance,
    appearances,
    setAppearance: setAppearance_,
    toggleAppearance,
  } satisfies AppearanceProviderState

  return <AppearanceProviderContext value={value}>{props.children}</AppearanceProviderContext>
}
