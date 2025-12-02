import * as Settings from '@xstack/app-kit/settings'
import { IdentityService } from '@xstack/local-first/services'
import { useAccount } from '@xstack/user-kit/account/hooks'
import { useAuthSignOutButton } from '@xstack/user-kit/authentication/hooks'
import * as Option from 'effect/Option'
import { useTranslation } from 'react-i18next'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useSubscription } from '@xstack/app-kit/purchase/hooks'
import { ProVersionCard } from '@xstack/app-kit/purchase/components/pricing-block'

interface ProfileData {
  username: string | undefined
  email: string | undefined
  avatar: string | undefined
}

export function SecuritySettings() {
  const { t } = useTranslation()
  const signOut = useAuthSignOutButton()
  const identityService = IdentityService.useAtom

  const { value: account } = useAccount()
  const { value: subscription } = useSubscription()

  const profile: ProfileData = {
    username: Option.getOrUndefined(Option.map(account.user, (_) => _.username)),
    email: Option.getOrUndefined(Option.map(account.user, (_) => _.email)),
    avatar: Option.getOrUndefined(Option.map(account.user, (_) => _.avatar)),
  }

  // TODO: loading state
  const signOutConfirm = async () => {
    await identityService.clearData.promise()

    await signOut({ keepAppEnable: true, redirect: '/home' })
  }

  return (
    <>
      <Settings.SettingGroup>
        <div className="relative overflow-hidden rounded-lg border bg-card">
          <div className="relative flex flex-col items-start p-6">
            <Avatar
              className="size-24 cursor-pointer ring-2 ring-offset-2 ring-offset-background ring-primary/10 transition-all hover:ring-primary/30"
              onClick={() => {
                /* 处理头像更换逻辑 */
              }}
            >
              <AvatarImage src={profile.avatar} alt={profile.username} />
              {profile.username && <AvatarFallback>{profile.username.charAt(0).toUpperCase()}</AvatarFallback>}
            </Avatar>
            <div className="mt-4 text-center pl-6">
              <div className="text-xl font-medium">{profile.username}</div>
            </div>
          </div>
        </div>
        {Option.match(account.user, {
          onNone: () => null,
          onSome: (user) => (
            <>
              <Settings.SettingItem icon={<div className="i-lucide-mail h-5 w-5" />} title={t('邮箱')}>
                {user.email}
              </Settings.SettingItem>
              <Settings.SettingItem icon={<div className="i-lucide-user h-5 w-5" />} title={t('用户名')}>
                {user.username}
              </Settings.SettingItem>
            </>
          ),
        })}
      </Settings.SettingGroup>
      <Settings.SettingGroup>
        <Settings.SettingItem
          icon={<div className="i-lucide-key h-5 w-5" />}
          title={t('第三方登录')}
          description={t('已关联的登录方式')}
        >
          <div className="flex gap-2">
            {account.oauthProviders.map((provider) => {
              return (
                <div className="gap-2 flex items-center" key={provider.id}>
                  <i
                    className={provider.id === 'Github' ? 'i-logo-github-icon h-4 w-4' : 'i-logos-google-icon h-4 w-4'}
                  />
                  {provider.id}
                </div>
              )
            })}
          </div>
        </Settings.SettingItem>
      </Settings.SettingGroup>
      <Settings.SettingGroup>
        {/* Logout */}
        <Settings.SettingItem
          title={t('退出登录')}
          description={'登出当前账号，将会清除本地数据。请确保您已备份好助记词。'}
        >
          <Button variant="ghost" size="sm" className="gap-2" onClick={() => signOutConfirm()}>
            <i className="i-lucide-log-out h-4 w-4" />
            {t('退出')}
          </Button>
        </Settings.SettingItem>
      </Settings.SettingGroup>
      <Settings.SettingGroup>
        <ProVersionCard
          onUpgrade={() => {
            // TODO: set setting menu
          }}
        />
      </Settings.SettingGroup>
    </>
  )
}
