import { lazy } from 'react'

export const Component = lazy(() => import('./screen').then((_) => ({ default: _.Component })))
