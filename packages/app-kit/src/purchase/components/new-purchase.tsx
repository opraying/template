import { FeatureBlock } from '@xstack/app-kit/purchase/components/feature-block'
import { PricingFaq } from '@xstack/app-kit/purchase/components/pricing-faq'
import { FeatureComparison } from '@xstack/app-kit/purchase/components/feature-comparison'
import { Plans } from '@xstack/app-kit/purchase/components/plans'
import { useNavigate } from '@xstack/router'
import { useTranslation } from 'react-i18next'

export function NewPurchase() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const onError = (error: Error) => {
    // TODO: handle the error
    console.error(error)
  }

  const onSuccess = () => {
    // [TODO] 后续的流程
    navigate.push('/')
  }

  return (
    <>
      <FeatureBlock />
      <div className="flex flex-col py-10 px-fl-2xs border rounded-3xl bg-card/40 gap-y-fl-sm">
        <div className="flex flex-col justify-center items-center">
          <h3 className="text-xl font-bold">{t('pricing.display.title')}</h3>
          <p className="text-secondary-foreground pt-2">{t('pricing.display.subtitle')}</p>
        </div>
        <Plans onError={onError} onSuccess={onSuccess} />
        <div className="px-fl-xs">
          <FeatureComparison />
        </div>
        <PricingFaq />
      </div>
    </>
  )
}
