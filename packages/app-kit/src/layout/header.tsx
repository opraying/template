import { useMenuOpened } from '@xstack/app-kit/global-state'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { useScreenQuery } from '@/lib/hooks/use-screen-query'
import { cn } from '@/lib/utils'

interface DesktopHeaderProps {
  /** Left side action elements */
  leftActions?: ReactNode
  /** Right side action elements */
  rightActions?: ReactNode
  /** Center content */
  children?: ReactNode
  /** Whether header should be sticky */
  fixed?: boolean | undefined
}

function DesktopHeader({ leftActions, rightActions, children, fixed }: DesktopHeaderProps) {
  return (
    <div
      className={cn(
        'border-b bg-[hsl(var(--sidebar-background))] z-[50] min-h-[50px] h-[50px] flex items-center',
        fixed && 'sticky top-0 w-full',
      )}
    >
      <div
        className={cn(
          'titlebar-area px-fl-sm size-hull flex justify-between items-center',
          fixed && 'sticky top-0 w-full',
        )}
        data-tauri-drag-region
      >
        <div className="flex items-center gap-3 h-full">{leftActions}</div>
        {children && <div className="flex flex-shrink-0 flex-grow justify-center">{children}</div>}
        <div className="flex items-center gap-3 h-full">{rightActions}</div>
      </div>
    </div>
  )
}

interface MobileHeaderProps {
  /** Left side action elements */
  leftActions?: ReactNode
  /** Right side action elements */
  rightActions?: ReactNode
  /** Whether to show sidebar menu toggle */
  sideBarMenu?: boolean | undefined
  /** Center content */
  children?: ReactNode
}

function MobileHeader({ leftActions, rightActions, sideBarMenu, children }: MobileHeaderProps) {
  const [opened, setOpened] = useMenuOpened()
  return (
    <div
      className="titlebar-area px-fl-sm flex items-center justify-between z-[50] min-h-[50px]"
      data-tauri-drag-region
    >
      <div className="gap-x-2 flex items-center">
        {sideBarMenu && (
          <Button size="icon" variant="ghost" onClick={() => setOpened(!opened)}>
            <i className="i-lucide-panel-left size-5" />
          </Button>
        )}
        {leftActions}
      </div>
      {children && <div className="flex flex-shrink-0 flex-grow justify-center">{children}</div>}
      <div className="gap-x-2 flex items-center">{rightActions}</div>
    </div>
  )
}
export interface AppHeaderProps {
  /** Left side action elements */
  leftActions?: ReactNode
  /** Right side action elements */
  rightActions?: ReactNode
  /** Whether to show sidebar menu toggle on mobile */
  sideBarMenu?: boolean | undefined
  /** Center content */
  children?: ReactNode
  /** Whether header should be sticky */
  fixed?: boolean | undefined
  /** Additional CSS classes */
  className?: string | undefined
  /** Data test id for testing */
  'data-testid'?: string | undefined
}

/**
 * Responsive application header that adapts between desktop and mobile layouts.
 * Automatically switches between desktop and mobile variants based on screen size.
 */
export function AppHeader({
  leftActions,
  rightActions,
  sideBarMenu,
  children,
  fixed = true,
  className,
  'data-testid': testId,
}: AppHeaderProps) {
  const isLargeScreen = useScreenQuery('lg')

  if (isLargeScreen) {
    return (
      <DesktopHeader fixed={fixed} leftActions={leftActions} rightActions={rightActions}>
        {children}
      </DesktopHeader>
    )
  }

  return (
    <div className={cn('z-10 app-header', fixed && 'sticky top-0', className)} data-testid={testId}>
      <MobileHeader leftActions={leftActions} rightActions={rightActions} sideBarMenu={sideBarMenu}>
        {children}
      </MobileHeader>
    </div>
  )
}
