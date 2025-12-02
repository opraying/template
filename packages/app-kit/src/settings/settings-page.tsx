import { MobileSettingsDetail } from '@xstack/app-kit/layout/mobile-settings-detail'
import { MobileSettingsList } from '@xstack/app-kit/layout/mobile-settings-list'
import { useIsDesktopScreen } from '@xstack/app-kit/lib/screen-utils'
import { SettingsContent } from '@xstack/app-kit/settings/settings-content'
import { SettingsMenu } from '@xstack/app-kit/settings/settings-menu'
import type { SettingMenuConfig } from '@xstack/app-kit/settings/types'
import type { FC, LazyExoticComponent } from 'react'
import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'

export const SettingsPage = <T extends SettingMenuConfig, Key extends T['data'][number]['id']>({
  initial,
  menus,
  modules,
}: {
  initial?: Key | undefined
  menus: T[]
  modules: Record<string, LazyExoticComponent<FC>>
}) => {
  const location = useLocation()
  const navigate = useNavigate()
  const isLargeScreen = useIsDesktopScreen()

  // For mobile: determine if we should show list or detail view based on URL
  const moduleFromUrl = location.pathname.split('/settings/')[1] || ''
  const showMobileDetail = !isLargeScreen && moduleFromUrl

  // Desktop: redirect to first page if on /settings root
  useEffect(() => {
    if (isLargeScreen && location.pathname === '/settings' && menus.length > 0) {
      const firstItemId = initial || menus[0]?.data[0]?.id
      if (firstItemId) {
        navigate(`/settings/${firstItemId}`, { replace: true })
      }
    }
  }, [location.pathname, navigate, initial, menus, isLargeScreen])

  // Mobile: ensure proper state synchronization on initial load
  useEffect(() => {
    if (!isLargeScreen) {
      const moduleFromUrl = location.pathname.split('/settings/')[1] || ''
      if (moduleFromUrl && initial && moduleFromUrl === initial) {
        // Ensure state is synced with URL for mobile when coming from external link
        const initialItem = menus.flatMap((menu) => menu.data).find((item) => item.id === initial)
        if (initialItem) {
          // State will be synced via useSettingOpenItem hook
        }
      }
    }
  }, [isLargeScreen, initial, menus, location.pathname])

  if (!isLargeScreen) {
    // Mobile layout
    if (showMobileDetail) {
      return <MobileSettingsDetail menus={menus} modules={modules} className="h-screen" />
    } else {
      return <MobileSettingsList menus={menus} className="h-screen" initial={initial} />
    }
  }

  // Desktop layout
  return (
    <div className="flex flex-col md:flex-row flex-1 h-full overflow-hidden">
      <SettingsMenu menus={menus} />
      <SettingsContent menus={menus} modules={modules} />
    </div>
  )
}
