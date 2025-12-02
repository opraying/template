import { init } from '@client/boot'
import { Live } from '@client/context'
import NiceModal from '@ebay/nice-modal-react'
import { LoginPortal } from '@shared/components/login-portal'
import { OnboardingDialog } from '@shared/components/onboarding-dialog'
import { authWebConfig } from '@shared/config'
import { useAppScopeHotKey } from '@shared/hooks/use-app-scope-hotkey'
import { SettingsDialog } from '@shared/hooks/use-settings-dialog'
import { CommandModal } from '@shared/misc/modals/command'
import customCss from '@shared/styles/custom.css?url'
import { Boot } from '@xstack/app/components/boot'
import { LoadingIndicator } from '@xstack/app/components/loading-indicator'
import { usePageIndicatorActions } from '@xstack/app/hooks/use-hide-page-loading'
import { AppStatus } from '@xstack/app-kit/components/app-status'
import { AppLayout, NavGroup, NavItem, SidebarContent, SidebarFooter, SidebarHeader } from '@xstack/app-kit/layout'
import * as Menu from '@xstack/lib/components/menu'
import { Separator } from '@xstack/lib/ui/separator'
import { AuthConfigProvider } from '@xstack/user-kit/authentication/components/auth-provider'
import { useAuthInit, useUser } from '@xstack/user-kit/authentication/hooks'
import * as Option from 'effect/Option'
import { type ReactElement, useEffect } from 'react'
import { HotkeysProvider } from 'react-hotkeys-hook'
import { useTranslation } from 'react-i18next'
import { Outlet, useLocation, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export const Component = () => (
  <>
    <LoadingIndicator />
    <link rel="stylesheet" href={customCss} />
    <Boot layer={Live} init={init}>
      <AuthConfigProvider config={authWebConfig}>
        <NiceModal.Provider>
          <HotkeysProvider initiallyActiveScopes={['basic', 'app']}>
            <AppHooksMisc />
            <Main />
          </HotkeysProvider>
        </NiceModal.Provider>
      </AuthConfigProvider>
    </Boot>
  </>
)

function AppHooksMisc() {
  useAppScopeHotKey()

  return null
}

function Main() {
  const _location = useLocation()
  const [searchParams] = useSearchParams()
  const _pageIndicator = usePageIndicatorActions()

  useAuthInit()

  useEffect(() => {
    if (searchParams.has('onboarding')) {
      OnboardingDialog.open()
    }
    return () => {
      OnboardingDialog.hide()
    }
  }, [searchParams])

  return (
    <AppLayout sidebar={<AppMenu />}>
      <Outlet />
    </AppLayout>
  )
}

const MenuNavs = [
  {
    href: '/',
    icon: <i className="i-lucide-home size-4" />,
    label: 'Welcome',
  },
]

function UserMenu() {
  const { pathname } = useLocation()
  const user = useUser()
  const dropdown2 = useDropdown2()

  const avatar = user.pipe(
    Option.map((_) => _.avatar),
    Option.getOrUndefined,
  )

  return (
    <Button variant="ghost" size="icon" className="overflow-hidden rounded-full" {...dropdown2}>
      {avatar ? (
        <img
          crossOrigin="anonymous"
          src={avatar}
          width={26}
          height={26}
          alt="Avatar"
          className="overflow-hidden rounded-full"
        />
      ) : (
        <i className="i-lucide-user-circle size-5" />
      )}
    </Button>
  )
}

function AppMenu() {
  const { pathname } = useLocation()
  const _user = useUser()
  const dropdown1 = useDropdown1()

  return (
    <TooltipProvider>
      <SidebarHeader>
        <AppMenuHeader />
      </SidebarHeader>
      <SidebarContent>
        <Search />
        {MenuNavs.map((link) => {
          return (
            <NavItem
              key={link.href}
              id={link.href}
              href={link.href}
              title={link.label}
              icon={link.icon}
              active={link.href === pathname}
            />
          )
        })}
        <Separator />
        <NavGroup
          title="Test"
          allowCollapse
          separator
          data={[
            {
              id: '/test/primitives',
              href: '/test/primitives',
              title: 'Primitives',
            },
            {
              id: '/test/components',
              href: '/test/components',
              title: 'Components',
            },
            {
              id: '/test/settings',
              href: '/test/settings',
              title: 'Settings',
            },
          ]}
        />
      </SidebarContent>
      <SidebarFooter>
        <AppNavbarFooter />
        <div className="flex justify-between items-center">
          <Button variant="ghost" size="icon" className="overflow-hidden rounded-full" {...dropdown1}>
            <i className="i-lucide-help-circle size-5" />
          </Button>
        </div>
      </SidebarFooter>
    </TooltipProvider>
  )
}

function Search() {
  return (
    <div className="flex items-center gap-1.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="py-2 px-4 size-auto bg-input w-full"
            onClick={() => {
              CommandModal.open()
            }}
          >
            <i className="i-lucide-search size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Search CMD+k</p>
        </TooltipContent>
      </Tooltip>
    </div>
  )
}

function AppMenuHeader() {
  return (
    <div className="flex items-center px-3 h-full justify-between gap-1.5" data-tauri-drag-region>
      <div className="flex items-center gap-1">
        <UserMenu />
      </div>
      <div className="flex items-center">
        <AppStatus />
        {/* <AppIndexButton /> */}
      </div>
    </div>
  )
}

function _AppIndexButton() {
  return (
    <Button variant={'ghost'} size="icon" className="size-auto" asChild>
      <a href="/">
        <img src="/logo/120.png" alt="Template" className="size-10" />
      </a>
    </Button>
  )
}

const ALT_LINKS: Array<{
  href: string
  icon: ReactElement
  label: string
}> = []

function AppNavbarFooter() {
  return (
    <div className="flex flex-col gap-2">
      {ALT_LINKS.map((item) => {
        return <NavItem key={item.href} id={item.href} href={item.href} title={item.label} icon={item.icon} />
      })}
    </div>
  )
}

const useDropdown1 = Menu.dropdown(() => {
  const { t } = useTranslation()

  return [
    {
      label: t('nav.website'),
      type: 'link',
      target: '_blank',
      icon: <i className="i-lucide-external-link size-4" />,
      href: '/home',
    },
    {
      type: 'separator',
    },
    {
      label: t('nav.get-app'),
      onClick: () => {},
    },
    {
      label: t('nav.changelog'),
      onClick: () => {},
    },
    {
      type: 'separator',
    },
    {
      label: t('nav.feedback'),
      onClick: () => {},
    },
  ]
})

const useDropdown2 = Menu.dropdown(() => {
  const user = useUser()
  const { t } = useTranslation()

  if (Option.isNone(user)) {
    return [
      {
        label: t('auth.login'),
        onClick: () => LoginPortal.open(),
      },
      {
        label: t('settings.title'),
        icon: <i className="i-lucide-settings size-4" />,
        onClick: () => SettingsDialog.open(),
      },
    ]
  }

  return [
    {
      label: t('settings.title'),
      icon: <i className="i-lucide-settings size-4" />,
      onClick: () => SettingsDialog.open(),
    },
    { type: 'separator' },
    {
      label: t('misc.app-reload'),
      icon: <i className="i-lucide-refresh-cw size-4 flex-shrink-0" />,
      onClick: () => {
        window.location.reload()
      },
    },
  ]
})
