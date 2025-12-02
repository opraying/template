import * as R from 'remeda'

export interface ThemeColors {
  primary: string
  text: {
    primary: string
    secondary: string
    link: string
  }
  border: string
  background: {
    main: string
    card: string
  }
  radius: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
}

export const radiusMap = {
  xs: 5,
  sm: 8,
  md: 10,
  lg: 16,
  xl: 20,
} as const

export const getRadius = (radius: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | undefined, value?: number) => {
  let v = radiusMap[radius || 'md']
  if (value) {
    v += value
  }
  return `${v}px`
}

export const defaultTheme: ThemeColors = {
  primary: '#4F46E5',
  text: {
    primary: '#1F2937',
    secondary: '#4B5563',
    link: '#4338CA',
  },
  border: '#E5E7EB',
  background: {
    main: '#F9FAFB',
    card: '#FFFFFF',
  },
  radius: 'sm',
}

export const useTheme = () => {
  // @ts-ignore
  return globalThis.theme as ThemeColors
}

export interface ThemeProviderProps {
  theme: Partial<ThemeColors> | undefined
  children: React.ReactNode
}

/**
 * jsx current not support hooks in context
 * https://github.com/shellscape/jsx-email/issues/108
 */
export const ThemeProvider = ({ theme, children }: ThemeProviderProps) => {
  const mergedTheme = R.mergeDeep(defaultTheme, theme || {})

  // @ts-ignore
  globalThis.theme = mergedTheme

  return children
}
