import { AppHeader } from '@xstack/app-kit/layout/header'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export const Page = ({
  children,
  className,
  header = <AppHeader />,
  style,
  ...props
}: React.ComponentPropsWithRef<'div'> & {
  header?: ReactNode
}) => {
  return (
    <div
      id="page-view"
      vaul-drawer-wrapper="root"
      className={cn('min-h-dvh flex-1 flex flex-col', className)}
      style={style}
      {...props}
    >
      {header}
      {children}
    </div>
  )
}

export function PageContent({ children, className, ...props }: React.ComponentPropsWithRef<'div'>) {
  return (
    <div className={cn('flex-1 gap-y-fl-xs flex flex-col', className)} {...props}>
      {children}
    </div>
  )
}
