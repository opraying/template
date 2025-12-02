import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { AppPlan } from '@xstack/app-kit/schema'
import { m } from 'motion/react'
import React, { useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { calculateYearlyDiscount, formatMonthlyPrice, formatYearlyPrice, isPlanAvailable, sortPlans } from '../utils'
import { PlanBadge } from './plan-badge'
import { PlanPrice } from './plan-price'

const MotionButton = m.create(Button as any)

interface FeatureItemProps {
  feature: readonly [string, string]
  index: number
}

const FeatureItem = React.memo(function FeatureItem({ feature, index }: FeatureItemProps) {
  return (
    <m.div
      initial={{ opacity: 0.2, x: -15 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 }}
      className="space-x-2 flex items-start"
    >
      <div className="border rounded-full flex items-center justify-center size-9 flex-shrink-0">
        <i className="i-lucide-gift size-4" aria-hidden="true" />
      </div>
      <div className="flex flex-col gap-1 min-w-0">
        <p className="text-secondary-foreground font-medium">{feature[0]}</p>
        {feature[1] && <p className="text-secondary-foreground text-sm">{feature[1]}</p>}
      </div>
    </m.div>
  )
})

interface PlanDetailPreviewProps {
  data: AppPlan
  index?: number
  locale?: string
  monthlyPlan?: AppPlan
}

export function PlanDetailPreview({ data, index = 0, locale = 'en-us', monthlyPlan }: PlanDetailPreviewProps) {
  const { t } = useTranslation()
  const { price, billingCycle, trialPeriod, isTrial, isOneTime, plan, isActive } = data

  const yearlyDiscount = monthlyPlan && data.isYearly ? calculateYearlyDiscount(data, monthlyPlan) : 0

  const trialText = trialPeriod
    ? t('pricing.subscription.period.trial.info', {
        days: trialPeriod.frequency,
        interval: t(`pricing.interval.${trialPeriod.interval}`),
      })
    : ''

  return (
    <div className={'group p-fl-sm w-full max-w-[380px]'}>
      <div className="flex items-center justify-between relative">
        <div className="border rounded-full flex items-center justify-center size-10 shadow">
          <i className="i-lucide-zap size-5" />
        </div>
        {/* 只在非激活状态下显示 badges */}
        {!isActive && (
          <>
            {
              <m.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                className="bg-green-500/80 border border-green-500 text-white px-3 py-1 rounded-full text-sm font-medium"
              >
                {t('pricing.billing.info.yearlyDiscount', {
                  percent: yearlyDiscount,
                })}
              </m.div>
            }
            {isTrial && trialPeriod && (
              <m.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                className="bg-blue-500/80 border border-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium"
              >
                {trialText}
              </m.div>
            )}
          </>
        )}
      </div>

      <m.div className="flex flex-col py-fl-xs">
        <div className="flex items-center">
          <m.span
            key={price.amount}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08 }}
            style={{ fontVariantNumeric: 'tabular-nums' }}
            className={cn('leading-0 text-3xl font-bold inline-block')}
          >
            {formatMonthlyPrice(price.amount, price.currencyCode, locale, billingCycle?.interval)}
          </m.span>
          <span className={cn('text-sm font-bold relative left-2 bottom-0')}>
            {isOneTime
              ? t('pricing.billing.period.perFiveYears')
              : data.isYearly
                ? t('pricing.billing.period.monthlyYearly')
                : t('pricing.billing.period.perMonth')}
          </span>
        </div>
        <m.div className={cn('text-fl-sm pt-1 mt-1')}>
          {isOneTime
            ? t('pricing.billing.info.oneTimeAccess')
            : data.isYearly
              ? t('pricing.billing.info.yearlyBilling', {
                  price: formatYearlyPrice(price.amount, price.currencyCode, locale),
                })
              : t('pricing.billing.info.monthlyBilling')}
        </m.div>
      </m.div>
      <div className="flex flex-col gap-3 min-h-[200px] pt-fl-sm border-t">
        {Array.from({ length: 3 }).map((_, index) => (
          <FeatureItem
            key={`${data.id}-${index}`}
            index={index}
            feature={[
              t(`pricing.features.${data.billingCycle?.interval === 'year' ? 'yearly' : 'monthly'}.${index + 1}.title`),
              t(
                `pricing.features.${data.billingCycle?.interval === 'year' ? 'yearly' : 'monthly'}.${index + 1}.description`,
              ),
            ]}
          />
        ))}
      </div>
    </div>
  )
}

function PriceOption({
  plan,
  isSelected,
  onClick,
  locale = 'en-us',
  currentPlan,
  preview = false,
  monthlyPlan,
}: {
  plan: AppPlan
  isSelected: boolean
  onClick: () => void
  locale?: string
  currentPlan: AppPlan | null
  preview?: boolean
  monthlyPlan?: AppPlan | undefined
}) {
  const { t } = useTranslation()
  const { isActive } = plan
  const canSubscribe = isPlanAvailable(plan, currentPlan)

  const handleClick = () => {
    if (preview) {
      onClick()
      return
    }
    if (!canSubscribe) return
    if (isSelected && !currentPlan) return
    onClick()
  }

  const getStatusText = () => {
    if (isActive) return t('pricing.subscription.status.active')
    if (!canSubscribe) return t('pricing.subscription.status.cannotDowngrade')
    return ''
  }

  return (
    <div
      className={cn(
        'relative border-2 rounded-lg transition-all select-none px-fl-xs py-fl-2xs',
        isSelected
          ? 'border-2 border-primary shadow-md bg-primary/5 cursor-pointer'
          : 'border-muted cursor-pointer hover:border-primary',
      )}
      onClick={handleClick}
      title={!canSubscribe ? getStatusText() : undefined}
    >
      {isSelected && (preview || canSubscribe) && !isActive && (
        <m.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={!preview && currentPlan ? { scale: 1.1 } : {}}
          className={cn(
            'absolute -top-2.5 -right-2.5 size-5 rounded-full bg-primary flex items-center justify-center shadow-sm z-10',
            !preview && currentPlan ? 'group cursor-pointer' : 'cursor-default',
          )}
          title={!preview && currentPlan ? t('pricing.subscription.actions.unselect') : undefined}
        >
          <i
            className={cn(
              'size-3 text-primary-foreground transition-all',
              !preview && currentPlan ? 'i-lucide-check group-hover:i-lucide-x' : 'i-lucide-check',
            )}
          />
        </m.div>
      )}

      <div className="flex items-center justify-between relative gap-4">
        <div className="flex items-center gap-4">
          <PlanPrice plan={plan} currentPlan={currentPlan} locale={locale} isSelected={isSelected} />
        </div>
        <PlanBadge plan={plan} currentPlan={currentPlan} monthlyPlan={monthlyPlan} />
      </div>

      {!canSubscribe && !isActive && !preview && (
        <m.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg"
        >
          <div
            className="text-sm text-muted-foreground px-4 py-2 bg-muted/30 rounded-full max-w-[90%] text-center"
            role="tooltip"
          >
            {getStatusText()}
          </div>
        </m.div>
      )}
    </div>
  )
}

interface PricingBlockProps {
  plans: ReadonlyArray<AppPlan>
  onClick?: ((id: string, index: number) => Promise<void> | void) | undefined
  onUpgrade?: (id: string) => Promise<void> | void
  locale?: string | undefined
  preview?: boolean | undefined
  className?: string | undefined
}

export const PricingBlock = React.forwardRef<HTMLDivElement, PricingBlockProps>(function PricingBlock(
  { plans, onClick, onUpgrade, locale = 'en-us', preview = false, className },
  ref,
) {
  const { t } = useTranslation()

  const currentPlan = useMemo(() => plans.find((p) => p.isActive) || null, [plans])
  const sortedPlans = useMemo(() => sortPlans(plans), [plans])

  const [selectedPlanId, setSelectedPlanId] = useState<string>(() => {
    if (currentPlan) {
      const availablePlan = sortedPlans.find((plan) => isPlanAvailable(plan, currentPlan))
      return availablePlan?.id || ''
    }
    return sortedPlans[0]?.id || ''
  })

  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId && isPlanAvailable(plan, currentPlan)) || null

  const handlePlanSelect = (plan: AppPlan, index: number) => {
    if (preview) {
      onClick?.(plan.id, index)
      setSelectedPlanId(plan.id)
      return
    }

    if (!isPlanAvailable(plan, currentPlan)) return
    if (plan.id === selectedPlanId && !currentPlan) return

    if (plan.id === selectedPlanId && currentPlan) {
      setSelectedPlanId('')
    } else {
      setSelectedPlanId(plan.id)
    }
  }

  const getButtonText = () => {
    if (!selectedPlan) return ''
    if (selectedPlan.isOneTime) return t('pricing.subscription.actions.purchase')
    if (selectedPlan.isTrial) return t('pricing.subscription.actions.trial')
    if (currentPlan && selectedPlan.plan === currentPlan.plan) {
      return t('pricing.subscription.actions.upgradeToYearly')
    }
    return currentPlan ? t('pricing.subscription.actions.upgrade') : t('pricing.subscription.actions.subscribe')
  }

  const handleActionClick = useCallback(async () => {
    if (!selectedPlan) return
    if (currentPlan) {
      await onUpgrade?.(selectedPlan.id)
    } else {
      const planIndex = sortedPlans.findIndex((p) => p.id === selectedPlan.id)
      await onClick?.(selectedPlan.id, planIndex)
    }
  }, [selectedPlan, currentPlan, onUpgrade, onClick, sortedPlans])

  return (
    <div className={cn('w-full flex flex-col gap-3 px-6 py-6', className)} ref={ref} id="pricing-block">
      <div className="flex flex-col gap-3">
        {sortedPlans.map((plan, index) => {
          const monthlyPlan = plan.isYearly ? plans.find((p) => p.plan === plan.plan && p.isMonthly) : undefined
          return (
            <PriceOption
              key={plan.id}
              plan={plan}
              isSelected={plan.id === selectedPlanId}
              onClick={() => handlePlanSelect(plan, index)}
              locale={locale}
              currentPlan={currentPlan}
              preview={preview}
              monthlyPlan={monthlyPlan}
            />
          )
        })}
        {!preview && (
          <div className="pt-4 min-h-[110px]">
            {selectedPlan && (
              <>
                <MotionButton
                  whileHover={{
                    scale: 1.02,
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                  }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleActionClick}
                  className="w-full py-6 text-lg font-semibold"
                  variant="default"
                  disabled={selectedPlan.isActive}
                >
                  <m.span>{getButtonText()}</m.span>
                </MotionButton>
                <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground mt-5">
                  <div className="flex items-center justify-center gap-2">
                    <span>{t('pricing.display.payments.securedWith', { provider: 'Paddle' })}</span>
                  </div>
                  {currentPlan && selectedPlan && (
                    <m.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center text-xs text-primary/80"
                    >
                      {t('pricing.subscription.upgrade.refundInfo')}
                    </m.div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
})

// Re-export components from feature-block for backward compatibility
export { ProVersionCard, SupportSection } from './feature-block'
