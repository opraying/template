import { usePlansLoader } from '@xstack/app-kit/purchase/components/loader'
import { usePaymentInit, useSubscriptionRefresh } from '@xstack/app-kit/purchase/hooks'
import { useNavigate } from '@xstack/router'

export const PreInit = () => {
  const navigate = useNavigate()
  const { system } = usePlansLoader()
  const refresh = useSubscriptionRefresh()

  const onError = (_error: Error) => {
    // TODO: handle the error
  }

  const onSuccess = async () => {
    await refresh()

    // [TODO] 后续的流程
    navigate.push('/')
  }

  usePaymentInit({
    providerId: system.providerId,
    environment: system.environment,
    onError,
    onSuccess,
  })

  return null
}
