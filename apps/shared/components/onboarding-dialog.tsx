import { useSetAppStatusEnable } from '@xstack/app/hooks/use-app-utils'
import type { OnboardingConfig } from '@xstack/app-kit/onboarding/context'
import { OnboardingProvider } from '@xstack/app-kit/onboarding/context'
import { OnboardingLayout } from '@xstack/app-kit/onboarding/onboarding-layout'
import { FeatureIntroStep } from '@xstack/app-kit/onboarding/steps/feature-intro'
import { ProfileSetup } from '@xstack/app-kit/onboarding/steps/profile-setup'
import { Welcome } from '@xstack/app-kit/onboarding/steps/welcome'
import * as Dialog from '@xstack/lib/components/dialog'
import { useNavigate } from '@xstack/router'

const config: OnboardingConfig = {
  steps: [
    {
      id: 'profile-setup',
      title: '个性化配置',
      description: '定制您的使用体验',
      icon: 'i-lucide-user-cog',
      component: ProfileSetup,
    },
    {
      id: 'feature-intro',
      title: '功能介绍',
      description: '了解产品的核心功能',
      icon: 'i-lucide-sparkles',
      component: FeatureIntroStep,
    },
    {
      id: 'welcome',
      title: '开始使用',
      description: '一切准备就绪',
      icon: 'i-lucide-party-popper',
      component: Welcome,
    },
  ],
  theme: {
    primaryColor: 'var(--primary)',
    backgroundColor: 'var(--background)',
    textColor: 'var(--foreground)',
    accentColor: 'var(--primary)',
  },
}

export const OnboardingDialog = Dialog.alertDialog(
  () => {
    const setAppEnable = useSetAppStatusEnable()
    const navigate = useNavigate()

    const handleComplete = () => {
      setAppEnable()
      navigate.replace('/')
    }

    return (
      <OnboardingProvider config={config} onComplete={handleComplete}>
        <OnboardingLayout />
      </OnboardingProvider>
    )
  },
  {
    closeOnEscapeKeyDown: false,
    title: null,
    footer: null,
    styles: {
      contentClassName: 'max-w-5xl h-[95%] lg:h-[970px]',
      contentContainerClassName: 'p-0 max-h-[calc(100%-45px)] h-full',
    },
  },
)
