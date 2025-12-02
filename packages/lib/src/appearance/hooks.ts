import { use } from 'react'
import {
  type Appearance,
  AppearanceProviderContext,
  DefaultStorageKeys,
  getMatchMedia,
  type Theme,
  type ThemeConfig,
} from './appearance-provider'

const useContext = () => {
  const context = use(AppearanceProviderContext)

  if (context === undefined) {
    throw new Error('useTheme must be used within a AppearanceProvider')
  }

  return context
}

export function useAppearance() {
  const context = useContext()

  return {
    appearances: context.appearances,
    appearance: context.appearance,
    resolvedAppearance: context.resolvedAppearance,
    setAppearance: context.setAppearance,
    toggleAppearance: context.toggleAppearance,
  } as const
}

// export const useTheme = () => {
//   const context = use()

//   return {
//     themes: context.themes,
//     theme: context.theme,
//     setTheme: context.setTheme,
//   } as const
// }

export const getCustomTheme = () => {
  const config = JSON.parse(localStorage.getItem('ui-custom-theme') || '{}')

  return { lightTheme: config.lightVars, darkTheme: config.darkVars }
}

export const getThemeColorCSSVariablesString = (colors: Record<string, any>) => {
  return Object.entries(colors)
    .map(([key, value]) => {
      return `--${key}: ${value};`
    })
    .join('\n')
}

export const getUnsafeAppearance = (): Appearance => {
  return (localStorage.getItem(DefaultStorageKeys.appearance) as Appearance) || getMatchMedia()
}

export function useAppearanceStyles(theme: Theme, themes: ThemeConfig[]) {
  const isCustom = theme === 'custom'

  let lightTheme = {}
  let darkTheme = {}

  if (isCustom) {
    const customTheme = getCustomTheme()
    lightTheme = customTheme.lightTheme
    darkTheme = customTheme.darkTheme
  } else {
    const themeConfig = themes.find((_) => _.name.toLocaleLowerCase() === theme.toLocaleLowerCase())
    if (themeConfig) {
      lightTheme = themeConfig.light
      darkTheme = themeConfig.dark
    }
  }

  const { dark, light } = {
    dark: ':root.dark',
    light: ':root',
  }
  const styles = `${light}, ::before, ::after {
      ${getThemeColorCSSVariablesString(lightTheme)}
    }
    ${dark}, .dark ::before, .dark ::after {
      ${getThemeColorCSSVariablesString(darkTheme)}
    }`

  return { styles }
}
