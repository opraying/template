import type { OnboardingStep } from '@xstack/app-kit/onboarding/context'
import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface StepIndicatorsProps {
  steps: OnboardingStep[]
  currentStep: number
}

export function StepIndicators({ steps, currentStep }: StepIndicatorsProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  // Update container width on resize
  useEffect(() => {
    if (!containerRef.current) return

    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth)
      }
    }

    // Initial measurement
    updateWidth()

    // Add resize listener
    const resizeObserver = new ResizeObserver(updateWidth)
    resizeObserver.observe(containerRef.current)

    return () => {
      if (containerRef.current) {
        resizeObserver.unobserve(containerRef.current)
      }
      resizeObserver.disconnect()
    }
  }, [])

  // Calculate step positions and states
  const stepsWithState = steps.map((step, index) => {
    const stepNumber = index + 1
    const isCompleted = stepNumber < currentStep
    const isCurrent = stepNumber === currentStep
    const isPending = stepNumber > currentStep

    // Calculate connector state (for the line before this step)
    const connectorActive = index > 0 && (isCompleted || (isCurrent && stepNumber < currentStep))

    return {
      ...step,
      stepNumber,
      isCompleted,
      isCurrent,
      isPending,
      connectorActive,
    }
  })

  // Calculate connector width based on container width and total steps
  const getConnectorWidth = useMemo(() => {
    const totalSteps = steps.length

    // Responsive width calculation based on container width
    if (containerWidth === 0) {
      return 16 // Default fallback
    }

    // Available space calculation (accounting for step indicators)
    const stepIndicatorsSpace = totalSteps * 24 // Approximate space for indicators
    const availableSpace = Math.max(0, containerWidth - stepIndicatorsSpace)

    // Distribute remaining space among connectors (totalSteps - 1 connectors)
    const connectorCount = Math.max(1, totalSteps - 1)
    const baseConnectorWidth = Math.min(40, Math.max(8, availableSpace / (connectorCount * 2)))

    return Math.floor(baseConnectorWidth)
  }, [containerWidth, steps.length])

  // Get indicator size based on step state
  const getIndicatorSize = (step: (typeof stepsWithState)[0]) => {
    if (step.isCurrent) return 24
    if (step.isCompleted) return 20
    return 16
  }

  return (
    <div
      ref={containerRef}
      className="flex items-center justify-center w-full flex-1"
      style={{ position: 'relative', zIndex: 10 }}
    >
      {stepsWithState.map((step, index) => (
        <div key={step.id} className="flex items-center">
          {index > 0 && (
            <div
              className={cn(
                'h-[2px] transition-all duration-300',
                step.connectorActive ? 'bg-primary' : 'bg-border/60',
              )}
              style={{
                width: `${getConnectorWidth}px`,
              }}
            />
          )}
          <button
            type="button"
            tabIndex={-1}
            className={cn(
              'group relative flex items-center justify-center',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 rounded-full',
            )}
            style={{
              transform: step.isCurrent ? 'scale(1.1)' : 'scale(1)',
              transition: 'transform 0.3s ease',
            }}
          >
            <div
              className={cn(
                'flex items-center justify-center rounded-full transition-all duration-300',
                step.isCurrent && 'bg-primary text-primary-foreground ring-4 ring-primary/20',
                step.isCompleted && !step.isCurrent && 'bg-primary/80 text-primary-foreground',
                step.isPending && 'bg-border/60',
              )}
              style={{
                width: `${getIndicatorSize(step)}px`,
                height: `${getIndicatorSize(step)}px`,
              }}
            >
              {step.isCompleted && !step.isCurrent && (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 13l4 4L19 7" />
                </svg>
              )}
              {step.isCurrent && <span className="text-xs font-medium">{step.stepNumber}</span>}
            </div>
          </button>
        </div>
      ))}
    </div>
  )
}
