import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground hover:bg-primary/90 border-primary/95 border border-primary/90 outline outline -outline-offset-2 outline-primary-foreground/25 shadow',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground shadow',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow',
        ghost: 'hover:bg-accent hover:text-accent-foreground focus-visible:outline-none',
        link: 'text-primary underline-offset-4 hover:underline focus-visible:outline-none',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps extends React.ComponentPropsWithRef<'button'>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = ({ className, variant, size, asChild = false, ...props }: ButtonProps) => {
  const Comp = asChild ? Slot : 'button'
  return <Comp suppressHydrationWarning className={cn(buttonVariants({ variant, size, className }))} {...props} />
}
Button.displayName = 'Button'

const buttonGroupVariants = cva(
  'flex bg-muted/80 overflow-hidden border border-white/10 rounded text-popover-foreground',
  {
    defaultVariants: {
      direction: 'column',
    },
    variants: {
      direction: {
        column: 'space-y-2 flex-col min-w-[8rem]',
        row: 'space-x-2',
      },
    },
  },
)
export interface ButtonGroupProps
  extends React.ComponentPropsWithRef<'div'>, VariantProps<typeof buttonGroupVariants> {}

const ButtonGroup = ({ className, direction, ...props }: ButtonGroupProps) => {
  return <div className={cn(buttonGroupVariants({ className, direction }))} {...props} />
}

export { Button, buttonVariants, ButtonGroup }
