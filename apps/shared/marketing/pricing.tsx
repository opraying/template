import { pricingLoader } from '@server/loaders'
import { titleTemplate } from '@shared/config'
import { Page } from '@xstack/app/minimalism/marketing'
import { PricingPage } from '@xstack/app-kit/purchase/components/pricing-page'
import type { MetaFunction } from '@xstack/react-router/utils'
import { RouterDataErrorBoundary } from '@xstack/errors/react/error-boundary'

export const meta: MetaFunction = () => {
  return [{ title: titleTemplate('Pricing') }]
}

export { pricingLoader as loader }

export default function Component() {
  return (
    <Page>
      <PricingPage />
    </Page>
  )
}

export function ErrorBoundary() {
  return <RouterDataErrorBoundary />
}
