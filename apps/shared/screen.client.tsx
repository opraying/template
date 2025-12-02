import { lazy } from 'react'

export const Component = lazy(() => import('@shared/screen').then((_) => ({ default: _.Component })))
