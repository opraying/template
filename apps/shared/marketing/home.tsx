import { homeLoader } from '@server/loaders'
import { siteConfig, titleTemplate } from '@shared/config'
import { Component } from '@shared/marketing/screen'
import type { MetaFunction } from '@xstack/react-router/utils'
import { RouterDataErrorBoundary } from '@xstack/errors/react/error-boundary'

export { homeLoader as loader }

export const meta: MetaFunction = () => {
  const title = siteConfig.description

  return [
    {
      title: titleTemplate(title),
    },
  ]
}

export default Component

export function ErrorBoundary() {
  return <RouterDataErrorBoundary />
}
