import { cn } from '@/lib/utils'
import { COMPONENT_CLASSES } from './constants'

export interface LoadingSkeletonProps {
  /** Number of skeleton lines to show */
  lines?: number | undefined
  /** Whether to show a circular avatar skeleton */
  showAvatar?: boolean | undefined
  /** Additional CSS classes */
  className?: string | undefined
  /** Custom height for skeleton lines */
  lineHeight?: 'sm' | 'md' | 'lg'
}

/**
 * Reusable skeleton loading component for consistent loading states
 */
export function LoadingSkeleton({ lines = 3, showAvatar = false, className, lineHeight = 'md' }: LoadingSkeletonProps) {
  const heightClasses = {
    sm: 'h-3',
    md: 'h-4',
    lg: 'h-5',
  }

  return (
    <div className={cn('animate-pulse space-y-3', className)} role="status" aria-label="Loading content">
      {showAvatar && (
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-muted/40 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className={cn('bg-muted/40 rounded w-1/3', heightClasses[lineHeight])} />
            <div className={cn('bg-muted/30 rounded w-1/4', heightClasses[lineHeight])} />
          </div>
        </div>
      )}

      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className={cn(
              'bg-muted/40 rounded animate-pulse',
              heightClasses[lineHeight],
              // Vary the width for a more natural look
              index === 0 && 'w-full',
              index === 1 && 'w-4/5',
              index === 2 && 'w-3/5',
              index > 2 && 'w-2/3',
            )}
          />
        ))}
      </div>
    </div>
  )
}

export interface MobileLayoutLoadingProps {
  /** Whether to show header skeleton */
  showHeader?: boolean | undefined
  /** Additional CSS classes */
  className?: string | undefined
}

/**
 * Loading state specifically designed for mobile layout components
 */
export function MobileLayoutLoading({ showHeader = true, className }: MobileLayoutLoadingProps) {
  return (
    <div className={cn('flex flex-col h-screen bg-background', className)}>
      {showHeader && (
        <div className={cn(COMPONENT_CLASSES.stickyHeader, 'px-4 py-3')}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-muted/40 rounded-full animate-pulse" />
            <div className="flex-1 space-y-1">
              <div className="h-6 bg-muted/40 rounded animate-pulse w-1/3" />
              <div className="h-4 bg-muted/30 rounded animate-pulse w-1/2" />
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 px-4 py-6 space-y-4">
        <LoadingSkeleton lines={5} showAvatar={false} />
        <div className="space-y-3">
          <div className="h-20 bg-muted/20 rounded-lg animate-pulse" />
          <div className="h-16 bg-muted/20 rounded-lg animate-pulse" />
          <div className="h-24 bg-muted/20 rounded-lg animate-pulse" />
        </div>
      </div>
    </div>
  )
}

export interface SettingsLoadingProps {
  /** Type of settings loading to show */
  variant?: 'list' | 'detail' | undefined
  /** Additional CSS classes */
  className?: string | undefined
}

/**
 * Loading state specifically for settings components
 */
export function SettingsLoading({ variant = 'list', className }: SettingsLoadingProps) {
  if (variant === 'detail') {
    return <MobileLayoutLoading className={className} />
  }

  return (
    <div className={cn('flex flex-col bg-background min-h-screen', className)}>
      {/* Header skeleton */}
      <div className={cn(COMPONENT_CLASSES.stickyHeader, 'px-4 py-3')}>
        <div className="h-7 bg-muted/40 rounded animate-pulse w-24" />
      </div>

      {/* Settings list skeleton */}
      <div className="flex-1 space-y-8 px-4 py-6">
        {Array.from({ length: 3 }).map((_, groupIndex) => (
          <div key={groupIndex} className="space-y-4">
            {/* Group title */}
            <div className="px-4 py-3 bg-muted/20">
              <div className="h-4 bg-muted/40 rounded animate-pulse w-20" />
            </div>

            {/* Group items */}
            <div className={COMPONENT_CLASSES.card}>
              {Array.from({ length: Math.floor(Math.random() * 4) + 2 }).map((_, itemIndex) => (
                <div
                  key={itemIndex}
                  className={cn('px-4 py-4 flex items-center gap-3', itemIndex > 0 && 'border-t border-border/20')}
                >
                  <div className="w-8 h-8 bg-muted/40 rounded-lg animate-pulse" />
                  <div className="flex-1 space-y-1">
                    <div className="h-4 bg-muted/40 rounded animate-pulse w-2/3" />
                    <div className="h-3 bg-muted/30 rounded animate-pulse w-1/2" />
                  </div>
                  <div className="w-5 h-5 bg-muted/30 rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Generic loading spinner component
 */
export function LoadingSpinner({
  size = 'md',
  className,
}: {
  size?: 'sm' | 'md' | 'lg' | undefined
  className?: string | undefined
}) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  }

  return (
    <div
      className={cn(
        'animate-spin rounded-full border-2 border-muted-foreground/20 border-t-foreground',
        sizeClasses[size],
        className,
      )}
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading...</span>
    </div>
  )
}
