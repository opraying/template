import { type ChangelogLoader, changelogLoader } from '@server/loaders'
import { siteConfig, titleTemplate } from '@shared/config'
import { Changelogs } from '@xstack/app/minimalism/changelog'
import { Page } from '@xstack/app/minimalism/marketing'
import type { MetaFunction } from '@xstack/react-router/utils'
import { RouterDataErrorBoundary } from '@xstack/errors/react/error-boundary'

export { changelogLoader as loader }

export const meta: MetaFunction<ChangelogLoader> = () => {
  return [
    {
      title: titleTemplate('Changelog'),
    },
  ]
}

export default function Component() {
  const title = 'Changelog'
  const description = `New updates and improvements to ${siteConfig.name}.`

  return (
    <Page>
      <Changelogs title={title} description={description} />
    </Page>
  )
}

export function ErrorBoundary() {
  return <RouterDataErrorBoundary />
}
