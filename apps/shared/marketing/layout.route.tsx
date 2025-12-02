import * as MarketingLayoutServer from '@shared/marketing/layout'
import * as MarketingLayoutClient from '@shared/marketing/layout.client'
import { RouterDataErrorBoundary } from '@xstack/errors/react/error-boundary'

const Provider = import.meta.env.SSR ? MarketingLayoutServer.MarketingLayout : MarketingLayoutClient.MarketingLayout

export default Provider

export function ErrorBoundary() {
  return <RouterDataErrorBoundary />
}
