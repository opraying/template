import { lazy } from 'react'

export const Component = lazy(() => import('@shared/marketing/screen').then((_) => ({ default: _.Component })))
