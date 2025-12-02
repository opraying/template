import { RouterDataErrorBoundary as ErrorBoundary } from '@xstack/errors/react/error-boundary'
import * as Screen from './screen.client'

export default import.meta.env.SSR ? () => null : Screen.Component

export { ErrorBoundary }
