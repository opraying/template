import { domAnimation, LazyMotion as LazyMotion_ } from 'motion/react'
import type { ReactNode } from 'react'

export const LazyMotion = ({ children }: { children: ReactNode }) => {
  return <LazyMotion_ features={domAnimation}>{children}</LazyMotion_>
}
