import { cubicBezier, type Transition } from 'motion'
import { MotionConfig } from 'motion/react'
import { lazy, type ReactNode, useEffect, useRef } from 'react'
import { AppearanceProvider } from '@/lib/appearance/appearance-provider'
import { LazyMotion } from '@/lib/components/lazy-motion'

const LazyDebug =
  import.meta.env.SSR || import.meta.env.MODE !== 'test'
    ? (_: any) => null
    : import.meta.env.DEV
      ? lazy(() => import('./debug').then((_) => ({ default: _.Debug })))
      : (_: any) => null

const LazyClient = import.meta.env.SSR
  ? ({ children }: any) => children
  : lazy(() => import('./client').then((_) => ({ default: _.Client })))

const transition: Transition = {
  duration: 0.5,
  ease: cubicBezier(0.4, 0, 0.2, 1),
}

const Provider = ({ children }: { children: ReactNode }) => (
  <MotionConfig transition={transition} reducedMotion="user">
    <LazyMotion>
      <LazyClient>{children}</LazyClient>
    </LazyMotion>
  </MotionConfig>
)

export type MakeOptions = {
  appRoutes: Array<string>
  debug: Array<[]>
}

export const make =
  ({ appRoutes }: MakeOptions) =>
  ({ children }: { children: ReactNode }) => {
    const value = useRef(appRoutes)

    if (import.meta.env.DEV && import.meta.env.MODE !== 'test') {
      useEffect(() => {
        const devScript = document.createElement('script')
        devScript.src = '/@vite-plugin-checker-runtime-entry'
        devScript.type = 'module'
        document.head.appendChild(devScript)
      }, [])
    }

    return (
      <AppearanceProvider defaultAppearance="system">
        <Provider>
          {children}
          <LazyDebug appRoutes={value.current} />
        </Provider>
      </AppearanceProvider>
    )
  }
