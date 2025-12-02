import { titleTemplate } from '@shared/config'
import content from '@shared/marketing/contents/privacy-policy.html?raw'
import { Page } from '@xstack/app/minimalism/marketing'
import type { MetaFunction } from '@xstack/react-router/utils'
import { ArticleContentLayout } from '@/lib/components/article-content-layout'
import { RouterDataErrorBoundary } from '@xstack/errors/react/error-boundary'

export const meta: MetaFunction = () => {
  return [
    {
      title: titleTemplate('Privacy Policy'),
    },
  ]
}

export default function Component() {
  const title = 'Privacy Policy'
  const lastUpdateDate = <span className="font-medium uppercase tracking-widest">Last updated 2021/10/20</span>

  return (
    <Page>
      <ArticleContentLayout title={title} description={lastUpdateDate}>
        <div dangerouslySetInnerHTML={{ __html: content }} suppressHydrationWarning />
      </ArticleContentLayout>
    </Page>
  )
}

export function ErrorBoundary() {
  return <RouterDataErrorBoundary />
}
