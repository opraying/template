import { Button } from '@/components/ui/button'
import { useHydrated } from '@/lib/hooks/use-hydrated'
import { cn } from '@/lib/utils'
import { FreeVersionCard, SupportSection } from '@xstack/app-kit/purchase/components/feature-block'
import { FeatureComparison } from '@xstack/app-kit/purchase/components/feature-comparison'
import { usePlansLoader } from '@xstack/app-kit/purchase/components/loader'
import { PricingBlock } from '@xstack/app-kit/purchase/components/pricing-block'
import { PricingFaq } from '@xstack/app-kit/purchase/components/pricing-faq'
import { AppPlan } from '@xstack/app-kit/schema'
import * as Schema from 'effect/Schema'
import { m } from 'motion/react'
import { lazy } from 'react'
import { useTranslation } from 'react-i18next'
import { useRevalidator } from 'react-router'
import { FeatureBlock } from './feature-block'

const LazyInit = import.meta.env.SSR ? () => null : lazy(() => import('./init').then((_) => ({ default: _.PreInit })))

function HighlightItem({ icon, label }: { icon: string; label: string }) {
  return (
    <m.div
      whileHover={{ scale: 1.05 }}
      className="flex items-center gap-2 text-primary px-4 py-2 rounded-full bg-primary/5"
    >
      <i className={cn(icon, 'w-5 h-5')} />
      <span className="font-medium">{label}</span>
    </m.div>
  )
}

/**
 * 点击购买弹出窗口要求用户登录，登录采用新窗口的方式。
 * 如果是新建账号默认激活试用账号。
 * 登录完成页面显示出支付相关信息。
 */
export function PricingPage() {
  const hydrated = useHydrated()
  const { namespace, plans: plans_, system } = usePlansLoader()
  const { revalidate } = useRevalidator()
  const plans = Schema.decodeSync(Schema.Array(AppPlan))(plans_)

  if (plans.length === 0) {
    throw new Error('No plans available')
  }

  const handleClick = (id: string) => {
    if (!import.meta.env.SSR) {
      const plan = plans.find((p) => p.id === id)

      if (!plan) {
        throw new Error('Plan not found')
      }

      return import('./purchase-dialog')
        .then((purchase) =>
          purchase.openPurchaseDialog({
            namespace,
            provider: system.provider,
            providerId: system.providerId,
            environment: system.environment,
            priceId: id,
            plan,
            monthlyPlan: plan.isYearly ? plans.find((p) => p.plan === plan.plan && p.isMonthly) : undefined,
            onLoginSuccess: () => revalidate(),
          }),
        )
        .then(() => {})
    }

    return Promise.resolve()
  }

  const handleUpgrade = (id: string) => {
    if (!import.meta.env.SSR) {
      const plan = plans.find((p) => p.id === id)
      if (!plan) {
        throw new Error('Plan not found')
      }
    }
  }

  return (
    <div className="max-w-5xl mx-auto gap-y-fl-md-lg flex flex-col pb-6">
      {hydrated && <LazyInit />}
      <FeatureBlock />
      <div className="flex flex-col justify-around items-center gap-fl-md-2xl px-fl-xs-sm lg:flex-row">
        <div className="max-w-lg w-full mx-auto pt-2" id="pricing-block">
          <div className="pb-4 pl-3">
            <h3 className="text-xl font-bold">Choose Your Plan</h3>
            <p className="text-secondary-foreground pt-2">
              Select the perfect plan for your needs. Cancel at any time.
            </p>
          </div>
          <PricingBlock className="pt-2" plans={plans} onClick={handleClick} onUpgrade={handleUpgrade} />
        </div>
      </div>
      <div className="max-w-3xl mx-auto w-full">
        <FreeVersionCard />
      </div>
      <div className="max-w-2xl mx-auto w-full space-y-fl-md">
        <div className="md:px-6">
          <FeatureComparison />
        </div>
        <PricingFaq />
      </div>
      <div className="max-w-3xl mx-auto w-full">
        <SupportSection />
      </div>
    </div>
  )
}

export function PricingPreviewBlock({ plans: plans_ }: { plans: ReadonlyArray<AppPlan> }) {
  const { t } = useTranslation()
  const plans = Schema.decodeSync(Schema.Array(AppPlan))(plans_)

  if (plans.length === 0) {
    throw new Error('No plans available')
  }

  const highlights = [
    { icon: 'i-lucide-shield', label: '安全可靠' },
    { icon: 'i-lucide-sparkles', label: '简约高效' },
    { icon: 'i-lucide-heart', label: '用心服务' },
  ]

  return (
    <div className="flex flex-col gap-fl-sm">
      <div className="text-center space-y-fl-sm">
        <div>
          <h3 className="text-xl font-bold pb-1">{t('pricing.display.title')}</h3>
          <p>{t('pricing.display.subtitle')}</p>
        </div>
        <div className="flex justify-center gap-2">
          {highlights.map((item) => (
            <HighlightItem key={item.label} {...item} />
          ))}
        </div>
      </div>
      <div className="max-w-lg mx-auto w-full flex flex-col justify-around items-center gap-6 py-fl-sm">
        <PricingBlock className="py-2" plans={plans} preview />
        <m.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex flex-col items-center justify-center py-6"
        >
          <div className="pb-2 text-fl-xs">{t('pricing.display.footer.more')}</div>
          <Button asChild>
            <a href="/pricing" className="text-primary hover:underline transition-all">
              {t('pricing.display.footer.viewPricing')}
            </a>
          </Button>
        </m.div>
      </div>
    </div>
  )
}
