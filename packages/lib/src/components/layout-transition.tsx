import { AnimatePresence, m } from 'motion/react'
import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'

function usePreviousValue<T>(value: T): T | undefined {
  const prevValue = useRef<T>(undefined)

  useEffect(() => {
    prevValue.current = value
    return () => {
      prevValue.current = undefined
    }
  })

  return prevValue.current
}

interface LayoutTransitionProps {
  children: React.ReactNode
  className?: React.ComponentProps<typeof m.div>['className']
  style?: React.ComponentProps<typeof m.div>['style']
  initial: React.ComponentProps<typeof m.div>['initial']
  animate: React.ComponentProps<typeof m.div>['animate']
  exit: React.ComponentProps<typeof m.div>['exit']
}

export function LayoutTransition({ children, className, style, initial, animate, exit }: LayoutTransitionProps) {
  const path = useLocation().pathname
  const prevPath = usePreviousValue(path)

  const changed = path !== prevPath && path !== undefined && prevPath !== undefined

  return (
    <AnimatePresence mode="wait" initial={false}>
      {/* @ts-ignore */}
      <m.div
        className={className}
        style={style}
        key={changed ? path : prevPath}
        initial={initial}
        animate={animate}
        exit={exit}
      >
        {children}
      </m.div>
    </AnimatePresence>
  )
}
