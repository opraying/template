import * as DialogPrimitive from '@radix-ui/react-dialog'
import * as React from 'react'
import { Drawer } from 'vaul'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useIsMobileScreen } from '@xstack/app-kit/lib/screen-utils'

const Dialog = ({
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root> & { forceDesktop?: boolean }) => {
  const isMobile = useIsMobileScreen()

  if (isMobile && !props.forceDesktop) {
    return <Drawer.Root {...props}>{children}</Drawer.Root>
  }

  return <DialogPrimitive.Root {...props}>{children}</DialogPrimitive.Root>
}

const DialogTrigger = ({
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger> & { forceDesktop?: boolean }) => {
  const isMobile = useIsMobileScreen()

  if (isMobile && !props.forceDesktop) {
    return <Drawer.Trigger {...props}>{children}</Drawer.Trigger>
  }

  return <DialogPrimitive.Trigger {...props}>{children}</DialogPrimitive.Trigger>
}

const DialogPortal = DialogPrimitive.Portal

const DialogClose = ({
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close> & { forceDesktop?: boolean }) => {
  const isMobile = useIsMobileScreen()

  if (isMobile && !props.forceDesktop) {
    return <Drawer.Close {...props}>{children}</Drawer.Close>
  }

  return <DialogPrimitive.Close {...props}>{children}</DialogPrimitive.Close>
}

const DialogOverlay = ({ className, ...props }: React.ComponentPropsWithRef<typeof DialogPrimitive.Overlay>) => (
  <DialogPrimitive.Overlay
    className={cn(
      'fixed inset-0 z-50 bg-black/20 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className,
    )}
    {...props}
  />
)
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = ({
  className,
  containerClassName,
  children,
  ...props
}: React.ComponentPropsWithRef<typeof DialogPrimitive.Content> & {
  containerClassName?: string | undefined
  forceDesktop?: boolean
}) => {
  const isMobile = useIsMobileScreen()

  if (isMobile && !props.forceDesktop) {
    return (
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/20" />
        <Drawer.Content
          className={cn(
            'fixed bottom-0 left-0 right-0 z-50 mt-24 flex h-auto flex-col rounded-t-lg bg-background',
            className,
          )}
          {...props}
        >
          <div className="mx-auto mt-4 h-2 w-[100px] rounded-full bg-muted" />
          <div
            className={cn(
              'flex-1 rounded-t-lg p-4 @container max-h-[85dvh] overflow-y-auto overflow-x-hidden overscroll-none',
              containerClassName,
            )}
          >
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    )
  }

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        {...props}
        className={cn(
          'fixed left-[50%] top-[50%] z-50 w-[95%] max-w-xl translate-x-[-50%] translate-y-[-50%] rounded-lg bg-background/85 backdrop-blur p-fl-xs shadow-lg duration-150 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] outline-none shadow',
          className,
        )}
      >
        <div
          className={cn(
            'border mb-12 p-3 rounded bg-card shadow-sm @container max-h-[80dvh] overflow-y-auto overflow-x-hidden overscroll-none no-scrollbar',
            containerClassName,
          )}
        >
          {children}
        </div>
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-1.5 pb-2 text-center sm:text-left', className)} {...props} />
)
DialogHeader.displayName = 'DialogHeader'

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex absolute bottom-3 right-4 items-center space-x-2', className)} {...props} />
)
DialogFooter.displayName = 'DialogFooter'

const DialogTitle = ({ className, ...props }: React.ComponentPropsWithRef<typeof DialogPrimitive.Title>) => (
  <DialogPrimitive.Title className={cn('text-fl-base font-medium leading-none tracking-tight', className)} {...props} />
)
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = ({
  className,
  ...props
}: React.ComponentPropsWithRef<typeof DialogPrimitive.Description>) => (
  <DialogPrimitive.Description className={cn('text-muted-foreground', className)} {...props} />
)
DialogDescription.displayName = DialogPrimitive.Description.displayName

const DialogCancel = ({
  className,
  forceDesktop,
  ...props
}: React.ComponentPropsWithRef<typeof DialogPrimitive.Close> & { forceDesktop?: boolean }) => {
  const isMobile = useIsMobileScreen()

  if (isMobile && !forceDesktop) {
    return <Drawer.Close className={cn(buttonVariants({ variant: 'ghost' }), className)} {...props} />
  }

  return <DialogPrimitive.Close className={cn(buttonVariants({ variant: 'ghost' }), className)} {...props} />
}
DialogCancel.displayName = DialogPrimitive.Close.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogCancel,
}
