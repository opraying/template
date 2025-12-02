import type { ReactElement } from 'react'
import { cn } from '@/lib/utils'

interface BlockProps {
  title: string
  right?: ReactElement
  children?: React.ReactNode
  className?: string
}

export const Block = ({ title, right, children, className }: BlockProps) => {
  return (
    <div
      className={cn(
        'flex flex-col h-full outline-none relative overflow-x-hidden no-scrollbar overscroll-none',
        'border-2 border-transparent p-[1px] font-mono',
        className,
      )}
    >
      <div className="w-full flex items-center justify-between sticky top-0 bg-[var(--base03)]">
        <div className="flex items-center gap-1 px-1.5 py-0.5 text-[var(--base05)]">{title}</div>
        <div className="flex items-center">{right}</div>
      </div>
      <div className="flex flex-col flex-grow items-star gap-1.5 py-1">{children}</div>
    </div>
  )
}

export const BlockContainer = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="@container">
      <div className="grid grid-cols-2 @5xl:grid-cols-3 gap-6">{children}</div>
    </div>
  )
}
