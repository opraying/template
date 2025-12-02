import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import NiceModal, { useModal } from '@ebay/nice-modal-react'
import { Plans } from '@xstack/app-kit/purchase/components/plans'
import { PricingFaq } from '@xstack/app-kit/purchase/components/pricing-faq'
import { FeatureComparison } from '@xstack/app-kit/purchase/components/feature-comparison'
import { useTranslation } from 'react-i18next'

const PricingDialog = NiceModal.create<{
  onError?: ((error: Error) => void) | undefined
  onSuccess?: (() => void | Promise<void>) | undefined
}>(({ onSuccess, onError }) => {
  const modal = useModal()
  const { t } = useTranslation()

  return (
    <Dialog
      open={modal.visible}
      onOpenChange={(opened) => {
        opened ? modal.show() : modal.hide()
      }}
    >
      <DialogContent
        className="max-w-4xl mx-auto @container"
        containerClassName="mb-0"
        aria-labelledby="pricing-dialog-title"
        aria-describedby="pricing-dialog-description"
      >
        <DialogHeader className="sr-only">
          <DialogTitle id="pricing-dialog-title">{t('pricing.display.title')}</DialogTitle>
          <DialogDescription id="pricing-dialog-description">{t('pricing.display.subtitle')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-y-fl-sm pt-6 md:pt-10">
          <div className="flex flex-col @3xl:flex-row gap-4">
            <div className="md:min-w-[450px] flex-1">
              <div className="flex flex-col justify-center items-center mb-6">
                <h2 className="text-2xl font-bold text-center">{t('pricing.display.title')}</h2>
                <p className="text-muted-foreground pt-2 text-center max-w-md">{t('pricing.display.subtitle')}</p>
              </div>
              <Plans onError={onError} onSuccess={onSuccess} />
            </div>
            <div className="flex-1 min-w-0">
              <FeatureComparison />
            </div>
          </div>
          <div className="max-w-4xl w-full mx-auto">
            <PricingFaq />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
})

export const openPricingDialog = ({
  onError,
  onSuccess,
}: {
  onError?: ((error: Error) => void) | undefined
  onSuccess?: (() => void | Promise<void>) | undefined
} = {}) => NiceModal.show(PricingDialog, { onSuccess, onError })

export const closePricingDialog = () => NiceModal.hide(PricingDialog)
