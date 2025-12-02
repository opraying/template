import { AnimatePresence, m } from 'motion/react'
import type { ReactNode } from 'react'

interface StepTransitionProps {
  children: ReactNode
  id: string
  duration?: number
}

export function StepTransition({ children, id, duration = 0.3 }: StepTransitionProps) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <m.div
        key={id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration }}
      >
        {children}
      </m.div>
    </AnimatePresence>
  )
}
