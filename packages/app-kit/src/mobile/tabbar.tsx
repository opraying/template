import type { PropsWithChildren, ReactNode, KeyboardEvent, MouseEvent } from 'react'
import { createContext, useContext, useEffect, useState, useCallback, useMemo, memo } from 'react'
import { cn } from '@/lib/utils'
import { useIsMobileScreen } from '@xstack/app-kit/lib/screen-utils'
import './tabbar.css'

// Enhanced tab item interface with better typing
interface TabItem<T extends string = string> {
  id: T
  label: string
  icon: ReactNode
  activeIcon?: ReactNode
  badge?: number | string | null
  disabled?: boolean
  testId?: string
  'aria-label'?: string
}

// Tab change event with metadata
interface TabChangeEvent<T extends string = string> {
  tabId: T
  previousTabId: T | null
  timestamp: number
}

// Theme configuration
interface TabbarTheme {
  background: string
  activeColor: string
  inactiveColor: string
  borderColor: string
  badgeColor: string
  badgeTextColor: string
}

// Animation configuration
interface TabbarAnimation {
  duration: number
  easing: string
  enableSpring: boolean
  enableRipple: boolean
}

interface TabbarContextValue<T extends string = string> {
  activeTab: T | null
  setActiveTab: (id: T) => void
  isHidden: boolean
  setIsHidden: (hidden: boolean) => void
  tabs: TabItem<T>[]
  setTabs: (tabs: TabItem<T>[] | ((prev: TabItem<T>[]) => TabItem<T>[])) => void
  theme?: TabbarTheme
  animation?: TabbarAnimation
  onTabChange?: (event: TabChangeEvent<T>) => void
}

const TabbarContext = createContext<TabbarContextValue<any> | null>(null)

export function useTabbar<T extends string = string>(): TabbarContextValue<T> {
  const context = useContext(TabbarContext)
  if (!context) {
    throw new Error('useTabbar must be used within a TabbarProvider')
  }
  return context
}

interface TabbarProviderProps<T extends string = string> extends PropsWithChildren {
  defaultTab?: T | undefined
  onTabChange?: ((event: TabChangeEvent<T>) => void) | undefined
  theme?: Partial<TabbarTheme> | undefined
  animation?: Partial<TabbarAnimation> | undefined
  'aria-label'?: string | undefined
}

const defaultTheme: TabbarTheme = {
  background: 'rgba(255, 255, 255, 0.8)',
  activeColor: '#3b82f6',
  inactiveColor: '#6b7280',
  borderColor: 'rgba(229, 231, 235, 0.5)',
  badgeColor: '#ef4444',
  badgeTextColor: '#ffffff',
}

const defaultAnimation: TabbarAnimation = {
  duration: 200,
  easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
  enableSpring: true,
  enableRipple: false,
}

export function TabbarProvider<T extends string = string>({
  children,
  defaultTab,
  onTabChange,
  theme,
  animation,
  'aria-label': ariaLabel,
}: TabbarProviderProps<T>) {
  const [activeTab, setActiveTab] = useState<T | null>(defaultTab || null)
  const [isHidden, setIsHidden] = useState(false)
  const [tabs, setTabs] = useState<TabItem<T>[]>([])

  const mergedTheme = useMemo(() => ({ ...defaultTheme, ...theme }), [theme])
  const mergedAnimation = useMemo(() => ({ ...defaultAnimation, ...animation }), [animation])

  const handleSetActiveTab = useCallback(
    (id: T) => {
      const previousTabId = activeTab
      setActiveTab(id)

      if (onTabChange) {
        const event: TabChangeEvent<T> = {
          tabId: id,
          previousTabId,
          timestamp: Date.now(),
        }
        onTabChange(event)
      }
    },
    [activeTab, onTabChange],
  )

  const contextValue = useMemo(
    () => ({
      activeTab,
      setActiveTab: handleSetActiveTab,
      isHidden,
      setIsHidden,
      tabs,
      setTabs,
      theme: mergedTheme,
      animation: mergedAnimation,
      onTabChange,
    }),
    [activeTab, handleSetActiveTab, isHidden, tabs, mergedTheme, mergedAnimation, onTabChange],
  )

  return (
    <TabbarContext.Provider value={contextValue as any}>
      <div role="tablist" aria-label={ariaLabel || 'Navigation tabs'} className="tabbar-container">
        {children}
      </div>
    </TabbarContext.Provider>
  )
}

interface TabbarProps {
  className?: string
  safeAreaInset?: boolean
  position?: 'bottom' | 'top'
  variant?: 'default' | 'floating' | 'minimal'
  showLabels?: boolean
  compactMode?: boolean
  testId?: string
}

export const Tabbar = memo(function Tabbar({
  className,
  safeAreaInset = true,
  position = 'bottom',
  variant = 'default',
  showLabels = true,
  compactMode = false,
  testId,
}: TabbarProps) {
  const { tabs, activeTab, setActiveTab, isHidden, theme, animation } = useTabbar()
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false)
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const isMobile = useIsMobileScreen()

  // Enhanced keyboard visibility detection
  useEffect(() => {
    const handleResize = () => {
      const heightDiff = window.innerHeight - (window.visualViewport?.height || window.innerHeight)
      setIsKeyboardVisible(heightDiff > 150)
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsKeyboardVisible(false)
      }
    }

    if (typeof window !== 'undefined') {
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', handleResize)
      }
      document.addEventListener('visibilitychange', handleVisibilityChange)

      return () => {
        window.visualViewport?.removeEventListener('resize', handleResize)
        document.removeEventListener('visibilitychange', handleVisibilityChange)
      }
    }
  }, [])

  // Optimized keyboard navigation with memoized tab operations
  const enabledTabIndices = useMemo(
    () =>
      tabs
        .map((tab, index) => ({ tab, index }))
        .filter(({ tab }) => !tab.disabled)
        .map(({ index }) => index),
    [tabs],
  )

  const findNextEnabledIndex = useCallback(
    (currentIndex: number, direction: 1 | -1): number => {
      const currentPos = enabledTabIndices.indexOf(currentIndex)
      if (currentPos === -1) return enabledTabIndices[0] || 0

      const nextPos =
        direction > 0
          ? (currentPos + 1) % enabledTabIndices.length
          : (currentPos - 1 + enabledTabIndices.length) % enabledTabIndices.length

      return enabledTabIndices[nextPos] || currentIndex
    },
    [enabledTabIndices],
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (tabs.length === 0 || enabledTabIndices.length === 0) return

      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault()
          setFocusedIndex((prev) => findNextEnabledIndex(prev, -1))
          break
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault()
          setFocusedIndex((prev) => findNextEnabledIndex(prev, 1))
          break
        case 'Enter':
        case ' ':
          e.preventDefault()
          if (focusedIndex >= 0 && focusedIndex < tabs.length) {
            const tab = tabs[focusedIndex]
            if (!tab.disabled) {
              setActiveTab(tab.id)
            }
          }
          break
        case 'Home':
          e.preventDefault()
          setFocusedIndex(enabledTabIndices[0] || 0)
          break
        case 'End':
          e.preventDefault()
          setFocusedIndex(enabledTabIndices[enabledTabIndices.length - 1] || tabs.length - 1)
          break
      }
    },
    [tabs, focusedIndex, setActiveTab, enabledTabIndices, findNextEnabledIndex],
  )

  // Don't render on desktop screens
  if (!isMobile) {
    return null
  }

  const shouldHide = isHidden || isKeyboardVisible
  const positionClass = position === 'top' ? 'top-0' : 'bottom-0'
  const transformClass = shouldHide ? (position === 'top' ? '-translate-y-full' : 'translate-y-full') : 'translate-y-0'

  const variantClasses = {
    default: 'bg-white/80 backdrop-blur-md border-t border-gray-200/50 dark:bg-gray-900/80 dark:border-gray-700/50',
    floating:
      'bg-white/90 backdrop-blur-xl rounded-2xl mx-4 mb-4 shadow-lg border border-gray-200/30 dark:bg-gray-800/90 dark:border-gray-600/30',
    minimal: 'bg-transparent border-none',
  }

  return (
    <div
      className={cn(
        'fixed left-0 right-0 z-50 transition-all ease-out',
        positionClass,
        transformClass,
        'opacity-100',
        shouldHide && 'opacity-0 pointer-events-none',
        variantClasses[variant],
        safeAreaInset && position === 'bottom' && 'pb-safe',
        safeAreaInset && position === 'top' && 'pt-safe',
        className,
      )}
      style={{
        transitionDuration: `${animation?.duration || 300}ms`,
        transitionTimingFunction: animation?.easing || 'ease-out',
        backdropFilter: variant !== 'minimal' ? 'blur(20px)' : undefined,
        WebkitBackdropFilter: variant !== 'minimal' ? 'blur(20px)' : undefined,
        backgroundColor: theme?.background,
        borderColor: theme?.borderColor,
      }}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      data-testid={testId}
      role="tablist"
      aria-orientation="horizontal"
    >
      <div
        className={cn(
          'flex items-center justify-around px-2',
          compactMode ? 'py-1 min-h-[44px]' : 'py-2 min-h-[60px]',
          variant === 'floating' && 'px-4',
        )}
      >
        {tabs.map((tab, index) => (
          <TabItem
            key={tab.id}
            tab={tab}
            isActive={activeTab === tab.id}
            isFocused={focusedIndex === index}
            showLabel={showLabels}
            compact={compactMode}
            theme={theme!}
            animation={animation!}
            onPress={() => !tab.disabled && setActiveTab(tab.id)}
            onFocus={() => setFocusedIndex(index)}
          />
        ))}
      </div>
    </div>
  )
})

interface TabItemProps<T extends string = string> {
  tab: TabItem<T>
  isActive: boolean
  isFocused?: boolean
  showLabel?: boolean
  compact?: boolean
  theme?: TabbarTheme
  animation?: TabbarAnimation
  onPress: () => void
  onFocus?: () => void
}

const TabItem = memo(function TabItem<T extends string = string>({
  tab,
  isActive,
  isFocused = false,
  showLabel = true,
  compact = false,
  theme,
  animation,
  onPress,
  onFocus,
}: TabItemProps<T>) {
  const [isPressed, setIsPressed] = useState(false)
  const [rippleKey, setRippleKey] = useState(0)

  const handleMouseDown = useCallback(() => {
    if (animation?.enableSpring) {
      setIsPressed(true)
    }
  }, [animation?.enableSpring])

  const handleMouseUp = useCallback(() => {
    setIsPressed(false)
    if (animation?.enableRipple) {
      setRippleKey((prev) => prev + 1)
    }
  }, [animation?.enableRipple])

  const handleClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault()
      onPress()
    },
    [onPress],
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onPress()
      }
    },
    [onPress],
  )
  const activeColor = theme?.activeColor || '#3b82f6'
  const inactiveColor = theme?.inactiveColor || '#6b7280'
  const badgeColor = theme?.badgeColor || '#ef4444'
  const badgeTextColor = theme?.badgeTextColor || '#ffffff'

  return (
    <button
      className={cn(
        'relative flex flex-col items-center justify-center rounded-lg',
        'transition-all ease-out focus:outline-none overflow-hidden',
        compact ? 'min-w-[40px] min-h-[40px] px-1 py-1' : 'min-w-[44px] min-h-[44px] px-2 py-2',
        'focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-blue-500',
        isFocused && 'ring-2 ring-blue-500 ring-offset-1',
        tab.disabled
          ? 'opacity-40 cursor-not-allowed'
          : cn(
              'hover:bg-gray-100/50 dark:hover:bg-gray-800/50',
              animation?.enableSpring && isPressed && 'scale-95',
              !animation?.enableSpring && 'active:scale-95 active:opacity-70',
            ),
      )}
      style={{
        transitionDuration: `${animation?.duration || 200}ms`,
        transitionTimingFunction: animation?.easing || 'ease-out',
      }}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onKeyDown={handleKeyDown}
      onFocus={onFocus}
      disabled={tab.disabled}
      aria-label={tab['aria-label'] || tab.label}
      aria-selected={isActive}
      role="tab"
      tabIndex={isFocused ? 0 : -1}
      data-testid={tab.testId}
    >
      {/* Ripple Effect */}
      {animation?.enableRipple && (
        <div
          key={rippleKey}
          className="absolute inset-0 rounded-lg opacity-20 animate-ping"
          style={{ backgroundColor: activeColor }}
        />
      )}

      {/* Icon Container */}
      <div
        className={cn('relative flex items-center justify-center', showLabel ? (compact ? 'mb-1' : 'mb-2') : 'mb-0')}
      >
        <div
          className={cn('flex items-center justify-center transition-all', compact ? 'w-6 h-6' : 'w-7 h-7')}
          style={{
            color: isActive ? activeColor : inactiveColor,
            transitionDuration: `${animation?.duration || 200}ms`,
            transitionTimingFunction: animation?.easing || 'ease-out',
          }}
        >
          {isActive && tab.activeIcon ? tab.activeIcon : tab.icon}
        </div>

        {/* Badge */}
        {tab.badge !== null && tab.badge !== undefined && tab.badge !== '' && (
          <div
            className={cn(
              'absolute -top-1 -right-1 min-w-[16px] h-4 px-1',
              'text-xs font-medium rounded-full flex items-center justify-center',
              'animate-in fade-in zoom-in duration-200 shadow-sm',
            )}
            style={{
              backgroundColor: badgeColor,
              color: badgeTextColor,
              fontSize: '10px',
              lineHeight: '12px',
            }}
            aria-label={`${tab.badge} notifications`}
          >
            {typeof tab.badge === 'number' && tab.badge > 99 ? '99+' : tab.badge}
          </div>
        )}
      </div>

      {/* Label */}
      {showLabel && (
        <span
          className={cn(
            'font-medium transition-colors leading-none max-w-[64px] truncate text-center',
            compact ? 'text-xs' : 'text-xs',
          )}
          style={{
            color: isActive ? activeColor : inactiveColor,
            fontSize: compact ? '9px' : '10px',
            transitionDuration: `${animation?.duration || 200}ms`,
            transitionTimingFunction: animation?.easing || 'ease-out',
          }}
        >
          {tab.label}
        </span>
      )}
    </button>
  )
})

// Enhanced hook to register tabs with validation
export function useTabbarConfig<T extends string = string>(
  tabs: TabItem<T>[],
  options?: {
    validateIds?: boolean
    autoSelectFirst?: boolean
  },
) {
  const { setTabs, activeTab, setActiveTab } = useTabbar<T>()
  const { validateIds = true, autoSelectFirst = true } = options || {}

  useEffect(() => {
    if (validateIds) {
      const ids = tabs.map((tab) => tab.id)
      const uniqueIds = new Set(ids)
      if (ids.length !== uniqueIds.size) {
        console.warn('TabbarConfig: Duplicate tab IDs detected. This may cause unexpected behavior.')
      }
    }

    setTabs(tabs)

    // Auto-select first tab if no active tab is set
    if (autoSelectFirst && !activeTab && tabs.length > 0) {
      const firstEnabledTab = tabs.find((tab) => !tab.disabled)
      if (firstEnabledTab) {
        setActiveTab(firstEnabledTab.id)
      }
    }
  }, [tabs, setTabs, validateIds, autoSelectFirst, activeTab, setActiveTab])
}

// Hook to hide/show tabbar
export function useTabbarVisibility() {
  const { isHidden, setIsHidden } = useTabbar()

  return {
    isHidden,
    hide: () => setIsHidden(true),
    show: () => setIsHidden(false),
    toggle: () => setIsHidden(!isHidden),
  }
}

// Hook for programmatic tab navigation
export function useTabbarNavigation<T extends string = string>() {
  const { tabs, activeTab, setActiveTab } = useTabbar<T>()

  return useMemo(
    () => ({
      currentTab: activeTab,
      tabs,
      goToTab: (id: T) => {
        const tab = tabs.find((t) => t.id === id)
        if (tab && !tab.disabled) {
          setActiveTab(id)
          return true
        }
        return false
      },
      goToNext: () => {
        if (!activeTab || tabs.length === 0) return false
        const currentIndex = tabs.findIndex((t) => t.id === activeTab)
        if (currentIndex === -1) return false

        for (let i = 1; i < tabs.length; i++) {
          const nextIndex = (currentIndex + i) % tabs.length
          const nextTab = tabs[nextIndex]
          if (!nextTab.disabled) {
            setActiveTab(nextTab.id)
            return true
          }
        }
        return false
      },
      goToPrevious: () => {
        if (!activeTab || tabs.length === 0) return false
        const currentIndex = tabs.findIndex((t) => t.id === activeTab)
        if (currentIndex === -1) return false

        for (let i = 1; i < tabs.length; i++) {
          const prevIndex = (currentIndex - i + tabs.length) % tabs.length
          const prevTab = tabs[prevIndex]
          if (!prevTab.disabled) {
            setActiveTab(prevTab.id)
            return true
          }
        }
        return false
      },
    }),
    [tabs, activeTab, setActiveTab],
  )
}

export type { TabItem, TabChangeEvent, TabbarTheme, TabbarAnimation }
