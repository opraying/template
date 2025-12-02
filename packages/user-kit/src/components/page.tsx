import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export const Page = ({
  children,
  className,
  style,
  header,
  footer,
  ...props
}: React.ComponentPropsWithRef<'div'> & {
  header?: ReactNode
  footer?: ReactNode
}) => {
  return (
    <div
      id="page-view"
      vaul-drawer-wrapper="root"
      className={cn('min-h-dvh flex-1 gap-y-fl-xs flex flex-col pb-10', className)}
      style={style}
      {...props}
    >
      {header}
      <div className="flex-1 flex-grow">{children}</div>
      {footer}
    </div>
  )
}

export function Footer({ copyright }: { copyright: string }) {
  return (
    <div className="flex items-center justify-center px-fl-xs text-secondary-foreground/70">
      <div className="px-fl-2xs">{copyright}</div>
    </div>
  )
}
