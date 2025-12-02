import { Sidebar } from '@xstack/app-kit/layout/sidebar'
import type { PropsWithChildren, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface AppLayoutProps {
  /** Sidebar content to render */
  sidebar?: ReactNode
  /** Additional CSS classes */
  className?: string | undefined
  /** HTML id attribute */
  id?: string | undefined
  /** Data test id for testing */
  'data-testid'?: string | undefined
}

/**
 * Main application layout component that provides a flexible container
 * with optional sidebar support.
 */
export function AppLayout({
  sidebar,
  children,
  className,
  id = 'app-layout',
  'data-testid': testId,
}: PropsWithChildren<AppLayoutProps>) {
  return (
    <div className={cn('flex flex-1', className)} id={id} data-testid={testId} role="main">
      {/* Sidebar */}
      {sidebar && <Sidebar>{sidebar}</Sidebar>}
      {/* Content */}
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}
