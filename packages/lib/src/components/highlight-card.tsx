import { m, useMotionTemplate, useMotionValue } from 'motion/react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Props = {
  className?: string
  children?: ReactNode
}

export const HighlightCard = (props: Props) => {
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  return (
    <div
      className={cn('relative group', props.className)}
      onTouchMove={(e) => {
        const { left, top } = e.currentTarget.getBoundingClientRect()

        mouseX.set(e.touches[0].clientX - left)
        mouseY.set(e.touches[0].clientY - top)
      }}
      onPointerMove={(e) => {
        const { left, top } = e.currentTarget.getBoundingClientRect()

        mouseX.set(e.clientX - left)
        mouseY.set(e.clientY - top)
      }}
    >
      {/* @ts-ignore */}
      <m.div
        className="pointer-events-none absolute -inset-px rounded-xl opacity-0 transition duration-300 group-hover:opacity-100"
        style={{
          background: useMotionTemplate`
            radial-gradient(
              650px circle at ${mouseX}px ${mouseY}px,
              rgba(255,255,255,0.2),
              transparent 80%
            )
          `,
        }}
      />
      {props.children}
    </div>
  )
}
