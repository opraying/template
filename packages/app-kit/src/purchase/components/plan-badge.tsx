import React, { useMemo } from 'react'
import { m } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { AppPlan } from '@xstack/app-kit/schema'
import { calculateYearlyDiscount, isPlanAvailable } from '../utils'

interface PlanBadgeProps {
  plan: AppPlan
  currentPlan: AppPlan | null
  monthlyPlan?: AppPlan | undefined
}

export const PlanBadge = React.memo(function PlanBadge({ plan, currentPlan, monthlyPlan }: PlanBadgeProps) {
  const { t } = useTranslation()
  const { trialPeriod, isTrial, isActive } = plan

  const yearlyDiscount = useMemo(
    () => (monthlyPlan && plan.isYearly ? calculateYearlyDiscount(plan, monthlyPlan) : 0),
    [monthlyPlan, plan],
  )

  const trialText = useMemo(
    () =>
      trialPeriod
        ? t('pricing.subscription.period.trial.info', {
            days: trialPeriod.frequency,
            interval: t(`pricing.interval.${trialPeriod.interval}`),
          })
        : '',
    [trialPeriod, t],
  )

  const badgeInfo = useMemo(() => {
    if (isActive) {
      return {
        text: t('pricing.subscription.status.active'),
        className: 'bg-green-500 text-white',
        icon: null,
      }
    }

    if (plan.isYearly && yearlyDiscount > 0) {
      return {
        text: t('pricing.billing.info.yearlyDiscount', { percent: yearlyDiscount }),
        className: 'bg-green-500 text-white',
        icon: 'i-lucide-arrow-up',
      }
    }

    if (isTrial && trialPeriod) {
      return {
        text: trialText,
        className: 'bg-blue-500 text-white',
        icon: 'i-lucide-zap',
      }
    }

    if (!isPlanAvailable(plan, currentPlan)) {
      return {
        text: t('pricing.subscription.status.cannotDowngrade'),
        className: 'bg-muted text-muted-foreground',
        icon: null,
      }
    }

    return null
  }, [isActive, plan.isYearly, yearlyDiscount, t, isTrial, trialPeriod, trialText, currentPlan])

  if (!badgeInfo) return null

  return (
    <m.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn('px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1', badgeInfo.className)}
    >
      {badgeInfo.icon && <m.i initial={{ scale: 0 }} animate={{ scale: 1 }} className={cn(badgeInfo.icon, 'size-4')} />}
      {badgeInfo.text}
    </m.div>
  )
})
