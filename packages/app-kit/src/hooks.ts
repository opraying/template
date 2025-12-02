import type { InternalUser } from '@xstack/user-kit/authentication/hooks'
import { AUTH_USER_NAME } from '@xstack/user-kit/constants'
import { useLocalStorageState } from 'ahooks'

/**
 * 在 Marketing 相关页面会使用到的一些认证，用户状态获取的 Hooks
 */

export function useMarketingUser() {
  const [user] = useLocalStorageState<InternalUser>(AUTH_USER_NAME, { listenStorageChange: true })

  if (user?.id) {
    return user
  }

  return null
}
