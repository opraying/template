import { useHidePageLoading } from '@xstack/app/hooks/use-hide-page-loading'
import { Page } from '@xstack/app-kit/page'
import { Navigate, Route, Routes } from 'react-router'
import { NotFound } from '@xstack/errors/react/errors'
import { TestPrimitives } from '@/lib/test/primitives'
import { TestComponents } from './components'
import { TestSettings } from './settings'

export function Component() {
  useHidePageLoading()

  return (
    <Routes>
      <Route index element={<Navigate to="primitives" replace />} />
      <Route
        path="primitives"
        element={
          <Page header={null} className="container py-3">
            <TestPrimitives />
          </Page>
        }
      />
      <Route
        path="components"
        element={
          <Page header={null} className="container py-3">
            <TestComponents />
          </Page>
        }
      />
      <Route path="settings" element={<TestSettings />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
