import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
// import { AnimatePresence, motion } from 'framer-motion'
import { createContext, useContext, useState, type ReactNode } from 'react'

// Types for navigation system
export interface NavigationItem {
  id: string
  title: string
  subtitle?: string
  icon?: ReactNode
  badge?: string | number
  rightIcon?: ReactNode
  onPress?: () => void
  children?: NavigationItem[]
  component?: ReactNode
}

export interface NavigationLevel {
  title: string
  items: NavigationItem[]
  component?: ReactNode
}

interface NavigationState {
  levels: NavigationLevel[]
  currentLevelIndex: number
}

interface NavigationContextType {
  state: NavigationState
  pushLevel: (level: NavigationLevel) => void
  popLevel: () => void
  goToLevel: (index: number) => void
  canGoBack: boolean
}

const NavigationContext = createContext<NavigationContextType | null>(null)

const useNavigation = () => {
  const context = useContext(NavigationContext)
  if (!context) {
    throw new Error('useNavigation must be used within a DrillDownNavigator')
  }
  return context
}

// Main navigator component
export interface DrillDownNavigatorProps {
  initialLevel: NavigationLevel
  className?: string
  children?: ReactNode
}

export function DrillDownNavigator({ initialLevel, className, children }: DrillDownNavigatorProps) {
  const [state, setState] = useState<NavigationState>({
    levels: [initialLevel],
    currentLevelIndex: 0,
  })

  const pushLevel = (level: NavigationLevel) => {
    setState((prev) => ({
      levels: [...prev.levels, level],
      currentLevelIndex: prev.currentLevelIndex + 1,
    }))
  }

  const popLevel = () => {
    setState((prev) => ({
      levels: prev.levels.slice(0, -1),
      currentLevelIndex: Math.max(0, prev.currentLevelIndex - 1),
    }))
  }

  const goToLevel = (index: number) => {
    if (index >= 0 && index < state.levels.length) {
      setState((prev) => ({
        levels: prev.levels.slice(0, index + 1),
        currentLevelIndex: index,
      }))
    }
  }

  const canGoBack = state.currentLevelIndex > 0

  const contextValue: NavigationContextType = {
    state,
    pushLevel,
    popLevel,
    goToLevel,
    canGoBack,
  }

  return (
    <NavigationContext.Provider value={contextValue}>
      <div className={cn('relative overflow-hidden h-full bg-background', className)}>
        <NavigationLevel key={state.currentLevelIndex} />
        {children}
      </div>
    </NavigationContext.Provider>
  )
}

// Navigation level component with CSS animations
function NavigationLevel() {
  const { state } = useNavigation()
  const currentLevel = state.levels[state.currentLevelIndex]

  if (!currentLevel) return null

  return (
    <div className="absolute inset-0 bg-background animate-in slide-in-from-right-full duration-300">
      <NavigationHeader title={currentLevel.title} />
      <div className="flex-1 overflow-y-auto">
        {currentLevel.component ? (
          <div className="p-4">{currentLevel.component}</div>
        ) : (
          <NavigationItemsList items={currentLevel.items} />
        )}
      </div>
    </div>
  )
}

// Navigation header with back button
function NavigationHeader({ title }: { title: string }) {
  const { canGoBack, popLevel } = useNavigation()

  return (
    <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
      <div className="flex items-center h-14 px-4">
        {canGoBack && (
          <Button variant="ghost" size="sm" onClick={popLevel} className="mr-2 p-2 hover:bg-muted">
            <i className="i-lucide-chevron-left size-5" />
          </Button>
        )}
        <h1 className="text-lg font-semibold flex-1 truncate">{title}</h1>
      </div>
    </div>
  )
}

// List of navigation items
function NavigationItemsList({ items }: { items: NavigationItem[] }) {
  const { pushLevel } = useNavigation()

  const handleItemPress = (item: NavigationItem) => {
    if (item.onPress) {
      item.onPress()
    }

    if (item.children) {
      pushLevel({
        title: item.title,
        items: item.children,
      })
    } else if (item.component) {
      pushLevel({
        title: item.title,
        items: [],
        component: item.component,
      })
    }
  }

  return (
    <div className="divide-y divide-border">
      {items.map((item) => (
        <NavigationItemRow key={item.id} item={item} onPress={() => handleItemPress(item)} />
      ))}
    </div>
  )
}

// Individual navigation item row
interface NavigationItemRowProps {
  item: NavigationItem
  onPress: () => void
}

function NavigationItemRow({ item, onPress }: NavigationItemRowProps) {
  const hasNavigation = !!(item.children || item.component)

  return (
    <button
      onClick={onPress}
      className={cn(
        'w-full flex items-center justify-between px-4 py-3 text-left transition-colors',
        'hover:bg-muted/50 active:bg-muted/80 focus:outline-none focus:bg-muted/50',
        'touch-manipulation select-none',
      )}
      disabled={!hasNavigation && !item.onPress}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {item.icon && <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center">{item.icon}</div>}
        <div className="min-w-0 flex-1">
          <div className="font-medium text-foreground">{item.title}</div>
          {item.subtitle && <div className="text-sm text-muted-foreground mt-0.5">{item.subtitle}</div>}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {item.badge && (
          <div className="px-2 py-1 bg-accent text-accent-foreground text-xs rounded-full">{item.badge}</div>
        )}
        {item.rightIcon && <div className="text-muted-foreground">{item.rightIcon}</div>}
        {hasNavigation && <i className="i-lucide-chevron-right size-4 text-muted-foreground" />}
      </div>
    </button>
  )
}

// Breadcrumb component for showing navigation path
export function NavigationBreadcrumb({ className }: { className?: string }) {
  const { state, goToLevel } = useNavigation()

  if (state.levels.length <= 1) return null

  return (
    <div className={cn('flex items-center gap-1 px-4 py-2 text-sm text-muted-foreground', className)}>
      {state.levels.map((level, index) => (
        <div key={index} className="flex items-center gap-1">
          <button
            onClick={() => goToLevel(index)}
            className={cn(
              'hover:text-foreground transition-colors',
              index === state.currentLevelIndex && 'text-foreground font-medium',
            )}
          >
            {level.title}
          </button>
          {index < state.levels.length - 1 && <i className="i-lucide-chevron-right size-3" />}
        </div>
      ))}
    </div>
  )
}

// Hook for accessing navigation context
export { useNavigation }
