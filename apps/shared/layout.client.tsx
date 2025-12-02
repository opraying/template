import { lazy } from 'react'

export const Component = lazy(() => import('@shared/layout').then((_) => ({ default: _.Component })))
