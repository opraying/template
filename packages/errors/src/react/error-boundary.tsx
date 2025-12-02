import { useState, type ReactNode } from 'react'
import { ErrorBoundary as BaseErrorBoundary } from 'react-error-boundary'
import { useRouteError } from 'react-router'
import { decodeError } from '../decoder'
import { ErrorDisplay, ErrorFullPage, NotFound } from './errors'
import { type StandardError } from '../domains'
import { type RecoveryAction, clearCacheAndReloadAction, goToHomeAction, refreshPageAction } from '../recovery'

interface Props {
  error: any
  className?: string | undefined
  children?: ReactNode
}

function CopyButton({ content, className = '' }: { content: string | object; className?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    const textToCopy = typeof content === 'string' ? content : JSON.stringify(content, null, 2)
    navigator.clipboard?.writeText(textToCopy)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`flex items-center px-2 py-1 gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-background hover:bg-muted/30 rounded border transition-colors ${className}`}
    >
      <i className="i-lucide-copy h-3 w-3" />
      <span>{copied ? 'Copied!' : 'Copy'}</span>
    </button>
  )
}

function ServiceUnavailableErrorDisplay({ error }: { error: StandardError }) {
  const isOnline = navigator.onLine

  return (
    <div className="space-y-4">
      {/* Service unavailable message - Enhanced visibility */}
      <div className="bg-amber-50 rounded-lg p-3 border-l-4 border-amber-400/70 border">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center">
              <i className="i-lucide-cloud-off h-4 w-4 text-white" />
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-amber-900 mb-2">Service Temporarily Unavailable</h3>
            <p className="text-sm text-amber-800 leading-relaxed font-medium break-all">
              {error.message || 'Unable to load the requested content at this time.'}
            </p>
          </div>
        </div>
      </div>

      {/* Online status indicator */}
      <div
        className={`rounded-lg p-3 border ${isOnline ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}
      >
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}
            >
              <i className={`h-4 w-4 text-white ${isOnline ? 'i-lucide-wifi' : 'i-lucide-wifi-off'}`} />
            </div>
          </div>
          <div className="flex-1">
            <h3 className={`text-base font-semibold mb-1 ${isOnline ? 'text-green-900' : 'text-red-900'}`}>
              Network Status: {isOnline ? 'Online' : 'Offline'}
            </h3>
            <p className={`text-sm leading-relaxed ${isOnline ? 'text-green-800' : 'text-red-800'}`}>
              {isOnline
                ? 'Your device is connected to the internet. The service may be temporarily unavailable or under maintenance.'
                : 'Your device is offline. Please check your internet connection and try again.'}
            </p>
          </div>
        </div>
      </div>

      {/* Error recovery actions */}
      <ErrorActionsPanel />
    </div>
  )
}

function DetailError({ error }: { error: StandardError }) {
  // Check if this is a ServiceUnavailableError
  if ('_tag' in error && error._tag === 'ServiceUnavailableError') {
    return <ServiceUnavailableErrorDisplay error={error as StandardError} />
  }

  const sections = [
    {
      label: 'Error Stack',
      content: error.stack,
    },
    {
      label: 'Cause Stack',
      content: error.cause?.stack,
    },
    {
      label: 'Cause Message',
      content: error.cause?.message,
    },
  ].filter((section) => !!section.content)

  return (
    <div className="space-y-4">
      {/* Error message - Enhanced visibility */}
      <div className="bg-red-50 rounded-lg p-3 border-l-4 border-red-400/70 border">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
              <i className="i-lucide-alert-triangle h-4 w-4 text-white" />
            </div>
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-red-900 mb-2">What happened</h3>
            <p className="text-sm text-red-800 leading-relaxed font-medium break-all">
              {error.message || 'An unexpected issue occurred while processing your request.'}
            </p>
          </div>
        </div>
      </div>
      {/* Error recovery actions */}
      <ErrorActionsPanel />
      {/* Technical stack traces section */}
      {sections.length > 0 && (
        <details className="group mt-4 pt-4 border-t">
          <summary className="flex items-center justify-between cursor-pointer list-none">
            <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
              <i className="i-lucide-bug h-4 w-4 text-gray-500" />
              Debug Information
            </h4>
            <i className="i-lucide-chevron-right h-4 w-4 text-gray-400 transition-transform group-open:rotate-90" />
          </summary>
          <div className="mt-3 space-y-3">
            {sections.map((section, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-medium text-gray-600">{section.label}</h5>
                  <CopyButton content={section.content || ''} />
                </div>

                <div className="bg-gray-50 rounded p-3 max-h-40 overflow-auto border text-xs">
                  <pre className="text-gray-600 whitespace-pre-wrap font-mono leading-relaxed">{section.content}</pre>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

// Extended recovery action interface for UI display
interface UIRecoveryAction extends RecoveryAction {
  icon: string
  priority: 'primary' | 'secondary'
}

function ErrorActionsPanel() {
  // Create UI-enhanced versions of available actions with icons and conditions
  const availableActions: UIRecoveryAction[] = [
    {
      ...refreshPageAction,
      icon: 'i-lucide-refresh-cw',
      priority: 'primary' as const,
    },
    {
      ...clearCacheAndReloadAction,
      icon: 'i-lucide-trash-2',
      priority: 'secondary' as const,
    },
    {
      ...goToHomeAction,
      icon: 'i-lucide-home',
      priority: 'secondary' as const,
    },
  ]

  if (availableActions.length === 0) return null

  const primaryActions = availableActions.filter((action) => action.priority === 'primary')
  const secondaryActions = availableActions.filter((action) => action.priority === 'secondary')

  return (
    <div className="bg-green-50/50 rounded-lg border border-green-200/50 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 flex items-center justify-center bg-green-500 rounded-full">
            <i className="i-lucide-wrench h-4 w-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-green-900">Suggested Solutions</h3>
            <p className="text-xs text-green-700">These actions might help resolve the issue</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {primaryActions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => {
                try {
                  action.handler()
                } catch (error) {
                  console.error('Action handler failed:', error)
                }
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            >
              <i className={`${action.icon} h-4 w-4`} />
              <span>{action.label}</span>
            </button>
          ))}
          {secondaryActions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => {
                try {
                  action.handler()
                } catch (error) {
                  console.error('Action handler failed:', error)
                }
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-green-50 text-green-700 rounded-lg font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 border border-green-200"
            >
              <i className={`${action.icon} h-4 w-4`} />
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function ErrorFallback({ error, className }: Props) {
  const parsedError = decodeError(error)

  return (
    <ErrorDisplay error={parsedError} className={className}>
      <DetailError error={parsedError} />
    </ErrorDisplay>
  )
}

export function ErrorBoundary({ children, className }: { children: ReactNode; className?: string | undefined }) {
  return (
    <BaseErrorBoundary fallbackRender={(props) => <ErrorFallback className={className} error={props.error} />}>
      {children}
    </BaseErrorBoundary>
  )
}

export function ErrorFullPageFallback({ error, children }: Props) {
  // @ts-ignore
  if (error?.statusCode === 404) {
    return <NotFound />
  }

  const parsedError = decodeError(error)

  return (
    <ErrorFullPage error={parsedError}>
      <DetailError error={parsedError} />
      {children}
    </ErrorFullPage>
  )
}

export function RouterDataErrorBoundary({ fullPage }: { fullPage?: boolean | undefined }) {
  const error = useRouteError() as Props['error']

  if (!fullPage) {
    return <ErrorFallback error={error} />
  }

  return <ErrorFullPageFallback error={error} />
}
