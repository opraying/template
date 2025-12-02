import type * as React from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export interface InputProps extends React.ComponentPropsWithRef<'input'> {}

export const Input = ({ className, ...props }: InputProps) => {
  return (
    <input
      className={cn(
        'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        className,
      )}
      {...props}
    />
  )
}
Input.displayName = 'Input'

interface InputWithLabelProps extends InputProps {
  label: string
  description?: React.ReactNode
  helper?: React.ReactNode
  optional?: boolean
}
export const InputWithLabel = ({ label, description, helper, optional, ...props }: InputWithLabelProps) => {
  return (
    <div className="flex flex-col gap-2 w-full">
      <Label className="flex items-center gap-1">
        {label}
        {optional && <span className="text-fl-xs text-muted-foreground">(optional)</span>}
        <span className="text-fl-xs text-muted-foreground">{description}</span>
      </Label>
      <Input {...props} />
      {helper && <span className="text-fl-xs px-1 text-muted-foreground">{helper}</span>}
    </div>
  )
}
