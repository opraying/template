import { useMediaQuery } from '@/lib/hooks/use-media-query'

const queryMap = {
  '2xl': '(min-width: 1536px)',
  xl: '(min-width: 1280px)',
  lg: '(min-width: 1024px)',
  md: '(min-width: 768px)',
  sm: '(min-width: 640px)',
  xs: '(min-width: 480px)',
}

export function useScreenQuery(
  size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl',
  initialValue?: boolean,
  options: {
    getInitialValueInEffect: boolean
  } = {
    getInitialValueInEffect: true,
  },
) {
  const query = queryMap[size]

  const defaultValue =
    // @ts-ignore
    initialValue ??
    (() => {
      if (typeof window === 'undefined') return false
      // @ts-ignore
      if (!window._screen_) {
        // @ts-ignore
        window._screen_ = {}
      }
      // @ts-ignore
      return (window._screen_[size] as boolean) || false
    })

  return useMediaQuery(query, defaultValue, options)
}
