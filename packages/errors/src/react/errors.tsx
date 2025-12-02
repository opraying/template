import type { ReactNode } from 'react'
import { useLocation } from 'react-router'
import { cn } from '@/lib/utils'
import type { StandardError } from '@xstack/errors/domains'

interface Props {
  children?: ReactNode
  error: StandardError
  className?: string | undefined
}

export function ErrorDisplay({ error, children, className }: Props) {
  return (
    <div className="max-w-full md:max-w-4xl mx-auto overflow-hidden p-4">
      <div className={cn('pb-4 my-4 bg-card rounded-lg shadow-sm border', className)}>
        {/* Header */}
        <div className="px-6 py-5 bg-blue-50/50 border-b border-blue-100/50">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 flex items-center justify-center bg-blue-500 rounded-full">
                <i className="i-lucide-info h-5 w-5 text-white" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                  <i className="i-lucide-alert-circle h-3 w-3" />
                  Something needs attention
                </span>
              </div>
              <h1 className="text-lg font-medium text-gray-900 leading-tight mb-1">We encountered an issue</h1>
              <p className="text-sm text-gray-600 leading-relaxed">
                Don't worry - this is temporary. We've been notified and are working on it. Please try one of the
                suggestions below.
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        {children && <div className="px-6 pt-4">{children}</div>}
      </div>
    </div>
  )
}

export function ErrorFullPage({ error, children }: Props) {
  return (
    <div className="min-h-dvh w-full bg-background">
      <div className="flex items-center justify-center min-h-dvh p-4">
        <div className="w-full max-w-2xl">
          <ErrorDisplay error={error}>{children}</ErrorDisplay>
        </div>
      </div>
    </div>
  )
}

export function NotFound() {
  const location = useLocation()

  return (
    <div className="min-h-dvh bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        <div className="bg-card rounded border overflow-hidden">
          {/* Header */}
          <div className="px-4 py-4 bg-blue-50 border-b border-blue-200">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 flex items-center justify-center bg-blue-500 rounded">
                  <i className="i-lucide-search-x h-4 w-4 text-white" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium border border-blue-200">
                    <i className="i-lucide-file-x h-3 w-3" />
                    404 Not Found
                  </span>
                </div>
                <h1 className="text-base font-semibold text-blue-900 leading-tight mb-1">Page not found</h1>
                <p className="text-sm text-blue-700">The page you're looking for doesn't exist or has been moved.</p>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-4 py-4">
            <div className="space-y-3">
              <div className="bg-gray-50 rounded p-2 border">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-gray-600">Requested URL:</span>
                </div>
                <code className="text-xs font-mono text-gray-800 break-all">{location.pathname}</code>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-2">
                <a
                  href="/"
                  data-replace
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <i className="i-lucide-home h-3 w-3" />
                  <span>Go Home</span>
                </a>
                <button
                  type="button"
                  onClick={() => window.history.back()}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-background hover:bg-muted/50 text-foreground rounded font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring border"
                >
                  <i className="i-lucide-arrow-left h-3 w-3" />
                  <span>Go Back</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
