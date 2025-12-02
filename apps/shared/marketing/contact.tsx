import { siteConfig, titleTemplate } from '@shared/config'
import { ContactPage } from '@xstack/app/minimalism/contact'
import { Page } from '@xstack/app/minimalism/marketing'
import type { MetaFunction } from '@xstack/react-router/utils'
import { RouterDataErrorBoundary } from '@xstack/errors/react/error-boundary'

export const meta: MetaFunction = () => {
  const title = siteConfig.description

  return [
    {
      title: titleTemplate(title),
    },
  ]
}

export default function Component() {
  return (
    <Page>
      <ContactPage />
    </Page>
  )
}

export { contactAction as action } from '@server/loaders'

export function ErrorBoundary() {
  return <RouterDataErrorBoundary />
}
