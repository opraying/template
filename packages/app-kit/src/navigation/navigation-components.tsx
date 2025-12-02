import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Switch } from '@xstack/lib/ui/switch'
import { Badge } from '@xstack/lib/ui/badge'
import type { NavigationItem } from './drill-down-navigator'
import type { ReactNode } from 'react'

// Common navigation item builders
export class NavigationItemBuilder {
  private item: Partial<NavigationItem> = {}

  constructor(id: string, title: string) {
    this.item = { id, title }
  }

  subtitle(subtitle: string) {
    this.item.subtitle = subtitle
    return this
  }

  icon(icon: ReactNode) {
    this.item.icon = icon
    return this
  }

  badge(badge: string | number) {
    this.item.badge = badge
    return this
  }

  rightIcon(rightIcon: ReactNode) {
    this.item.rightIcon = rightIcon
    return this
  }

  onPress(onPress: () => void) {
    this.item.onPress = onPress
    return this
  }

  children(children: NavigationItem[]) {
    this.item.children = children
    return this
  }

  component(component: ReactNode) {
    this.item.component = component
    return this
  }

  build(): NavigationItem {
    return this.item as NavigationItem
  }
}

// Helper function to create navigation items
export const createNavigationItem = (id: string, title: string) => new NavigationItemBuilder(id, title)

// Common setting components for navigation
export interface SettingToggleProps {
  title: string
  description?: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
}

export function SettingToggle({ title, description, checked, onCheckedChange, disabled }: SettingToggleProps) {
  return (
    <div className="flex items-center justify-between p-4 bg-background">
      <div className="flex-1 mr-4">
        <div className="font-medium">{title}</div>
        {description && <div className="text-sm text-muted-foreground mt-1">{description}</div>}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  )
}

export interface SettingSectionProps {
  title?: string
  children: ReactNode
  className?: string
}

export function SettingSection({ title, children, className }: SettingSectionProps) {
  return (
    <div className={cn('space-y-1', className)}>
      {title && (
        <div className="px-4 py-2 text-sm text-muted-foreground font-medium uppercase tracking-wider">{title}</div>
      )}
      <div className="bg-background border border-border/20 rounded-lg mx-4 overflow-hidden divide-y divide-border/20">
        {children}
      </div>
    </div>
  )
}

export interface SettingButtonProps {
  title: string
  description?: string
  icon?: ReactNode
  rightText?: string
  variant?: 'default' | 'destructive'
  onPress: () => void
  disabled?: boolean
}

export function SettingButton({
  title,
  description,
  icon,
  rightText,
  variant = 'default',
  onPress,
  disabled,
}: SettingButtonProps) {
  return (
    <button
      onClick={onPress}
      disabled={disabled}
      className={cn(
        'w-full flex items-center justify-between p-4 text-left transition-colors',
        'hover:bg-muted/50 active:bg-muted/80 focus:outline-none focus:bg-muted/50',
        'touch-manipulation select-none',
        variant === 'destructive' && 'text-destructive',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {icon && <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center">{icon}</div>}
        <div className="min-w-0 flex-1">
          <div className="font-medium">{title}</div>
          {description && <div className="text-sm text-muted-foreground mt-0.5">{description}</div>}
        </div>
      </div>

      {rightText && <div className="text-sm text-muted-foreground mr-2">{rightText}</div>}
    </button>
  )
}

export interface SettingInputProps {
  title: string
  description?: string
  value: string
  placeholder?: string
  onValueChange: (value: string) => void
  type?: 'text' | 'email' | 'password' | 'number'
  disabled?: boolean
}

export function SettingInput({
  title,
  description,
  value,
  placeholder,
  onValueChange,
  type = 'text',
  disabled,
}: SettingInputProps) {
  return (
    <div className="p-4 space-y-3 bg-background">
      <div>
        <div className="font-medium">{title}</div>
        {description && <div className="text-sm text-muted-foreground mt-1">{description}</div>}
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          'w-full px-3 py-2 border border-border rounded-md',
          'bg-background text-foreground placeholder:text-muted-foreground',
          'focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        )}
      />
    </div>
  )
}

// Status indicators
export function StatusBadge({
  status,
  className,
}: {
  status: 'online' | 'offline' | 'syncing' | 'error'
  className?: string
}) {
  const variants = {
    online: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    offline: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
    syncing: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  }

  const labels = {
    online: 'Online',
    offline: 'Offline',
    syncing: 'Syncing',
    error: 'Error',
  }

  return <Badge className={cn(variants[status], className)}>{labels[status]}</Badge>
}
