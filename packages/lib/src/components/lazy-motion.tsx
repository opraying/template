import type { ReactNode } from 'react'
import * as ClientMotion from '@/lib/components/motion.client'

export const LazyMotion = import.meta.env.SSR
  ? ({ children }: { children: ReactNode }) => children
  : ClientMotion.LazyMotion
