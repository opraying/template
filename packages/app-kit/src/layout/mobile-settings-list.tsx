import { cn } from '@/lib/utils'
import { useSettingOpenItem } from '@xstack/app-kit/global-state'
import type { SettingMenuConfig } from '@xstack/app-kit/settings/types'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router'

export interface MobileSettingsListProps {
  /** Settings menu configuration array */
  menus: SettingMenuConfig[]
  /** Additional CSS classes */
  className?: string | undefined
  /** Initial selected setting ID */
  initial?: string | undefined
  /** Data test id for testing */
  'data-testid'?: string | undefined
  /** Whether to show safe area padding */
  safeAreaInset?: boolean | undefined
  /** Custom item click handler */
  onItemClick?: ((item: SettingMenuConfig['data'][number]) => void) | undefined
}

/**
 * Mobile-optimized settings list view that displays all available settings
 * in a scrollable, touch-friendly interface.
 */
export function MobileSettingsList({
  menus,
  className,
  initial,
  'data-testid': testId,
  safeAreaInset = true,
  onItemClick,
}: MobileSettingsListProps) {
  const { t } = useTranslation()
  const [settingOpenItem, setSettingOpenItem] = useSettingOpenItem()
  const location = useLocation()
  const navigate = useNavigate()

  // Clear selection when on /settings root (without module)
  useEffect(() => {
    const moduleFromUrl = location.pathname.split('/settings/')[1] || ''
    if (!moduleFromUrl && settingOpenItem?.id) {
      setSettingOpenItem(null)
    }
  }, [location.pathname, settingOpenItem?.id, setSettingOpenItem])

  // Only set initial item if there's a URL parameter for it, not just because initial prop exists
  useEffect(() => {
    const moduleFromUrl = location.pathname.split('/settings/')[1] || ''
    if (initial && !settingOpenItem && moduleFromUrl === initial) {
      const initialItem = menus.flatMap((menu) => menu.data).find((item) => item.id === initial)
      if (initialItem) {
        setSettingOpenItem(initialItem)
      }
    }
  }, [initial, settingOpenItem, menus, setSettingOpenItem, location.pathname])

  return (
    <div className={cn('flex flex-col bg-background min-h-screen', className)} data-testid={testId}>
      {/* Header */}
      <div
        className={cn(
          'sticky top-0 bg-background/95 backdrop-blur-sm border-b px-4 py-3 z-10 flex-shrink-0',
          safeAreaInset && 'pt-[max(16px,env(safe-area-inset-top))]',
        )}
      >
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">{t('Settings')}</h1>
        </div>
      </div>

      {/* Settings List */}
      <div
        className="flex-1 min-h-0 overflow-y-auto bg-muted/10 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40"
        style={{
          paddingBottom: safeAreaInset ? 'max(24px, env(safe-area-inset-bottom))' : '24px',
        }}
        role="main"
        aria-label="Settings list"
      >
        {menus.map((menu, menuIndex) => (
          <div key={menu.id} className={cn('bg-background', menuIndex > 0 && 'mt-8')}>
            {menu.title && (
              <div className="px-4 py-3 bg-muted/20">
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{t(menu.title)}</h2>
              </div>
            )}
            <div className="bg-background border border-border/20 rounded-lg mx-4 mb-4 overflow-hidden">
              {menu.data.map((item, itemIndex) => (
                <button
                  key={item.id}
                  onClick={() => {
                    if (onItemClick) {
                      onItemClick(item)
                    } else {
                      // Navigate to detail view with proper URL
                      navigate(`/settings/${item.id}`)
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      if (onItemClick) {
                        onItemClick(item)
                      } else {
                        navigate(`/settings/${item.id}`)
                      }
                    }
                  }}
                  className={cn(
                    'w-full flex items-center justify-between px-4 py-4 text-left transition-all duration-200',
                    'hover:bg-muted/50 active:bg-muted/80 active:scale-[0.99]',
                    'touch-manipulation select-none focus:outline-none focus:ring-2 focus:ring-accent/50 focus:ring-inset',
                    settingOpenItem?.id === item.id && 'bg-accent/20',
                  )}
                  role="button"
                  tabIndex={0}
                  aria-label={`Open ${t(item.title)} settings`}
                  data-testid={`settings-item-${item.id}`}
                  style={{
                    ...(itemIndex > 0 && { borderTop: '1px solid hsl(var(--border) / 0.2)' }),
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {item.icon && (
                      <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-muted/40">
                        <div className="text-foreground/80 text-lg">{item.icon}</div>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-foreground text-base">{t(item.title)}</div>
                      {item.desc && (
                        <div className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{t(item.desc)}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex-shrink-0 ml-3">
                    <i className="i-lucide-chevron-right size-5 text-muted-foreground/60" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
