import type { ReactNode } from 'react'
import { createContext, use, useState } from 'react'

export interface StepHandles {
  submit: () => Promise<void>
  validate?: () => Promise<boolean>
  reset?: () => void
}

export interface OnboardingStepProps {
  onNext: () => Promise<void>
  onBack?: () => void
}

export interface OnboardingStep {
  id: string
  title: string
  description: string
  icon?: string
  component: React.ComponentType<OnboardingStepProps>
}

export interface OnboardingTheme {
  primaryColor?: string
  backgroundColor?: string
  textColor?: string
  accentColor?: string
}

export interface OnboardingConfig {
  // for debug
  initialStep?: number
  steps: OnboardingStep[]
  theme?: OnboardingTheme
}

export interface OnboardingContextType {
  currentStep: number
  totalSteps: number
  goToNext: () => Promise<void>
  goToBack: () => void
  goToStep: (step: number) => void
  config: OnboardingConfig
  progress: number
  isLastStep: boolean
  isFirstStep: boolean
  canGoNext: boolean
  setCanGoNext: (can: boolean) => void
}

export interface OnboardingProviderProps {
  children: ReactNode
  config: OnboardingConfig
  onComplete: () => Promise<void> | void
}

const OnboardingContext = createContext<OnboardingContextType | null>(null)

export function OnboardingProvider({ children, config, onComplete }: OnboardingProviderProps) {
  const [currentStep, setCurrentStep] = useState(() => config.initialStep ?? 1)
  const [canGoNext, setCanGoNext] = useState(true)

  const goToNext = async () => {
    if (!canGoNext) return

    if (currentStep === config.steps.length) {
      await onComplete?.()
      return
    }

    setCurrentStep((prev) => prev + 1)
    setCanGoNext(true) // 重置状态，新步骤默认可以前进
  }

  const goToBack = () => setCurrentStep((prev) => Math.max(1, prev - 1))

  const goToStep = (step: number) => {
    if (step < currentStep) {
      return setCurrentStep(step)
    }
  }

  const value: OnboardingContextType = {
    currentStep,
    totalSteps: config.steps.length,
    goToNext,
    goToBack,
    goToStep,
    config,
    progress: (currentStep / config.steps.length) * 100,
    isLastStep: currentStep === config.steps.length,
    isFirstStep: currentStep === 1,
    canGoNext,
    setCanGoNext,
  }

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>
}

export const useOnboarding = () => {
  const context = use(OnboardingContext)
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider')
  }
  return context
}
