import { cn } from '@/lib/utils'
import type { DialogProps } from '@radix-ui/react-dialog'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { useIsMobileScreen } from '@xstack/app-kit/lib/screen-utils'
import { Command as CommandPrimitive } from 'cmdk'
import type * as React from 'react'
import { Drawer } from 'vaul'
import { Dialog, DialogDescription, DialogOverlay, DialogPortal } from './dialog'

const Command = ({ className, ...props }: React.ComponentPropsWithRef<typeof CommandPrimitive>) => {
  const isMobile = useIsMobileScreen()

  return (
    <CommandPrimitive
      className={cn(
        'flex h-full w-full flex-col overflow-hidden text-foreground bg-red-400',
        isMobile
          ? '' // Mobile: clean iOS-style background
          : 'bg-white/90 dark:bg-gray-900/90 rounded-xl backdrop-blur-xl border border-gray-200/30 dark:border-gray-800/30 shadow-lg shadow-black/5 dark:shadow-black/20', // Desktop: modern elevated card
        className,
      )}
      {...props}
    />
  )
}
Command.displayName = CommandPrimitive.displayName

interface CommandDialogProps extends DialogProps {
  forceDesktop?: boolean
}

const CommandDialogContent = ({
  className,
  children,
  forceDesktop,
  ...props
}: React.ComponentPropsWithRef<typeof DialogPrimitive.Content> & { forceDesktop?: boolean }) => {
  const isMobile = useIsMobileScreen()

  if (isMobile && !forceDesktop) {
    return (
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/40 dark:bg-black/60" />
        <Drawer.Content
          className={cn(
            'fixed bottom-0 left-0 right-0 z-50 flex h-auto flex-col rounded-t-3xl bg-white dark:bg-gray-950 border-t border-gray-200/30 dark:border-gray-800/30 max-h-[88dvh] shadow-2xl shadow-black/20',
            className,
          )}
          {...props}
        >
          <div className="mx-auto mt-3 h-1 w-8 rounded-full bg-gray-300 dark:bg-gray-700" />
          <div className="flex-1 flex flex-col min-h-0 pb-safe">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    )
  }

  return (
    <DialogPortal>
      <DialogOverlay className="bg-black/20 dark:bg-black/40 backdrop-blur-sm" />
      <DialogPrimitive.Content
        {...props}
        className={cn(
          'fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] bg-white/95 dark:bg-gray-950/95 rounded-2xl backdrop-blur-xl border border-gray-200/30 dark:border-gray-800/30 shadow-xl shadow-black/10 dark:shadow-black/40 duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-96 data-[state=open]:zoom-in-100 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] outline-none',
          className,
        )}
      >
        {children}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}
CommandDialogContent.displayName = 'CommandDialogContent'

const CommandDialog = ({ children, forceDesktop, ...props }: CommandDialogProps) => {
  const isMobile = useIsMobileScreen()

  return (
    <Dialog {...props} {...(forceDesktop !== undefined && { forceDesktop })}>
      <CommandDialogContent {...(forceDesktop !== undefined && { forceDesktop })}>
        <DialogDescription className="hidden" />
        <Command
          className={cn(
            // Remove old desktop-specific styles, let individual components handle responsive design
            isMobile
              ? 'flex-1 min-h-0' // Mobile: fill available space
              : '[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5', // Desktop: legacy compact styles
          )}
        >
          {children}
        </Command>
      </CommandDialogContent>
    </Dialog>
  )
}

const CommandInput = ({ className, ...props }: React.ComponentPropsWithRef<typeof CommandPrimitive.Input>) => {
  const isMobile = useIsMobileScreen()

  return (
    <div
      className={cn(
        'flex items-center sticky top-0 z-10',
        isMobile
          ? 'px-5 py-4 bg-white/80 dark:bg-gray-950/80 backdrop-blur-lg border-b border-gray-200/20 dark:border-gray-800/20' // Mobile: modern iOS search bar
          : 'px-4 py-3 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm border-b border-gray-200/20 dark:border-gray-800/20', // Desktop: subtle header
      )}
      cmdk-input-wrapper=""
    >
      <i
        className={cn(
          'i-lucide-search shrink-0 text-gray-400 dark:text-gray-500',
          isMobile ? 'mr-3 h-5 w-5' : 'mr-3 h-4 w-4',
        )}
      />
      <CommandPrimitive.Input
        className={cn(
          'flex w-full bg-transparent outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500 disabled:cursor-not-allowed disabled:opacity-50 text-gray-900 dark:text-gray-100',
          isMobile
            ? 'h-6 py-0 text-base font-normal' // Mobile: iOS-style input
            : 'h-8 py-0 text-sm font-medium', // Desktop: clean input
          className,
        )}
        placeholder={isMobile ? 'Search...' : 'Type a command or search...'}
        {...props}
      />
    </div>
  )
}

CommandInput.displayName = CommandPrimitive.Input.displayName

const CommandList = ({ className, ...props }: React.ComponentPropsWithRef<typeof CommandPrimitive.List>) => {
  const isMobile = useIsMobileScreen()

  return (
    <CommandPrimitive.List
      className={cn(
        'overflow-y-auto overflow-x-hidden',
        isMobile
          ? 'flex-1 pb-safe' // Mobile: full height with safe area
          : 'max-h-[400px] min-h-[150px]', // Desktop: constrained height
        className,
      )}
      {...props}
    />
  )
}

CommandList.displayName = CommandPrimitive.List.displayName

const CommandEmpty = (props: React.ComponentPropsWithRef<typeof CommandPrimitive.Empty>) => {
  const isMobile = useIsMobileScreen()

  return (
    <CommandPrimitive.Empty
      className={cn(
        'flex flex-col items-center justify-center text-center',
        isMobile ? 'py-16 px-6 text-gray-500 dark:text-gray-400' : 'py-12 px-4 text-gray-400 dark:text-gray-500',
      )}
      {...props}
    >
      <div className="mb-3 opacity-50">
        <i className={cn('i-lucide-search-x', isMobile ? 'h-8 w-8' : 'h-6 w-6')} />
      </div>
      <div className={cn('font-medium', isMobile ? 'text-base' : 'text-sm')}>No results found</div>
      <div className={cn('text-gray-400 dark:text-gray-500 mt-1', isMobile ? 'text-sm' : 'text-xs')}>
        Try a different search term
      </div>
    </CommandPrimitive.Empty>
  )
}

CommandEmpty.displayName = CommandPrimitive.Empty.displayName

const CommandGroup = ({ className, ...props }: React.ComponentPropsWithRef<typeof CommandPrimitive.Group>) => {
  const isMobile = useIsMobileScreen()

  return (
    <CommandPrimitive.Group
      className={cn(
        'overflow-hidden',
        isMobile
          ? 'py-1 [&_[cmdk-group-heading]]:px-5 [&_[cmdk-group-heading]]:pt-6 [&_[cmdk-group-heading]]:pb-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-gray-500 [&_[cmdk-group-heading]]:dark:text-gray-400 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:leading-none [&_[cmdk-group-heading]:first-child]:pt-3'
          : 'py-2 [&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-gray-500 [&_[cmdk-group-heading]]:dark:text-gray-400 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:leading-none',
        className,
      )}
      {...props}
    />
  )
}

CommandGroup.displayName = CommandPrimitive.Group.displayName

const CommandSeparator = ({ className, ...props }: React.ComponentPropsWithRef<typeof CommandPrimitive.Separator>) => {
  const isMobile = useIsMobileScreen()

  return (
    <CommandPrimitive.Separator
      className={cn('h-px bg-gray-200/50 dark:bg-gray-800/50', isMobile ? 'mx-5 my-3' : 'mx-4 my-2', className)}
      {...props}
    />
  )
}
CommandSeparator.displayName = CommandPrimitive.Separator.displayName

const CommandItem = ({ className, ...props }: React.ComponentPropsWithRef<typeof CommandPrimitive.Item>) => {
  const isMobile = useIsMobileScreen()

  return (
    <CommandPrimitive.Item
      className={cn(
        'relative flex cursor-default select-none items-center outline-none transition-all duration-200',
        isMobile
          ? 'px-5 py-3.5 text-base min-h-[52px] font-normal text-gray-900 dark:text-gray-100 active:bg-gray-100 dark:active:bg-gray-800 aria-selected:bg-gray-100 dark:aria-selected:bg-gray-800/60 last:pb-6' // Mobile: iOS-style clean cells
          : 'mx-2 mb-1 px-3 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/60 aria-selected:bg-gray-100 dark:aria-selected:bg-gray-800/60 aria-selected:text-gray-900 dark:aria-selected:text-gray-100', // Desktop: modern rounded cards
        className,
      )}
      {...props}
    />
  )
}

CommandItem.displayName = CommandPrimitive.Item.displayName

const CommandShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
  const isMobile = useIsMobileScreen()

  return (
    <span
      className={cn(
        'ml-auto font-mono tracking-wide',
        isMobile
          ? 'text-sm text-gray-400 dark:text-gray-500'
          : 'text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-700',
        className,
      )}
      {...props}
    />
  )
}
CommandShortcut.displayName = 'CommandShortcut'

export {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
}
