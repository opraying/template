import { appRoutes } from '@shared/config'
import * as RootClientProvider from '@xstack/app/layout/root-client'

export const RootProvider = RootClientProvider.make({
  appRoutes,
  debug: [],
})
