import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { AppPlan } from '@xstack/app-kit/schema'
import { formatMonthlyPrice, isPlanAvailable } from '../utils'

interface PlanPriceProps {
  plan: AppPlan
  currentPlan: AppPlan | null
  locale: string
  isSelected: boolean
}

export const PlanPrice = React.memo(function PlanPrice({ plan, currentPlan, locale, isSelected }: PlanPriceProps) {
  const { t } = useTranslation()
  const { price, billingCycle, isOneTime } = plan

  const canSubscribe = useMemo(() => isPlanAvailable(plan, currentPlan), [plan, currentPlan])
  const planName = useMemo(
    () => (plan.isYearly ? t('pricing.interval.yearly') : t('pricing.interval.monthly')),
    [plan.isYearly, t],
  )
  const formattedPrice = useMemo(
    () => formatMonthlyPrice(price.amount, price.currencyCode, locale, billingCycle?.interval),
    [price.amount, price.currencyCode, locale, billingCycle?.interval],
  )

  const getTextColor = useMemo(() => {
    const baseColor = !canSubscribe ? 'text-muted-foreground' : isSelected ? 'text-primary' : 'text-foreground'
    return (opacity?: string) => `${baseColor}${opacity || ''}`
  }, [canSubscribe, isSelected])

  return (
    <div className="flex-1">
      <div className="font-medium flex items-center flex-wrap gap-2">
        <span className={cn('uppercase font-bold', getTextColor())}>{planName}</span>
      </div>

      <div className="flex items-baseline gap-2 mt-1 flex-wrap">
        <span className={cn('text-2xl font-bold', getTextColor())} style={{ fontVariantNumeric: 'tabular-nums' }}>
          {formattedPrice}
        </span>
        <span className={cn('text-sm whitespace-nowrap', getTextColor('/80'))}>
          {isOneTime
            ? t('pricing.billing.period.perFiveYears')
            : plan.isYearly
              ? t('pricing.billing.period.monthlyYearly')
              : t('pricing.billing.period.perMonth')}
        </span>
      </div>

      <div className={cn('text-sm mt-1', getTextColor('/70'))}>
        {isOneTime ? t('pricing.billing.info.oneTimeAccess') : t('pricing.billing.info.cancelAnytime')}
      </div>
    </div>
  )
})
