import { useSettingOpenItem } from '@xstack/app-kit/global-state'
import { SettingsFooter } from '@xstack/app-kit/settings/settings-footer'
import type { SettingMenuConfig, SettingMenuItemConfig } from '@xstack/app-kit/settings/types'
import { ErrorBoundary } from '@xstack/errors/react/error-boundary'
import { cn } from '@xstack/lib/utils'
import { type FC, type LazyExoticComponent, Suspense, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

export interface SettingsMenuModule {
  menus: SettingMenuConfig[]
  modules: Record<string, LazyExoticComponent<FC>>
  preload: () => Promise<void>
}

export const findItem = (key: string | undefined, menus: SettingMenuConfig[]) => {
  const menuItem = menus.reduce(
    (acc, menu) => {
      const item = menu.data.find((item) => item.id === key)
      if (item) {
        return item
      }
      return acc
    },
    null as SettingMenuItemConfig | null,
  )

  return menuItem
}

export function SettingsContent<T extends SettingMenuConfig, Key extends T['data'][number]['id']>({
  menus,
  modules,
  className,
  fixed = false,
}: {
  menus: T[]
  modules: SettingsMenuModule['modules']
  className?: string
  fixed?: boolean | undefined
}) {
  const { t } = useTranslation()
  const scrollRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [settingOpenItem] = useSettingOpenItem()
  const menuItem = findItem(settingOpenItem?.id, menus)
  const Cp = menuItem?.id ? modules[menuItem.id as Key] : defaultCp

  useEffect(() => {
    if (scrollRef.current && menuItem) {
      // Use smooth scrolling for better UX, but only if we're switching items
      scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [menuItem?.id]) // Only trigger when menu item ID changes

  return (
    <Suspense fallback={<Cp />}>
      <div
        ref={scrollRef}
        className={cn(
          'bg-background px-fl-xs-lg flex-1 min-h-0 overflow-x-hidden overflow-y-auto overscroll-none',
          !fixed && 'h-full',
          'scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40',
          className,
        )}
      >
        <div className="hidden md:block border-b sticky top-0 bg-background/95 backdrop-blur-sm z-10 py-fl-2xs-xs">
          <p className="font-medium text-fl-base">{menuItem?.title ? t(menuItem.title) : undefined}</p>
          {menuItem?.desc && <p className="pt-fl-2xs text-fl-sm text-secondary-foreground">{t(menuItem.desc)}</p>}
        </div>
        {menuItem?.desc && (
          <div className="md:hidden py-fl-2xs-xs">
            <p className="text-fl-sm text-secondary-foreground">{t(menuItem.desc)}</p>
          </div>
        )}
        <ErrorBoundary key={menuItem?.id}>
          <div className={cn('flex flex-col max-w-3xl gap-y-fl-md relative', !fixed ? 'min-h-0 flex-1' : 'flex-grow')}>
            <div className="flex-grow flex flex-col gap-fl-2xs" ref={containerRef}>
              <Cp />
            </div>
            <SettingsFooter menus={menus} fixed={fixed} containerRef={containerRef} />
          </div>
        </ErrorBoundary>
      </div>
    </Suspense>
  )
}

const defaultCp = () => null
