import { cn } from '@/lib/utils'

interface BaseStepProps {
  icon: string
  title: React.ReactNode
  description: React.ReactNode
  maxHeight?: number | undefined
  className?: string
  children?: React.ReactNode
}

export function BaseStep({ icon, title, description, className, children }: BaseStepProps) {
  return (
    <div className={cn('flex flex-col gap-fl-sm relative pt-fl-2xs', className)}>
      <div className="flex flex-col gap-3 max-w-2xl">
        <div className="flex justify-start gap-3 ">
          {icon && <i className={cn(icon, 'w-8 h-8 text-primary')} />}
          <h1 className="text-2xl font-semibold">{title}</h1>
        </div>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  )
}
