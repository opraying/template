import * as prompt from '@xstack/app/app-life-cycle/install-prompt'
import * as lifeCycle from '@xstack/app/app-life-cycle/life-cycle'
import { PwaLogger } from '@xstack/app/pwa/logger'
import type { Workbox, WorkboxLifecycleWaitingEvent } from 'workbox-window'

export const installPwa = () => {
  const logger = new PwaLogger({
    enabled: () => false,
    prefix: '🔧 PWA [Install]',
  })

  // PWA requirements check
  const checkPwaRequirements = () => {
    const env = detectEnvironment()
    const manifestLink = document.querySelector('link[rel="manifest"]') as HTMLLinkElement

    const requirements = {
      isHttps: env.isHttps,
      hasManifest: !!manifestLink,
      hasServiceWorker: env.hasServiceWorker,
      isInstalled: env.isStandalone,
      manifestUrl: manifestLink?.href,
    }

    logger.table('Requirements', 'PWA Requirements Check', requirements)

    return requirements
  }

  // Environment detection utilities
  const detectEnvironment = () => {
    const userAgent = navigator.userAgent
    const platform = navigator.platform
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    const isInApp = document.body.classList.contains('in-app')

    return {
      userAgent,
      platform,
      isStandalone,
      isInApp,
      hasServiceWorker: 'serviceWorker' in navigator,
      hasBeforeInstallPrompt: 'onbeforeinstallprompt' in window,
      hasAppBanner: 'onappinstalled' in window,
      displayMode: isStandalone ? 'standalone' : 'browser',
      orientation: window.matchMedia('(orientation: portrait)').matches ? 'portrait' : 'landscape',
      screenSize: `${window.screen.width}x${window.screen.height}`,
      viewportSize: `${window.innerWidth}x${window.innerHeight}`,
      devicePixelRatio: window.devicePixelRatio,
      colorScheme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
      isHttps: location.protocol === 'https:' || location.hostname === 'localhost',
    }
  }

  logger.group('Install', 'PWA Installation Initialization')

  // Detect environment and check requirements
  const environment = detectEnvironment()
  const requirements = checkPwaRequirements()

  logger.info('Install', 'Requirements', requirements)

  logger.info('Install', 'Environment detected', {
    platform: environment.platform,
    displayMode: environment.displayMode,
    hasServiceWorker: environment.hasServiceWorker,
    hasBeforeInstallPrompt: environment.hasBeforeInstallPrompt,
  })

  logger.info('register', 'Initializing PWA lifecycle and prompt handlers')

  lifeCycle.install()

  prompt.install()

  logger.groupEnd()

  // Only proceed with service worker registration in production
  //@ts-ignore
  if (process.env.NODE_ENV === 'production') {
    logger.group('register', 'Service Worker Registration (Production)')

    let wb: Workbox | undefined
    const filename = '/sw.js'
    const scope = '/'
    const type = 'classic'
    const immediate = true

    let registerPromise: Promise<void> = Promise.resolve()
    let sendSkipWaitingMessage: () => void

    // check for updates every hour
    const intervalMS = 60 * 60 * 1000

    logger.info('register', 'Configuration', {
      filename,
      scope,
      type,
      immediate,
      updateInterval: `${intervalMS / 1000 / 60}min`,
    })

    const updateServiceWorker = async () => {
      logger.info('register', 'Updating service worker')
      await registerPromise
      logger.info('register', 'Sending skip waiting message')
      sendSkipWaitingMessage?.()
    }

    const onRegisteredSW = (_filename: string, r: ServiceWorkerRegistration) => {
      if (!r) {
        logger.error('register', 'Registration is null')
        return
      }

      logger.info('register', 'Registered successfully', {
        scope: r.scope,
        active: !!r.active,
        installing: !!r.installing,
        waiting: !!r.waiting,
        updateViaCache: r.updateViaCache,
      })

      const appLifecycleHook = lifeCycle.getAppLifecycleHook()
      appLifecycleHook.reload = () => {
        logger.info('lifecyrcle', 'Reload triggered')
        appLifecycleHook.state.updateAvailable = false
        appLifecycleHook.onUpdateAvailable(false)
        return updateServiceWorker()
      }

      logger.info('register', `Setting up update check (every ${intervalMS / 1000 / 60}min)`)

      setInterval(async () => {
        if (!(!r.installing && navigator)) {
          logger.debug('register', 'Skipping update check: service worker installing or navigator unavailable')
          return
        }

        if ('connection' in navigator && !navigator.onLine) {
          logger.debug('register', 'Skipping update check: device offline')
          return
        }

        try {
          logger.debug('register', 'Checking for updates')

          const resp = await fetch(filename, {
            cache: 'no-store',
            headers: {
              cache: 'no-store',
              'cache-control': 'no-cache',
            },
          })

          if (resp?.status === 200) {
            logger.info('register', 'Update available, triggering update')
            await r.update()
          } else {
            logger.warn('register', `Update check failed with status: ${resp?.status}`)
          }
        } catch (error) {
          logger.error('register', 'Update check failed', error)
        }
      }, intervalMS)
    }

    const onOfflineReady = () => {
      logger.info('lifecycle', 'PWA is ready to work offline')
      const appLifecycleHook = lifeCycle.getAppLifecycleHook()

      appLifecycleHook.state.offlineReady = true
      appLifecycleHook.onOfflineReady(true)
    }

    const onNeedRefresh = () => {
      logger.info('lifecycle', 'PWA update available, refresh needed')
      const appLifecycleHook = lifeCycle.getAppLifecycleHook()

      appLifecycleHook.state.updateAvailable = true
      appLifecycleHook.onUpdateAvailable(true)
    }

    const onRegisterError = (e: Error) => {
      logger.error('register', 'Registration failed', {
        message: e.message,
        stack: e.stack,
        name: e.name,
      })
    }

    async function register() {
      if (!('serviceWorker' in navigator)) {
        logger.error('register', 'Not supported in this browser')
        return
      }

      logger.info('register', 'Loading Workbox module')
      try {
        const { Workbox } = await import('workbox-window')
        logger.info('register', 'Workbox loaded successfully')

        wb = new Workbox(filename, { scope, type })
        logger.info('register', 'Workbox instance created', { filename, scope, type })

        sendSkipWaitingMessage = () => {
          logger.info('register', 'Sending skip waiting message')
          wb?.messageSkipWaiting()
        }

        let onNeedRefreshCalled = false
        const showSkipWaitingPrompt = (event?: WorkboxLifecycleWaitingEvent) => {
          logger.info('register', 'Service worker waiting, showing skip waiting prompt', {
            isExternal: event?.isExternal,
            wasWaitingBeforeRegister: event?.wasWaitingBeforeRegister,
            onNeedRefreshCalled,
          })

          if (event && onNeedRefreshCalled && event.isExternal) {
            logger.info('register', 'External update detected, reloading page immediately')
            window.location.reload()
          }

          onNeedRefreshCalled = true

          // Set up controlling event listener
          wb?.addEventListener('controlling', (event) => {
            logger.info('register', 'Service worker took control', {
              isUpdate: event.isUpdate,
              isExternal: event.isExternal,
            })

            if (event.isUpdate === true || event.isExternal === true) {
              logger.info('register', 'Reloading page due to service worker control change')
              window.location.reload()
            }
          })

          onNeedRefresh?.()
        }

        // Service worker installed event
        wb.addEventListener('installed', (event) => {
          logger.info('register', 'Service worker installed', {
            isUpdate: event.isUpdate,
            isExternal: event.isExternal,
          })

          if (typeof event.isUpdate === 'undefined') {
            if (typeof event.isExternal !== 'undefined') {
              if (event.isExternal) {
                logger.info('register', 'External service worker installed, showing prompt')
                showSkipWaitingPrompt()
              } else {
                logger.info('register', 'First-time service worker installed, marking offline ready')
                !onNeedRefreshCalled && onOfflineReady?.()
              }
            } else {
              if (event.isExternal) {
                logger.info('register', 'External service worker (legacy), reloading immediately')
                window.location.reload()
              } else {
                logger.info('register', 'First-time service worker (legacy), marking offline ready')
                !onNeedRefreshCalled && onOfflineReady?.()
              }
            }
          } else if (!event.isUpdate) {
            logger.info('register', 'Service worker installed (not an update), marking offline ready')
            onOfflineReady?.()
          }

          wb?.active.then((r) => {
            // @ts-expect-error
            if (typeof window.__reactRouterContext === 'object') {
              r.postMessage({
                type: 'INITIAL_DATA',
                // @ts-expect-error
                data: window.__reactRouterContext.state.loaderData,
              })
              logger.info('register', 'Initial data sent to service worker')
            }
          })
        })

        // Service worker waiting event
        wb.addEventListener('waiting', (event) => {
          logger.info('register', 'Service worker waiting event', {
            isUpdate: event.isUpdate,
            isExternal: event.isExternal,
            wasWaitingBeforeRegister: event.wasWaitingBeforeRegister,
          })
          showSkipWaitingPrompt(event)
        })

        // Additional event logging
        wb.addEventListener('message', (event) => {
          logger.debug('event', 'Message received', event.data)
        })

        wb.addEventListener('redundant', (event) => {
          logger.debug('event', 'Service worker became redundant', event)
        })

        // Register the service worker
        logger.info('register', 'Registering service worker')
        const registration = await wb.register({ immediate })

        if (!registration) {
          throw new Error('Service worker registration returned null')
        }

        logger.info('register', 'Registration successful', {
          scope: registration.scope,
          active: !!registration.active,
          installing: !!registration.installing,
          waiting: !!registration.waiting,
        })

        onRegisteredSW(filename, registration)
      } catch (error) {
        logger.error('register', 'Registration process failed', error)
        onRegisterError?.(error instanceof Error ? error : new Error(String(error)))
      }
    }

    logger.info('register', 'Starting service worker registration')
    registerPromise = register()

    // Monitor for standalone mode changes (indicates successful installation)
    const standaloneMediaQuery = window.matchMedia('(display-mode: standalone)')
    const handleStandaloneChange = (e: MediaQueryListEvent) => {
      logger.info('register', 'Display mode changed', e.matches ? 'standalone' : 'browser')
      if (e.matches) {
        logger.info('register', 'PWA successfully installed and launched!')
      }
    }

    if (standaloneMediaQuery.addEventListener) {
      standaloneMediaQuery.addEventListener('change', handleStandaloneChange)
    } else {
      // Fallback for older browsers
      standaloneMediaQuery.addListener(handleStandaloneChange)
    }

    logger.groupEnd()
  } else {
    logger.info('Install', 'Development mode - Service worker registration skipped')
  }
}
