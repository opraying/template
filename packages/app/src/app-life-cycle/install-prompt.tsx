import { getAppLifecycleHook, type UserChoice } from '@xstack/app/app-life-cycle/life-cycle'
import { useAppInstallPrompt, useAppInstallPromptType } from '@xstack/app/app-life-cycle/provider'
import { PwaLogger } from '@xstack/app/pwa/logger'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import * as BrowserDetect from '@/lib/utils/browser'

const logger = new PwaLogger({
  enabled: () => false,
  prefix: '🔧 PWA [Install-Prompt]',
})

type Instructions = Record<'macOS' | 'iOS' | 'android' | 'linux' | 'windows', Array<InstructionStep>>

type InstructionStep = {
  index: string
  step: ReactNode
}

const benefits = {
  faster: {
    id: 'faster',
    text: 'Faster loading times',
    icon: 'i-lucide-zap',
  },
  offline: {
    id: 'offline',
    text: 'Works offline',
    icon: 'i-lucide-wifi-off',
  },
  native: {
    id: 'native',
    text: 'Native app-like experience',
    icon: 'i-lucide-smartphone',
  },
  quick: {
    id: 'quick',
    text: 'Quick access from home screen',
    icon: 'i-lucide-home',
  },
} as const

const instructions = {
  android: [
    { index: '1️⃣', step: 'Open this page in Chrome' },
    {
      index: '2️⃣',
      step: (
        <>
          Tap the menu icon <i className="i-lucide-more-vertical h-5 w-5" /> at the top right
        </>
      ),
    },
    {
      index: '3️⃣',
      step: (
        <>
          Select <span className="font-medium">Install app</span> or{' '}
          <span className="font-medium">Add to Home screen</span>
        </>
      ),
    },
  ],
  windows: [
    { index: '1️⃣', step: 'Open this page in Edge' },
    {
      index: '2️⃣',
      step: (
        <>
          Click the menu icon <i className="i-lucide-more-horizontal h-5 w-5" /> in the browser toolbar
        </>
      ),
    },
    {
      index: '3️⃣',
      step: (
        <>
          Click <span className="font-medium">Install {window?.location?.hostname ?? 'this app'}</span>
        </>
      ),
    },
  ],
  linux: [{ index: '1️⃣', step: 'Open this page in Chromium or Chrome' }],
  iOS: [
    { index: '1️⃣', step: 'Open this page in Safari' },
    {
      index: '2️⃣',
      step: (
        <>
          Click the Share button
          <i className="i-lucide-share h-5 w-5" />
          in the Safari toolbar, then choose
          <span className="inline-flex items-center">
            <i className="i-lucide-plus-square mr-2 h-5 w-5" />
            Add to home screen
          </span>
        </>
      ),
    },
    {
      index: '3️⃣',
      step: 'Type the name that you want to use for the web app, then click Add.',
    },
  ],
  macOS: [
    { index: '1️⃣', step: 'Open this page in Safari' },
    {
      index: '2️⃣',
      step: (
        <>
          From the menu bar, choose
          <span>File &gt; Add to Dock</span>. Or click the Share button
          <i className="i-lucide-share h-5 w-5" />
          in the Safari toolbar, then choose
          <span>Add to Dock</span>
        </>
      ),
    },
    {
      index: '3️⃣',
      step: (
        <>
          Type the name that you want to use for the web app, then click <span>Add</span>.
        </>
      ),
    },
  ],
} satisfies Instructions

function getInstructions() {
  logger.info('lifecycle', 'Determining installation instructions for current platform')

  if (BrowserDetect.isMacOS()) {
    logger.info('lifecycle', 'Platform detected: macOS')
    return instructions.macOS
  }

  if (BrowserDetect.isiOS()) {
    logger.info('lifecycle', 'Platform detected: iOS')
    return instructions.iOS
  }

  if (BrowserDetect.isAndroid()) {
    logger.info('lifecycle', 'Platform detected: Android')
    return instructions.android
  }

  if (BrowserDetect.isLinux()) {
    logger.info('lifecycle', 'Platform detected: Linux')
    return instructions.linux
  }

  if (BrowserDetect.isWindows()) {
    logger.info('lifecycle', 'Platform detected: Windows')
    return instructions.windows
  }

  logger.warn('lifecycle', 'Platform unknown - No installation instructions available')
  return []
}

export function InstallAppButton({ animate = false }: { animate?: boolean }) {
  const installPromptType = useAppInstallPromptType()
  const promptHandle = useAppInstallPrompt()
  const osInstructions = getInstructions()

  logger.info('lifecycle', 'InstallAppButton render', {
    installPromptType,
    hasPromptHandle: !!promptHandle,
    hasInstructions: osInstructions.length > 0,
    animate,
  })

  if (installPromptType === 'native') {
    logger.info('lifecycle', 'Showing native install button')
    return (
      <Button
        variant="default"
        className="truncate w-full sm:w-auto min-h-[44px] text-base font-medium"
        onClick={() => {
          logger.info('lifecycle', 'Native install button clicked')
          promptHandle()
            .then((result) => {
              logger.info('lifecycle', 'Native install prompt result', result)
            })
            .catch((error) => {
              logger.error('lifecycle', 'Native install prompt failed', error)
            })
        }}
      >
        <i className={cn('i-lucide-arrow-down-circle mr-2 h-5 w-5', animate && 'animate-bounce')} />
        Install App
      </Button>
    )
  }

  if (osInstructions.length === 0) {
    logger.info('lifecycle', 'No installation instructions available')
    return null
  }

  logger.info('lifecycle', 'Showing manual install instructions popover')
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="default"
          className="truncate w-full sm:w-auto min-h-[44px] text-base font-medium"
          onClick={() => {
            logger.info('lifecycle', 'Manual install instructions popover opened')
          }}
        >
          <i className={cn('i-lucide-arrow-down-circle mr-2 h-5 w-5', animate && 'animate-bounce')} />
          Install App
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[95vw] max-w-[400px] sm:w-[320px]" side="bottom">
        <div className="space-y-4">
          <div className="space-y-2">
            <h4 className="font-medium">Install Instructions</h4>
            <p className="text-sm text-muted-foreground">Follow these steps to install the app on your device:</p>
          </div>

          <div className="space-y-3">
            {osInstructions.map(({ index, step }) => (
              <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <span className="flex-shrink-0 font-medium text-lg">{index}</span>
                <span className="text-sm leading-relaxed">{step}</span>
              </div>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function InstallAppPrompt({ animate = false }: { animate?: boolean }) {
  logger.info('lifecycle', 'InstallAppPrompt render', { animate })

  return (
    <div className="pwa-hidden border rounded-lg p-4 sm:p-6 bg-card">
      <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
        <div className="space-y-4 flex-1">
          <div className="space-y-1.5">
            <h3 className="text-xl font-semibold">Install Our App</h3>
            <p className="text-muted-foreground text-sm">Get the best experience by installing our app</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.values(benefits).map((benefit) => (
              <div key={benefit.id} className="flex items-start gap-3 p-3 sm:p-2.5 rounded-lg bg-muted/50">
                <i className={cn(benefit.icon, 'h-5 w-5 text-primary mt-0.5 flex-shrink-0')} />
                <span className="text-sm font-medium leading-relaxed">{benefit.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex-shrink-0 w-full sm:w-auto">
          <InstallAppButton animate={animate} />
        </div>
      </div>
    </div>
  )
}

/**
 * This interface is experimental.
 *
 * https://developer.mozilla.org/en-US/docs/Web/API/BeforeInstallPromptEvent/BeforeInstallPromptEvent
 */
interface BeforeInstallPromptEvent extends Event {
  /**
   * Allows a developer to show the install prompt at a time of their own choosing.
   * This method returns a Promise.
   */
  prompt(): Promise<UserChoice>
}

export function install() {
  logger.group('lifecycle', 'PWA Install Prompt Handler Initialization')

  const appLifecycleHook = getAppLifecycleHook()

  if (!appLifecycleHook) {
    logger.error('lifecycle', 'App lifecycle hook not available')
    logger.groupEnd()
    return
  }

  logger.info('lifecycle', 'App lifecycle hook available, setting up install prompt handler')

  function saveInstallPrompt(event: Event) {
    logger.info('install', 'beforeinstallprompt event received', {
      type: event.type,
      timeStamp: event.timeStamp,
      isTrusted: event.isTrusted,
    })

    // Prevent the default mini-infobar from appearing
    event.preventDefault()
    logger.info('lifecycle', 'Default install prompt prevented')

    // Store the prompt for later use
    appLifecycleHook.state.installPromptType = 'native'
    appLifecycleHook.state.installPrompt = (event as BeforeInstallPromptEvent).prompt.bind(event)

    logger.info('lifecycle', 'Install prompt stored for later use')
    appLifecycleHook.onInstallPromptAvailable('native', appLifecycleHook.state.installPrompt)
  }

  // Check if beforeinstallprompt is supported
  if ('onbeforeinstallprompt' in window) {
    logger.info('lifecycle', 'beforeinstallprompt event supported - Adding event listener')
    window.addEventListener('beforeinstallprompt', saveInstallPrompt)

    // Also check if the event has already fired
    if ((window as any).beforeInstallPromptEvent) {
      logger.info('lifecycle', 'beforeinstallprompt event already fired, processing immediately')
      saveInstallPrompt((window as any).beforeInstallPromptEvent)
    }
  } else {
    logger.info('lifecycle', 'beforeinstallprompt event not supported, using popover instructions')
    appLifecycleHook.state.installPromptType = 'popover'
    appLifecycleHook.onInstallPromptAvailable('popover', appLifecycleHook.state.installPrompt)
  }

  // Monitor for installation via display mode change
  const standaloneMediaQuery = window.matchMedia('(display-mode: standalone)')
  const handleStandaloneChange = (e: MediaQueryListEvent) => {
    logger.info('Display mode changed', e.matches ? 'standalone' : 'browser')
    if (e.matches) {
      logger.info('lifecycle', 'PWA installation detected!')
    }
  }

  if (standaloneMediaQuery.addEventListener) {
    standaloneMediaQuery.addEventListener('change', handleStandaloneChange)
    logger.info('lifecycle', 'Listening for display mode changes')
  } else {
    // Fallback for older browsers
    standaloneMediaQuery.addListener(handleStandaloneChange)
    logger.info('lifecycle', 'Listening for display mode changes (legacy)')
  }

  logger.groupEnd()
}
