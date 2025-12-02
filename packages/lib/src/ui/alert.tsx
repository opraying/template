import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'

import { cn } from '@/lib/utils'

const alertVariants = cva(
  'relative w-full rounded-lg p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-muted-foreground',
  {
    variants: {
      variant: {
        default: 'bg-muted/50 text-green-600',
        destructive:
          'border-destructive/50 bg-destructive/5 text-destructive dark:border-destructive [&>svg]:text-destructive',
        warning: 'border-yellow-500/50 bg-yellow-500/10 text-yellow-500 dark:border-yellow-500 [&>svg]:text-yellow-500',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

const Alert = ({
  className,
  variant,
  ...props
}: React.ComponentPropsWithRef<'div'> & VariantProps<typeof alertVariants>) => (
  <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
)
Alert.displayName = 'Alert'

const AlertTitle = ({ className, icon, ...props }: React.ComponentPropsWithRef<'h5'> & { icon?: React.ReactNode }) => {
  return (
    <div className={cn('flex items-center gap-2 mb-2', className)}>
      {icon ? <div className={cn('flex items-center justify-center size-5')}>{icon}</div> : null}
      <span className="font-medium">{props.children}</span>
    </div>
  )
}
AlertTitle.displayName = 'AlertTitle'

const AlertDescription = ({ className, ...props }: React.ComponentPropsWithRef<'div'>) => (
  <div className={cn('text-sm text-muted-foreground [&_p]:leading-relaxed', className)} {...props} />
)
AlertDescription.displayName = 'AlertDescription'

export { Alert, AlertTitle, AlertDescription }
