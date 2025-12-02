import NiceModal from '@ebay/nice-modal-react'
import { useHydrated } from '@xstack/lib/hooks/use-hydrated'
import type * as React from 'react'
import { lazy, Suspense } from 'react'

const VisualEditing = import.meta.env.DEV
  ? lazy(() => import('@xstack/cms/visual-editing').then((_) => ({ default: _.VisualEditingDev })))
  : () => null

const MarketingRootClient_ = ({ children }: { children: React.ReactNode }) => {
  const hydrated = useHydrated()
  return (
    <NiceModal.Provider>
      {import.meta.env.DEV && hydrated && (
        <Suspense fallback={null}>
          <VisualEditing />
        </Suspense>
      )}
      {children}
    </NiceModal.Provider>
  )
}

export const MarketingRootClient = import.meta.env.SSR
  ? ({ children }: { children: React.ReactNode }) => children
  : MarketingRootClient_
