import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SpinFallback } from '@/components/ui/loading'
import NiceModal, { useModal } from '@ebay/nice-modal-react'
import { useMarketingUser } from '@xstack/app-kit/hooks'
import { PlanDetailPreview } from '@xstack/app-kit/purchase/components/pricing-block'
import { usePaymentCheckout, usePaymentLoadState } from '@xstack/app-kit/purchase/hooks'
import type { AppPlan } from '@xstack/app-kit/schema'
import { LoginForm } from '@xstack/user-kit/authentication/login'
import { m } from 'motion/react'
import { useTranslation } from 'react-i18next'

interface CheckoutProps {
  namespace: string
  provider: string
  providerId: string
  environment: 'sandbox' | 'production'
  priceId: string
  email: string
  userId: string
  plan: AppPlan
}

function Checkout({
  environment = 'sandbox',
  provider,
  providerId,
  priceId,
  email,
  userId,
  namespace,
  plan,
}: CheckoutProps) {
  const { t } = useTranslation()

  usePaymentCheckout({ namespace, environment, provider, providerId, priceId, email, userId })

  return (
    <div className="w-full @container">
      <div className="pb-3">
        <h3 className="text-xl font-bold">{t('pricing.display.subtitle')}</h3>
      </div>
      <m.div
        className="flex flex-col items-center @3xl:flex-row-reverse @3xl:items-start justify-center gap-4 mx-auto w-full"
        initial={{ opacity: 0, y: 80, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -80, scale: 0.9 }}
      >
        <div className="flex-shrink-0">
          <PlanDetailPreview data={plan} />
        </div>
        <div
          id="checkout-container"
          className="checkout-container w-full max-w-[450px] lg:min-h-[860px] flex-1"
          role="application"
          aria-label="Payment checkout form"
        />
      </m.div>
    </div>
  )
}

interface PurchaseDialogProps {
  provider: string
  providerId: string
  environment: 'sandbox' | 'production'
  priceId: string
  plan: AppPlan
  monthlyPlan: AppPlan | undefined
  namespace: string
  onLoginSuccess: () => void
}

const PurchaseDialog = NiceModal.create<PurchaseDialogProps>(
  ({ priceId, provider, providerId, environment, plan, monthlyPlan, namespace, onLoginSuccess }) => {
    const user = useMarketingUser()
    const modal = useModal()
    const loadState = usePaymentLoadState()

    const hasLogin = !!user
    const visibleLoading = hasLogin && loadState === 'loaded'

    return (
      <Dialog open={modal.visible} onOpenChange={(opened) => (opened ? modal.show() : modal.hide())}>
        <DialogContent className="max-w-5xl" containerClassName="mb-0">
          <DialogHeader>
            <DialogTitle className="text-fl-lg" />
            <DialogDescription />
          </DialogHeader>
          <div className="w-full lg:px-fl-sm gap-4 flex flex-col">
            <div className="flex flex-col gap-6 lg:flex-row lg:justify-between relative min-h-[400px]">
              {/* Loading Cover */}
              {hasLogin && loadState === 'loading' && (
                <div
                  className="absolute inset-0 flex items-center justify-center bg-background/90 backdrop-blur-sm z-50"
                  role="status"
                  aria-live="polite"
                  aria-label="Loading payment form"
                >
                  <SpinFallback className="size-12" />
                  <span className="sr-only">Loading payment form...</span>
                </div>
              )}
              {/* Content */}
              {hasLogin ? (
                <Checkout
                  namespace={namespace}
                  provider={provider}
                  environment={environment}
                  providerId={providerId}
                  priceId={priceId}
                  email={user.email}
                  userId={user.id}
                  plan={plan}
                />
              ) : (
                <div className="w-full">
                  <LoginForm titleVisible={false} portal onSuccess={onLoginSuccess} />
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  },
)

export const openPurchaseDialog = (props: PurchaseDialogProps) => NiceModal.show(PurchaseDialog, props)

export const closePurchaseDialog = () => NiceModal.hide(PurchaseDialog)
