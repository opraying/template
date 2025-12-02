import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { useAppEnable } from '@xstack/app/hooks/use-app-utils'
import { type ComponentPropsWithRef, lazy, type ReactNode, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, useMatch } from 'react-router'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useHydrated } from '@/lib/hooks/use-hydrated'
import { cn } from '@/lib/utils'

export const Page = ({ children, className, ...props }: React.ComponentPropsWithRef<'div'>) => {
  return (
    <div {...props} className={cn('wrap w-full py-fl-lg', className)}>
      {children}
    </div>
  )
}

export interface HeaderProps {
  name: string
  links: Array<{ to: string; title: string }>
  loginUrl?: string | undefined
}

const LazyMarketingUserMenu = import.meta.env.SSR
  ? () => null
  : lazy(() => import('./marketing-user').then((mod) => ({ default: mod.MarketingUserMenu })))

export function Header({ name, links, loginUrl }: HeaderProps) {
  const { t } = useTranslation()
  const isAppEnable = useAppEnable()
  const hydrated = useHydrated()

  const defaultButton = (
    <Button asChild>
      <a href={isAppEnable ? '/' : loginUrl || '/login'}>{isAppEnable ? t('auth.launch') : t('auth.login')}</a>
    </Button>
  )

  const signInButton = hydrated ? (
    <Suspense fallback={defaultButton}>
      <LazyMarketingUserMenu loginUrl={loginUrl} />
    </Suspense>
  ) : (
    defaultButton
  )

  return (
    <nav className="bg-background/60 py-fl-sm">
      <div className="wrap flex justify-between w-full">
        <div className="flex items-center">
          <a className="text-md font-semibold" href={isAppEnable ? '/home' : '/'}>
            <div className="flex items-center p-1 space-x-2">
              <img alt="" src="/favicon.png" width="32" height="32" />
              <span>{name}</span>
            </div>
          </a>
        </div>
        <div className="flex items-center flex-1 px-fl-xl">
          <div className="hidden sm:flex flex-row gap-8 items-center">
            {links.map((item) => {
              return <Nav key={item.to} to={item.to} title={item.title} />
            })}
          </div>
        </div>
        <div className="flex items-center">
          <div className="flex flex-1 text-md font-medium">{signInButton}</div>
          <DropdownMenu modal>
            <DropdownMenuTrigger suppressHydrationWarning asChild className="ml-4 sm:hidden">
              <Button variant={'ghost'} size="icon">
                <i className="i-lucide-menu w-6 h-6" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-screen" align="center">
              {links.map((item) => {
                return <MobileNav key={item.to} title={item.title} to={item.to} />
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  )
}

const Nav = ({ to, title }: { to: string; title: string }) => {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => {
        return cn('px-2.5 py-2 rounded-full', isActive ? 'text-primary' : 'text-popover-foreground')
      }}
    >
      {title}
    </NavLink>
  )
}

const DropdownMenuContent = ({
  children,
  className,
  sideOffset = 4,
  ...props
}: ComponentPropsWithRef<typeof DropdownMenuPrimitive.Content>) => {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={-80}
        className={cn(
          'pt-24 pb-10 bg-background/75 backdrop-blur min-w-[8rem] overflow-hidden text-popover-foreground shadow data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-10',
          className,
        )}
        {...props}
      >
        <div className="wrap overflow-hidden py-fl-xs pr-fl-2xl">{children}</div>
      </DropdownMenuPrimitive.Content>
    </DropdownMenuPrimitive.Portal>
  )
}

const MobileNav = ({ to, title }: { to: string; title: string }) => {
  const isActive = useMatch(to)

  return (
    <DropdownMenuItem asChild>
      <a href={to} className="rounded px-2 py-3.5 justify-between pointer-events-auto">
        <span className="text-fl-base font-semibold">{title}</span>
        {isActive && <span className="w-3 h-3 bg-background invert group-hover:scale-110 transition-transform" />}
      </a>
    </DropdownMenuItem>
  )
}

function Section({ title, links }: { title: string; links: Array<{ href: string; label: string }> }) {
  return (
    <div className="flex flex-col items-start justify-start">
      <div className="h-[30px] flex items-center font-medium px-1.5 text-secondary-foreground">{title}</div>
      {links.map(({ href, label }) => (
        <Button key={href} size="sm" variant={'link'} asChild>
          <a href={href} className="text-left text-secondary-foreground/70 -ml-1.5">
            {label}
          </a>
        </Button>
      ))}
    </div>
  )
}

export type FooterProps = {
  minimal?: boolean
  links: {
    company: Array<{ href: string; label: string }>
    legal: Array<{ href: string; label: string }>
    product: Array<{ href: string; label: string }>
  }
  right?: ReactNode
  copyright?: string
  socialLinks?: Array<{ href: string; icon: ReactNode }>
}

export function Footer({ links, minimal = false, right, copyright, socialLinks }: FooterProps) {
  const { t } = useTranslation()

  const config = [
    {
      title: t('nav.product'),
      links: links.product,
    },
    {
      title: t('nav.company'),
      links: links.company,
    },
    {
      title: t('nav.legal'),
      links: links.legal,
    },
  ]

  return (
    <footer className="wrap w-full py-fl-md">
      {!minimal && (
        <div className="flex flex-col py-fl-xs">
          <div className="px-fl-2xs u-grid grid-cols-2 md:grid-cols-3">
            {config.map(({ title, links }) => (
              <Section key={title} title={title} links={links} />
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-between items-center p-fl-xs">
        <div className="space-x-fl-sm">
          {socialLinks?.map(({ href, icon }) => (
            <a key={href} href={href} target="_blank" rel="noreferrer">
              {icon}
            </a>
          ))}
        </div>
        <div className="flex justify-between items-center space-x-fl-sm">{right}</div>
      </div>

      <div className="flex items-center justify-center px-fl-xs text-secondary-foreground/70">
        <div className="px-fl-2xs">{copyright}</div>
      </div>
    </footer>
  )
}
