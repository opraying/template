import type { ReactNode } from 'react'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerOverlay,
  DrawerPortal,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export function DebugPanelItem({
  title,
  children,
  asChild,
}: {
  title?: ReactNode
  children: ReactNode
  asChild?: boolean
}) {
  return (
    <div className="flex items-center px-1.5 gap-x-1 justify-center min-w-[50px] rounded">
      {title}
      <div>{children}</div>
    </div>
  )
}

export function DebugPanelDrawerItem({
  icon,
  title,
  children,
}: {
  icon?: ReactNode
  title?: ReactNode
  children: ReactNode
}) {
  return (
    <Drawer direction="bottom" shouldScaleBackground={false} snapPoints={[0.5, 0.7, 0.95]}>
      <DrawerTrigger>
        <div className="flex items-center px-1.5 gap-x-1 justify-center min-w-[50px] rounded">
          {icon}
          <div>{title}</div>
        </div>
      </DrawerTrigger>
      <DrawerPortal>
        <DrawerOverlay />
        <DrawerContent className="top-0">
          <DrawerHeader className="hidden">
            <DrawerTitle />
            <DrawerDescription />
          </DrawerHeader>
          {children}
        </DrawerContent>
      </DrawerPortal>
    </Drawer>
  )
}

export function DebugPanelPopoverItem({
  icon,
  title,
  children,
  forceMount,
  preventOutside,
  opened,
  onOpenChange,
  className,
}: {
  icon?: ReactNode
  title?: ReactNode
  forceMount?: boolean | undefined
  opened?: boolean | undefined
  preventOutside?: boolean
  children: ReactNode
  className?: string | undefined
  onOpenChange: (_: boolean) => void
}) {
  return (
    <Popover open={opened ?? false} onOpenChange={onOpenChange}>
      <PopoverTrigger>
        <div className="flex items-center px-1.5 gap-x-1 justify-center min-w-[50px] rounded">
          {icon}
          <div>{title}</div>
        </div>
      </PopoverTrigger>
      <PopoverContent
        {...(forceMount ? { forceMount: true } : {})}
        className={cn('w-fit h-fit z-[99] p-0 bg-foreground/90 dark:bg-background/75 backdrop-blur-sm', className)}
        align="center"
        onEscapeKeyDown={(event) => {
          event.preventDefault()
          onOpenChange(false)
        }}
        onInteractOutside={(event) => {
          if (preventOutside) {
            event.preventDefault()
          }
        }}
      >
        {children}
      </PopoverContent>
    </Popover>
  )
}
