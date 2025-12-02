import { useState } from 'react'
import { cn } from '@/lib/utils'

export interface DemoCardProps {
  title: string
  icon?: string
  children?: React.ReactNode
  isActive?: boolean
  onClick?: () => void
}

export const DemoCard = ({ title, icon, children, isActive, onClick }: DemoCardProps) => {
  return (
    <div
      className={cn(
        'bg-background rounded-lg shadow-sm border p-4 cursor-pointer hover:border-primary/50 transition-colors',
        isActive && 'ring-2 ring-primary',
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">{title}</span>
        {icon && <i className={cn(icon, 'w-4 h-4 text-muted-foreground')} />}
      </div>
      {children}
    </div>
  )
}

export interface DragableGridProps {
  items: Array<{ id: string; title: string }>
  columns?: number
  className?: string
}

export const DragableGrid = ({ items, columns = 3, className }: DragableGridProps) => {
  const [activeItem, setActiveItem] = useState<string | null>(null)

  return (
    <div className={cn(`grid grid-cols-${columns} gap-4`, className)}>
      {items.map((item) => (
        <DemoCard
          key={item.id}
          title={item.title}
          icon="i-lucide-grip"
          isActive={activeItem === item.id}
          onClick={() => setActiveItem(item.id)}
        >
          <div className="space-y-2">
            <div className="h-2 bg-muted rounded w-2/3" />
            <div className="h-2 bg-muted rounded w-1/2" />
          </div>
        </DemoCard>
      ))}
    </div>
  )
}
