import { useHidePageLoading } from '@xstack/app/hooks/use-hide-page-loading'
import { Page } from '@xstack/app-kit/page'

export function Component() {
  useHidePageLoading()

  return (
    <Page>
      <h1>hello world</h1>
    </Page>
  )
}
