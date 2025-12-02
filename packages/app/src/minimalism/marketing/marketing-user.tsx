import { useAppEnable } from '@xstack/app/hooks/use-app-utils'
import { useMarketingUser } from '@xstack/app-kit/hooks'
import { lazy } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

const LazyUserMenu = lazy(() => import('./user-menu').then((_) => ({ default: _.UserMenu })))

export const MarketingUserMenu = ({ loginUrl }: { loginUrl?: string | undefined }) => {
  const { t } = useTranslation()
  const isAppEnable = useAppEnable()
  const marketingUser = useMarketingUser()

  /**
   * 如果应用是启用的或者用户存在，尝试显示用户菜单
   */
  const displayUser = isAppEnable || marketingUser

  if (!displayUser || !marketingUser) {
    return (
      <Button asChild>
        <a href={isAppEnable ? '/' : loginUrl || '/login'}>{isAppEnable ? t('auth.launch') : t('auth.login')}</a>
      </Button>
    )
  }

  return <LazyUserMenu />
}
