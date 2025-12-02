import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import type * as React from 'react'

import { cn } from '@/lib/utils'

const Checkbox = ({ className, ...props }: React.ComponentPropsWithRef<typeof CheckboxPrimitive.Root>) => (
  <CheckboxPrimitive.Root
    className={cn(
      'peer size-fl-sm shrink-0 rounded border-2 border-primary/70 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary/95 data-[state=checked]:text-primary-foreground transition-colors',
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      className={
        'flex items-center justify-center scale-90 transition-all data-[state=checked]:scale-100 data-[state=unchecked]:scale-90 data-[state=checked]:opacity-100 data-[state=unchecked]:opacity-50'
      }
    >
      <i className="i-lucide-check" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
)
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
