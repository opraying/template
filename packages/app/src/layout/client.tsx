import { AppLifecycleProvider } from '@xstack/app/app-life-cycle/provider'
import { UpdateAvailableTips } from '@xstack/app/app-life-cycle/update-available'
import { MenuPortalProvider } from '@xstack/lib/components/menu'
import { NavigationProvider } from '@xstack/router'
import { ToasterProvider } from '@xstack/toaster'
import type { ReactNode } from 'react'
import { Toaster } from '@/components/ui/toaster'
import { useHydrated } from '@/lib/hooks/use-hydrated'
import { useLinkHandler } from '@/lib/hooks/use-router-link-handler'

function RootHooksHelper() {
  useLinkHandler()

  return null
}

export const Client = ({ children }: { children: ReactNode }) => {
  const hydrated = useHydrated()
  return (
    <>
      {hydrated && <Toaster />}
      <RootHooksHelper />
      <NavigationProvider>
        <ToasterProvider>
          <AppLifecycleProvider>
            {hydrated && <UpdateAvailableTips />}
            <MenuPortalProvider>{children}</MenuPortalProvider>
          </AppLifecycleProvider>
        </ToasterProvider>
      </NavigationProvider>
    </>
  )
}
