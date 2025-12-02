/// <reference lib="webworker" />
import { createPwaHandler } from '@xstack/app/pwa/react-router-handle'
import type { ReactRouterBuild, RouteData } from '@xstack/app/pwa/react-router-helpers'
import { cleanupOutdatedCaches, type PrecacheEntry, precacheAndRoute } from 'workbox-precaching'
import { getOrCreatePrecacheController } from 'workbox-precaching/utils/getOrCreatePrecacheController'
import { NavigationRoute, registerRoute, setDefaultHandler } from 'workbox-routing'
import { StaleWhileRevalidate } from 'workbox-strategies'
import { PwaLogger } from '@xstack/app/pwa/logger'

const logger = new PwaLogger({
  enabled: () => false,
  prefix: '🔧 PWA [SW]',
})

// =====================================================================================
// SERVICE WORKER TYPES & CONSTANTS
// =====================================================================================

/**
 * Service Worker message types for type-safe communication
 */
const SW_MESSAGE_TYPES = {
  SKIP_WAITING: 'SKIP_WAITING',
  INITIAL_DATA: 'INITIAL_DATA',
} as const

interface SwMessage {
  type: keyof typeof SW_MESSAGE_TYPES
  timestamp?: number
  reason?: string
}

interface InitOptions {
  manifest: Array<PrecacheEntry | string>
  manifestVersion: string
  dynamicPaths: Array<string>
  reactRouterBuild: ReactRouterBuild
  fallbackLoaderData?: () => RouteData
  navigateOptions?: {
    headers?: Record<string, string>
  }
}

export function reactRouterPwa({
  dynamicPaths,
  fallbackLoaderData,
  manifest,
  manifestVersion,
  reactRouterBuild,
  navigateOptions = {},
}: InitOptions) {
  logger.group('Init', 'React Router PWA Initialization')

  logger.info('Init', 'Configuration', {
    manifestVersion,
    dynamicPathsCount: dynamicPaths.length,
    manifestEntriesCount: manifest.length,
    hasFallbackLoaderData: !!fallbackLoaderData,
    navigateOptions,
  })

  // Initialize workbox precaching
  logger.info('Init', 'Initializing Workbox precaching')

  try {
    precacheAndRoute(manifest)
    logger.info('Init', 'Precaching initialized successfully')
  } catch (error) {
    logger.error('Init', 'Precaching initialization failed', error)
  }

  logger.info('Init', 'Cleaning up outdated caches')

  try {
    cleanupOutdatedCaches()
    logger.info('Init', 'Outdated caches cleaned up')
  } catch (error) {
    logger.error('Init', 'Cache cleanup failed', error)
  }

  // Setup cache strategy and handlers
  const precacheController = getOrCreatePrecacheController()
  const cacheStrategy = new StaleWhileRevalidate()

  logger.info('Init', 'Cache strategy configured', {
    strategyName: 'StaleWhileRevalidate',
    cacheName: precacheController.strategy.cacheName,
  })

  // Generate shell request with version
  const shellRequest = new Request(`/?shell=true&__WB_REVISION__=${manifestVersion}`)

  const getShellHtmlResponse = () => {
    logger.info('Shell', 'Fetching shell HTML response from cache')

    return self.caches.open(precacheController.strategy.cacheName).then((cache) => {
      return cache.match(shellRequest).then((response) => {
        if (response) {
          logger.info('Shell', 'Shell HTML found in cache')
        } else {
          logger.info('Shell', 'Shell HTML not found in cache')
        }
        return response
      })
    })
  }

  // Create PWA handler
  logger.info('Init', 'Creating PWA handler')

  const {
    precacheLoaderData,
    mergeLoaderData,
    handleDataRequest,
    handleNavigationRequest,
    isDataRequest,
    isNavigationRequest,
  } = createPwaHandler({
    cacheStrategy,
    reactRouterBuild,
    dynamicPaths,
    fallbackLoaderData,
  })

  // Register navigation route handler
  logger.info('Init', 'Registering navigation route handler')

  // Enhanced message handling with type safety
  self.addEventListener('message', (event: MessageEvent) => {
    const messageData = event.data as SwMessage

    logger.info('Message', 'Message received', {
      type: messageData?.type,
      timestamp: messageData?.timestamp,
      origin: event.origin,
    })

    if (!messageData || !messageData.type) {
      logger.error('Message', 'Invalid message received', event.data)
      return
    }

    switch (messageData.type) {
      case SW_MESSAGE_TYPES.SKIP_WAITING:
        logger.info('Message', 'Processing SKIP_WAITING request')
        // @ts-ignore - skipWaiting is available in service worker context
        self.skipWaiting()
        logger.info('Message', 'Skip waiting executed')
        break

      case SW_MESSAGE_TYPES.INITIAL_DATA: {
        const data = (messageData as unknown as { data: RouteData }).data
        logger.info('Message', 'Processing INITIAL_DATA request', data)
        mergeLoaderData(data)
        break
      }

      default:
        logger.error('Message', 'Unknown message type', messageData.type)
    }
  })

  registerRoute(
    new NavigationRoute(({ event, request }) => {
      const url = new URL(request.url)

      logger.info('Navigation', 'Navigation route triggered', {
        url: url.href,
        pathname: url.pathname,
        method: request.method,
        isNavigationRequest: isNavigationRequest(url),
      })

      // Handle navigation requests
      if (isNavigationRequest(url)) {
        return getShellHtmlResponse()
          .then((cache) => {
            if (!cache) {
              logger.info('Navigation', 'Cache miss, fetching shell from network')
              return fetch(shellRequest)
            }
            logger.info('Navigation', 'Using cached shell response')
            return cache
          })
          .then((response) => handleNavigationRequest(url, { event, response }, navigateOptions))
          .catch((error) => {
            logger.error('Navigation', 'Navigation request failed, falling back to direct fetch', error)
            return fetch(url)
          })
      }

      logger.info('Navigation', 'Not a navigation request, passing through')
      return fetch(request)
    }),
  )

  // Set default handler for other requests
  setDefaultHandler({
    handle: ({ event, request }) => {
      const url = new URL(request.url)

      logger.info('Handler', 'Default handler triggered', {
        url: url.href,
        pathname: url.pathname,
        method: request.method,
      })

      // Handle manifest requests
      if (url.pathname.startsWith('/__manifest')) {
        return Promise.resolve(
          new Response(JSON.stringify(reactRouterBuild.assets.routes), {
            headers: { 'content-type': 'application/json' },
          }),
        )
      }

      // Handle data requests
      if (isDataRequest(url)) {
        return handleDataRequest(url, { event, request }, navigateOptions)
      }

      return fetch(request)
    },
  })

  // Precache loader data
  precacheLoaderData()

  logger.groupEnd()
}
