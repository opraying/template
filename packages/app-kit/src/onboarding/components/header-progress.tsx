import { StepIndicators } from '@xstack/app-kit/onboarding/components/step-indicators'
import type { OnboardingStep } from '@xstack/app-kit/onboarding/context'

interface HeaderProgressProps {
  currentStep: number
  steps: OnboardingStep[]
}

export function HeaderProgress({ currentStep, steps }: HeaderProgressProps) {
  return (
    <div className="h-14 flex flex-shrink-0 sticky top-0 items-center relative border-b gap-4 z-50 bg-background">
      <StepIndicators steps={steps} currentStep={currentStep} />
    </div>
  )
}
