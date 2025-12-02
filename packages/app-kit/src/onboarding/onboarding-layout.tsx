import { HeaderProgress } from '@xstack/app-kit/onboarding/components/header-progress'
import { useOnboarding } from '@xstack/app-kit/onboarding/context'
import { AnimatePresence, m } from 'motion/react'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function OnboardingLayout({ className, ref }: { className?: string; ref?: React.RefObject<HTMLDivElement> }) {
  const { currentStep, totalSteps, goToNext, goToBack, canGoNext, isLastStep, progress, config } = useOnboarding()

  const currentStepConfig = config.steps[currentStep - 1]
  const currentStepId = currentStepConfig.id
  const Component = currentStepConfig.component

  useEffect(() => {
    if (ref?.current && currentStepId) {
      setTimeout(() => {
        ref.current.scrollTo({ top: 0 })
      }, 1000)
    }
  }, [currentStepId, ref])

  return (
    <div className={cn('flex flex-col', className)}>
      <HeaderProgress currentStep={currentStep} steps={config.steps} />
      <div className="w-full max-w-5xl mx-auto pt-fl-xs px-fl-sm-lg">
        <StepTransition id={currentStepId}>
          <Component onNext={goToNext} onBack={goToBack} />
        </StepTransition>
      </div>
      <footer className="fixed bottom-0.5 inset-x-0 px-fl-xs">
        <div className="flex items-center justify-between h-14 gap-fl-sm max-w-4xl mx-auto">
          <div>
            {currentStep > 1 && (
              <Button
                variant="ghost"
                size="lg"
                onClick={goToBack}
                className="text-muted-foreground hover:text-foreground"
              >
                <i className="i-lucide-arrow-left w-4 h-4 mr-2" />
                Back
              </Button>
            )}
          </div>
          <div className="hidden sm:flex absolute left-1/2 -translate-x-1/2 items-center gap-3">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={`step-line-${i + 1}`}
                className={cn(
                  'h-1 rounded-full',
                  i + 1 === currentStep
                    ? 'w-8 bg-primary'
                    : i + 1 < currentStep
                      ? 'w-6 bg-primary/40'
                      : 'w-6 bg-border/40',
                )}
              />
            ))}
          </div>
          <Button disabled={!canGoNext} onClick={goToNext} className={cn('min-w-[100px]')}>
            {isLastStep ? 'Complete' : 'Continue'}
            <i className={cn('w-4 h-4 ml-2', isLastStep ? 'i-lucide-check' : 'i-lucide-arrow-right')} />
          </Button>
        </div>
      </footer>
    </div>
  )
}

interface StepTransitionProps {
  children: React.ReactNode
  id: string
  duration?: number
}

function StepTransition({ children, id, duration = 0.3 }: StepTransitionProps) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <m.div
        key={id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration }}
      >
        {children}
      </m.div>
    </AnimatePresence>
  )
}
