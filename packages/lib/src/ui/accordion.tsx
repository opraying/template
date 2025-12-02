import * as AccordionPrimitive from '@radix-ui/react-accordion'
import type * as React from 'react'
import { cn } from '@/lib/utils'

const Accordion = ({ className, ...props }: React.ComponentPropsWithRef<typeof AccordionPrimitive.Root>) => (
  <AccordionPrimitive.Root className={cn('border rounded-md', className)} {...props} />
)

const AccordionItem = ({ className, ...props }: React.ComponentPropsWithRef<typeof AccordionPrimitive.Item>) => (
  <AccordionPrimitive.Item className={cn('border-b last:border-b-0 ', className)} {...props} />
)
AccordionItem.displayName = 'AccordionItem'

const AccordionTrigger = ({
  className,
  children,
  ...props
}: React.ComponentPropsWithRef<typeof AccordionPrimitive.Trigger>) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      suppressHydrationWarning
      className={cn(
        'flex flex-1 text-left items-center justify-between py-2.5 px-4 font-medium transition-all [&[data-state=open]>button]:rotate-180',
        className,
      )}
      {...props}
    >
      {children}
      <div className="border p-1.5 rounded-lg flex items-center justify-center">
        <i className="i-lucide-chevron-down size-4 shrink-0 transition-transform duration-200" />
      </div>
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
)
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName

const AccordionContent = ({
  className,
  children,
  ...props
}: React.ComponentPropsWithRef<typeof AccordionPrimitive.Content>) => (
  <AccordionPrimitive.Content
    suppressHydrationWarning
    className="overflow-hidden border-t ml-4 transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
    {...props}
  >
    <div className="px-3 py-4 font-normal text-left">{children}</div>
  </AccordionPrimitive.Content>
)

AccordionContent.displayName = AccordionPrimitive.Content.displayName

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
