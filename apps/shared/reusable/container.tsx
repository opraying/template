import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('wrap flex flex-col px-0 w-full bg-background pb-10', className)}>{children}</div>
}
