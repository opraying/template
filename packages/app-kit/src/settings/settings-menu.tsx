import { useMenuOpened, useSettingOpenItem } from '@xstack/app-kit/global-state'
import { NavGroup } from '@xstack/app-kit/layout/menu'
import { findItem } from '@xstack/app-kit/settings/settings-content'
import type { SettingMenuConfig, SettingMenuItemConfig } from '@xstack/app-kit/settings/types'
import type { FC } from 'react'
import { lazy } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Drawer as DrawerPrimitive } from 'vaul'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerDescription,
  DrawerHeader,
  DrawerOverlay,
  DrawerPortal,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import { useIsDesktopScreen } from '@xstack/app-kit/lib/screen-utils'
import { cn } from '@/lib/utils'

export function buildModules<T extends SettingMenuConfig, Key extends T['data'][number]['id']>(
  menus: T[],
  modules: Record<Key, () => Promise<{ default: FC }>>,
) {
  const warpModules = Object.fromEntries(
    Object.entries(modules).map(([k, v]) => {
      return [k, lazy(v as () => Promise<{ default: FC }>)]
    }),
  )

  return {
    menus,
    modules: warpModules,
    preload: () =>
      // we don't care if the module preload fails
      Promise.all(
        Object.entries(modules).map(([_key, value]) => (value as () => Promise<{ default: FC }>)().catch(() => {})),
      )
        .then(() => {})
        .catch(() => {}),
  }
}

export function SettingsMenu({ menus, background }: { menus: SettingMenuConfig[]; background?: boolean | undefined }) {
  const { t } = useTranslation()
  const isLargeScreen = useIsDesktopScreen()
  const [settingOpenItem, setSettingOpenItem] = useSettingOpenItem()
  const [_menuOpened, setMenuOpened] = useMenuOpened()
  const navigate = useNavigate()

  const handleClick = (item: SettingMenuItemConfig) => {
    if (!isLargeScreen) {
      setMenuOpened(false)
    }

    // The hook will automatically sync URL
    setSettingOpenItem({ id: item.id })
  }

  const hoverDisabled = !import.meta.env.DEV ? true : !isLargeScreen

  const childItems = menus.map((menu) => {
    return (
      <NavGroup
        key={menu.id}
        title={menu.title ? t(menu.title) : undefined}
        data={menu.data.map((item) => {
          return {
            id: item.id,
            active: settingOpenItem?.id === item.id,
            icon: item.icon,
            href: item.href,
            className: item.className,
            highlight: item.highlight,
            title: t(item.title),
            desc: item.desc ? t(item.desc) : undefined,
            hoverDisabled,
            onClick: () => handleClick(item),
          }
        })}
        separator
      />
    )
  })

  const cls = cn(
    'hidden md:block md:max-w-[220px] w-full p-fl-2xs h-full overflow-y-auto overflow-x-hidden border-border/50 flex-shrink-0',
    'scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40',
    background ? 'bg-[hsl(var(--sidebar-background))]' : 'border-r',
  )

  if (isLargeScreen) {
    return <div className={cls}>{childItems}</div>
  }

  const menuItem = findItem(settingOpenItem?.id, menus)

  return (
    <>
      <Drawer direction="left" shouldScaleBackground={false}>
        <div className="flex items-center px-fl-2xs py-fl-3xs gap-fl-2xs">
          <DrawerTrigger asChild>
            <Button variant="ghost" size="icon">
              <i className="i-lucide-panel-left size-5" />
            </Button>
          </DrawerTrigger>
          <div className="py-fl-3xs">
            <p className="font-medium text-fl-base">{menuItem?.title ? t(menuItem.title) : undefined}</p>
          </div>
        </div>
        <DrawerContent className="max-w-[240px] rounded-none rounded-tr-md rounded-br-md">
          <div className="flex-1 flex-col flex h-full p-fl-2xs-md gap-1.5">{childItems}</div>
        </DrawerContent>
      </Drawer>
    </>
  )
}

const DrawerContent = ({
  className,
  children,
  ...props
}: React.ComponentPropsWithRef<typeof DrawerPrimitive.Content>) => (
  <DrawerPortal>
    <DrawerOverlay className="bg-black/15" />
    <DrawerPrimitive.Content
      className={cn(
        'fixed inset-0 z-50 flex h-auto flex-col rounded-t-[10px] outline-none bg-[hsl(var(--sidebar-background))] border-r',
        className,
      )}
      {...props}
    >
      <DrawerHeader className="hidden">
        <DrawerTitle />
        <DrawerDescription />
      </DrawerHeader>
      {children}
    </DrawerPrimitive.Content>
  </DrawerPortal>
)
DrawerContent.displayName = 'DrawerContent'
