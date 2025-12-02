import { useGtSmallScreen, useMenuOpened } from '@xstack/app-kit/global-state'
import { m } from 'motion/react'
import type { PropsWithChildren } from 'react'
import { Drawer as DrawerPrimitive } from 'vaul'
import {
  Drawer,
  DrawerDescription,
  DrawerHeader,
  DrawerOverlay,
  DrawerPortal,
  DrawerTitle,
} from '@/components/ui/drawer'
import { cn } from '@/lib/utils'

export interface SidebarProps {
  /** Additional CSS classes */
  className?: string
  /** Data test id for testing */
  'data-testid'?: string
}

const navbarVariants = {
  closed: { x: 0, width: 0 },
  initial: { x: 0, width: 0 },
  open: { x: 0, width: 260 },
}

const navbarVariants2 = {
  closed: { x: -260, opacity: 0 },
  initial: { x: -260, opacity: 0 },
  open: { x: 0, opacity: 1 },
}

/**
 * Responsive sidebar component that adapts between desktop and mobile layouts.
 * On desktop, it's a fixed sidebar. On mobile, it becomes a drawer.
 */
export function Sidebar({ children, className, 'data-testid': testId }: PropsWithChildren<SidebarProps>) {
  const largeScreen = useGtSmallScreen()
  const [opened, setOpened] = useMenuOpened()

  const visible = largeScreen ? true : opened

  const content = <div className="flex-1 flex-col flex h-full pb-2">{children}</div>

  return (
    <div className={cn('h-dvh', className)} data-testid={testId}>
      <m.div
        animate={largeScreen && visible ? 'open' : 'closed'}
        exit="closed"
        initial={largeScreen && visible ? 'open' : 'initial'}
        variants={navbarVariants}
        className="h-full"
      />
      <m.div
        className="sidebar pointer-events-auto fixed inset-y-0 left-0 z-50 bg-[hsl(var(--sidebar-background))]"
        animate={largeScreen ? 'open' : 'closed'}
        exit="closed"
        initial={largeScreen ? 'open' : 'initial'}
        variants={navbarVariants2}
        style={{ width: '260px', contentVisibility: largeScreen ? 'visible' : 'hidden' }}
        role="navigation"
        aria-label="Main navigation"
      >
        {content}
      </m.div>
      <Drawer open={!largeScreen && opened} onOpenChange={setOpened} direction="left" shouldScaleBackground={false}>
        <DrawerContent className="m-0 top-0 max-w-[240px] rounded-none rounded-tr-md rounded-br-md">
          {content}
        </DrawerContent>
      </Drawer>
    </div>
  )
}

interface SidebarHeaderProps {
  /** Additional CSS classes */
  className?: string
}

/**
 * Header section for the sidebar, typically contains title or logo.
 */
export function SidebarHeader({ children, className }: PropsWithChildren<SidebarHeaderProps>) {
  return <div className={cn('titlebar-area z-50 max-h-[45px] h-[45px]', className)}>{children}</div>
}

interface SidebarContentProps {
  /** Additional CSS classes */
  className?: string
}

/**
 * Scrollable content area of the sidebar.
 */
export function SidebarContent({ children, className }: PropsWithChildren<SidebarContentProps>) {
  return (
    <div
      className={cn(
        'py-2 px-2.5 flex-1 flex flex-col gap-y-1.5 flex-grow overflow-y-auto',
        'scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40',
        className,
      )}
    >
      {children}
    </div>
  )
}

interface SidebarFooterProps {
  /** Additional CSS classes */
  className?: string
}

/**
 * Footer section of the sidebar, typically contains user actions or secondary navigation.
 */
export function SidebarFooter({ children, className }: PropsWithChildren<SidebarFooterProps>) {
  return <div className={cn('pt-1 px-2 border-t flex flex-col', className)}>{children}</div>
}

const DrawerContent = ({
  className,
  children,
  ...props
}: React.ComponentPropsWithRef<typeof DrawerPrimitive.Content>) => (
  <DrawerPortal>
    <DrawerOverlay className="bg-black/15" />
    <DrawerPrimitive.Content
      className={cn(
        'fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-[10px] outline-none bg-[hsl(var(--sidebar-background))] border-r',
        className,
      )}
      {...props}
    >
      <DrawerHeader className="hidden">
        <DrawerTitle />
        <DrawerDescription />
      </DrawerHeader>
      {children}
    </DrawerPrimitive.Content>
  </DrawerPortal>
)
DrawerContent.displayName = 'DrawerContent'
