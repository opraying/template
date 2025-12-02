import { PricingBlock } from '@xstack/app-kit/purchase/components/pricing-block'
import { openPurchaseDialog } from '@xstack/app-kit/purchase/components/purchase-dialog'
import { usePaymentInit, usePlans, usePlansRefresh, useSubscriptionRefresh } from '@xstack/app-kit/purchase/hooks'

interface PlansProps {
  onError?: ((error: Error) => void) | undefined
  onSuccess?: (() => void | Promise<void>) | undefined
}

export function Plans({ onError, onSuccess }: PlansProps) {
  const {
    value: { namespace, system, plans },
  } = usePlans()
  const refreshSubscription = useSubscriptionRefresh()
  const refreshPlans = usePlansRefresh()

  usePaymentInit({
    providerId: system.providerId,
    environment: system.environment,
    onSuccess: async () => {
      refreshPlans()
      await refreshSubscription()
      await onSuccess?.()
    },
    onError,
  })

  const handleClick = async (id: string) => {
    try {
      const plan = plans.find((plan) => plan.id === id)
      if (!plan) {
        onError?.(new Error('Plan not found'))
        return
      }

      await openPurchaseDialog({
        namespace,
        provider: system.provider,
        providerId: system.providerId,
        environment: system.environment,
        priceId: plan.id,
        plan: plan,
        monthlyPlan: plan.isYearly ? plans.find((p) => p.plan === plan.plan && p.isMonthly) : undefined,
        onLoginSuccess: () => refreshPlans(),
      })
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error('Failed to open purchase dialog'))
    }
  }

  const handleUpgrade = async (id: string) => {
    try {
      // TODO: Implement upgrade logic
      console.log('upgrade to', id)
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error('Failed to upgrade plan'))
    }
  }

  return (
    <PricingBlock className="max-w-md w-full mx-auto" plans={plans} onClick={handleClick} onUpgrade={handleUpgrade} />
  )
}
