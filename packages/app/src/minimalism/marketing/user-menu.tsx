import { useSetAppStatusEnable } from '@xstack/app/hooks/use-app-utils'
import { useMarketingUser } from '@xstack/app-kit/hooks'
import { useAuthInit } from '@xstack/user-kit/authentication/hooks'
import { useTranslation } from 'react-i18next'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function UserMenu() {
  const { t } = useTranslation()
  const setAppEnable = useSetAppStatusEnable()
  const marketingUser = useMarketingUser()

  if (!marketingUser) throw new Error('User not found')

  /**
   * Trigger auth session load
   */
  useAuthInit()

  const avatar = marketingUser.avatar

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <img crossOrigin="anonymous" src={avatar} className="w-9 h-9 rounded-full" alt="User Avatar" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="font-medium leading-none">{marketingUser.username}</p>
            <p className="text-xs leading-none text-muted-foreground">{marketingUser.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild onClick={() => setAppEnable()}>
            <a href="/">Launch</a>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
