import { useSettingOpenItem } from '@xstack/app-kit/global-state'
import { findItem } from '@xstack/app-kit/settings/settings-content'
import { SettingsFooter } from '@xstack/app-kit/settings/settings-footer'
import type { SettingMenuConfig } from '@xstack/app-kit/settings/types'
import { ErrorBoundary } from '@xstack/errors/react/error-boundary'
import { cn } from '@/lib/utils'
import { type FC, type LazyExoticComponent, Suspense, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { SettingsLoading } from './loading'

export interface MobileSettingsDetailProps {
  /** Settings menu configuration */
  menus: SettingMenuConfig[]
  /** Lazy-loaded modules for settings panels */
  modules: Record<string, LazyExoticComponent<FC>>
  /** Additional CSS classes */
  className?: string | undefined
  /** Whether the layout is fixed height */
  fixed?: boolean | undefined
  /** Data test id for testing */
  'data-testid'?: string | undefined
  /** Custom back button handler */
  onBack?: (() => void) | undefined
  /** Whether to show safe area padding */
  safeAreaInset?: boolean | undefined
}

/**
 * Mobile-optimized settings detail view that displays individual setting panels
 * with proper navigation, loading states, and error boundaries.
 */
export function MobileSettingsDetail({
  menus,
  modules,
  className,
  fixed = false,
  'data-testid': testId,
  onBack,
  safeAreaInset = true,
}: MobileSettingsDetailProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const scrollRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [settingOpenItem, setSettingOpenItem] = useSettingOpenItem()

  // URL sync is now handled by useSettingOpenItemWithUrlSync hook

  const menuItem = findItem(settingOpenItem?.id, menus)
  const Cp = menuItem?.id ? modules[menuItem.id] : defaultCp

  const handleBack = useCallback(() => {
    if (onBack) {
      onBack()
    } else {
      // Mobile back button: navigate back to settings list
      // Use replace to avoid stack buildup when going back
      navigate('/settings', { replace: true })
    }
  }, [navigate, onBack])

  useEffect(() => {
    if (scrollRef.current && menuItem) {
      // Reset scroll position when switching to a different menu item
      scrollRef.current.scrollTo({ top: 0, behavior: 'auto' })
    }
  }, [menuItem?.id]) // Only trigger when menu item ID changes

  // Only redirect if we're on a specific settings path but no valid item found
  useEffect(() => {
    if (!menuItem && window.location.pathname !== '/settings') {
      navigate('/settings', { replace: true })
    }
  }, [menuItem, navigate])

  if (!menuItem) {
    return null
  }

  return (
    <Suspense fallback={<MobileSettingsLoadingFallback />}>
      <div className={cn('flex flex-col h-screen bg-background', className)} data-testid={testId}>
        {/* Header */}
        <div
          className={cn(
            'sticky top-0 bg-background/95 backdrop-blur-sm border-b px-4 py-3 z-10 flex-shrink-0',
            safeAreaInset && 'pt-[max(16px,env(safe-area-inset-top))]',
          )}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleBack()
                }
              }}
              className="flex-shrink-0 p-2 -ml-2 hover:bg-muted/60 rounded-full transition-all duration-200 active:scale-90 touch-manipulation focus:outline-none focus:ring-2 focus:ring-accent/50 focus:ring-inset"
              aria-label="Back to Settings"
              data-testid="mobile-settings-back-button"
            >
              <i className="i-lucide-arrow-left size-5 text-foreground" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold truncate">{menuItem ? t(menuItem.title) : 'Settings'}</h1>
              {menuItem?.desc && <p className="text-sm text-muted-foreground truncate mt-0.5">{t(menuItem.desc)}</p>}
            </div>
          </div>
        </div>

        {/* Content */}
        <div
          ref={scrollRef}
          className={cn(
            'flex-1 min-h-0 overflow-x-hidden overflow-y-auto overscroll-none px-4 bg-muted/5',
            'scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40',
            !fixed && 'h-full',
          )}
          style={{
            paddingBottom: safeAreaInset ? 'max(24px, env(safe-area-inset-bottom))' : '24px',
          }}
          role="main"
          aria-label={`${menuItem?.title || 'Settings'} content`}
        >
          <ErrorBoundary key={menuItem?.id}>
            <div
              className={cn('flex flex-col max-w-3xl gap-y-4 py-6 relative', !fixed ? 'min-h-0 flex-1' : 'flex-grow')}
            >
              <div className="flex-grow flex flex-col gap-4" ref={containerRef}>
                <Cp />
              </div>
              <SettingsFooter menus={menus} fixed={fixed} containerRef={containerRef} />
            </div>
          </ErrorBoundary>
        </div>
      </div>
    </Suspense>
  )
}

const defaultCp = () => null

const MobileSettingsLoadingFallback = () => <SettingsLoading variant="detail" />
