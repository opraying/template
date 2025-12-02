import type { PropsWithChildren, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Tabbar, TabbarProvider, useTabbarConfig, type TabChangeEvent } from '@xstack/app-kit/mobile/tabbar'
import { useIsMobileScreen } from '@xstack/app-kit/lib/screen-utils'
import { ErrorBoundary } from '@xstack/errors/react/error-boundary'

export interface MobileAppLayoutProps {
  /** Additional CSS classes */
  className?: string | undefined
  /** Tab bar configuration */
  tabbarConfig?:
    | {
        tabs: Array<{
          id: string
          label: string
          icon: ReactNode
          activeIcon?: ReactNode
          badge?: number | string
          disabled?: boolean
        }>
      }
    | undefined
  /** Default active tab */
  defaultTab?: string | undefined
  /** Tab change callback */
  onTabChange?: ((event: TabChangeEvent<string>) => void) | undefined
  /** Data test id for testing */
  'data-testid'?: string | undefined
  /** Whether to show safe area padding */
  safeAreaInset?: boolean | undefined
  /** Custom tab bar position */
  tabbarPosition?: 'bottom' | 'top' | undefined
}

/**
 * Mobile-optimized application layout with optional tab bar navigation.
 * Automatically adapts to mobile screen sizes and handles safe areas.
 */
export function MobileAppLayout({
  children,
  className,
  tabbarConfig,
  defaultTab,
  onTabChange,
  'data-testid': testId,
  safeAreaInset = true,
  tabbarPosition = 'bottom',
}: PropsWithChildren<MobileAppLayoutProps>) {
  const isMobile = useIsMobileScreen()

  // On desktop, render children without mobile layout wrapper
  if (!isMobile) {
    return (
      <div className={cn('flex flex-col flex-1', className)} data-testid={testId}>
        {children}
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <TabbarProvider defaultTab={defaultTab || undefined} onTabChange={onTabChange}>
        <MobileAppLayoutContent
          className={className}
          tabbarConfig={tabbarConfig}
          safeAreaInset={safeAreaInset}
          tabbarPosition={tabbarPosition}
          data-testid={testId}
        >
          {children}
        </MobileAppLayoutContent>
      </TabbarProvider>
    </ErrorBoundary>
  )
}

interface MobileAppLayoutContentProps {
  /** Additional CSS classes */
  className?: string | undefined
  /** Tab bar configuration */
  tabbarConfig?:
    | {
        tabs: Array<{
          id: string
          label: string
          icon: ReactNode
          activeIcon?: ReactNode
          badge?: number | string
          disabled?: boolean
        }>
      }
    | undefined
  /** Whether to show safe area padding */
  safeAreaInset?: boolean | undefined
  /** Custom tab bar position */
  tabbarPosition?: 'bottom' | 'top' | undefined
  /** Data test id for testing */
  'data-testid'?: string | undefined
}

function MobileAppLayoutContent({
  children,
  className,
  tabbarConfig,
  safeAreaInset = true,
  tabbarPosition = 'bottom',
  'data-testid': testId,
}: PropsWithChildren<MobileAppLayoutContentProps>) {
  // Register tabs with the provider - always call hook but pass empty array if no config
  useTabbarConfig(tabbarConfig?.tabs || [], {
    autoSelectFirst: true,
    validateIds: true,
  })

  const hasTabbar = tabbarConfig && tabbarConfig.tabs.length > 0
  const tabbarHeight = hasTabbar ? '49px' : '0px'
  const safeAreaPadding = safeAreaInset ? 'env(safe-area-inset-bottom)' : '0px'

  return (
    <div
      className={cn('flex flex-col flex-1 min-h-screen relative', safeAreaInset && 'pb-safe', className)}
      id="mobile-app-layout"
      data-testid={testId}
    >
      {/* Top content area - adjust based on tabbar position */}
      <main
        className={cn(
          'flex-1 overflow-x-hidden',
          hasTabbar && tabbarPosition === 'bottom' && `pb-[calc(${tabbarHeight}+${safeAreaPadding})]`,
          hasTabbar && tabbarPosition === 'top' && `pt-[${tabbarHeight}]`,
        )}
        role="main"
      >
        {children}
      </main>

      {/* Tabbar */}
      {hasTabbar && <Tabbar position={tabbarPosition} safeAreaInset={safeAreaInset} />}
    </div>
  )
}
