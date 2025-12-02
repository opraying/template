/// <reference lib="webworker" />
import { createRoutes, matchPath } from '@xstack/app/pwa/react-router'
import type { ReactRouterBuild, RouteData } from '@xstack/app/pwa/react-router-helpers'
import * as Helpers from '@xstack/app/pwa/react-router-helpers'
import type { Strategy } from 'workbox-strategies'
import { PwaLogger } from '@xstack/app/pwa/logger'
import errorOverlayHtml from './error-overlay.html?raw'
import { PwaError, PwaErrorCode, PwaErrorFactory } from '@xstack/app/pwa/errors'

const logger = new PwaLogger({
  enabled: () => false,
  prefix: '🔧 PWA [SW-Handler]',
})

/**
 * PWA configuration constants
 */
export const PWA_CONFIG = {
  NETWORK_CHECK_INTERVAL: 5000, // 5 seconds
  SW_RESPONSE_TIMEOUT: 5000, // 5 seconds
  CACHE_UPDATE_TIMEOUT: 3600, // 1 hour in seconds
  PROGRESS_UPDATE_DELAY: 800, // milliseconds
  ERROR_RECOVERY_DELAY: 1000, // milliseconds
} as const

/**
 * Configuration options for PWA handler
 */
export interface PwaHandlerOptions {
  cacheStrategy: Strategy
  reactRouterBuild: ReactRouterBuild
  dynamicPaths: Array<string>
  fallbackLoaderData?: (() => RouteData) | undefined
}

/**
 * Request handling context
 */
export interface RequestContext {
  event: ExtendableEvent
  request?: Request
  response?: Response
}

/**
 * Navigation request options
 */
export interface NavigationOptions {
  headers?: Record<string, string> | undefined
}

/**
 * PWA Handler interface
 */
export interface PwaHandler {
  precacheLoaderData(): Promise<void>
  mergeLoaderData(data: RouteData): Promise<void>
  isNavigationRequest(url: URL): boolean
  isDataRequest(url: URL): boolean
  handleDataRequest(url: URL, context: RequestContext, options?: NavigationOptions): Promise<Response>
  handleNavigationRequest(url: URL, context: RequestContext, options?: NavigationOptions): Promise<Response>
}

/**
 * Route data manager for handling loader data caching and retrieval
 */
class RouteDataManager {
  private uniqueRouteKeys: string[]
  private routeDataCache: Record<string, RouteData | undefined>

  constructor(fallbackLoaderData: RouteData) {
    this.routeDataCache = fallbackLoaderData
    this.uniqueRouteKeys = this.getUniqueRouteKeys()
  }

  /**
   * Get unique route keys
   */
  private getUniqueRouteKeys(): string[] {
    return Object.keys(this.routeDataCache)
  }

  /**
   * Get unique route keys for iteration
   */
  getRouteKeys(): string[] {
    return this.uniqueRouteKeys
  }

  /**
   * Get fallback data for a specific route
   */
  getFallbackData(routeId: string): RouteData | undefined {
    return this.routeDataCache[routeId]
  }

  /**
   * Check if fallback data exists for a route
   */
  hasFallbackData(routeId: string): boolean {
    return routeId in this.routeDataCache && this.routeDataCache[routeId] != null
  }

  async encode(data: RouteData, requestSignal?: AbortSignal, streamTimeout?: number): Promise<string | undefined> {
    return await Helpers.encodeToString({ data }, requestSignal, streamTimeout)
  }

  /**
   * Encode route data as stream
   */
  async encodeRouteData(
    routeKey: string,
    requestSignal?: AbortSignal,
    streamTimeout?: number,
  ): Promise<string | undefined> {
    try {
      const data = this.routeDataCache[routeKey]
      if (!data) {
        return undefined
      }

      return await Helpers.encodeToString({ data }, requestSignal, streamTimeout)
    } catch (error) {
      throw PwaErrorFactory.createDataError(
        PwaErrorCode.DATA_ENCODE_FAILED,
        `RouteDataManager.encodeRouteData(${routeKey})`,
        { dataType: 'route', routeKey } as Record<string, any>,
        error,
      )
    }
  }
}

/**
 * Cache manager for handling route data caching strategies
 */
class CacheManager {
  private cacheStrategy: Strategy

  constructor(cacheStrategy: Strategy) {
    this.cacheStrategy = cacheStrategy
  }

  /**
   * Get cache strategy
   */
  getStrategy(): Strategy {
    return this.cacheStrategy
  }

  /**
   * Update cache with successful response data
   */
  async updateCache(request: Request, responseData: string): Promise<void> {
    try {
      const cache = await self.caches.open(this.cacheStrategy.cacheName)
      const response = Helpers.createResponse(responseData, {
        headers: { 'X-Remix-Response': 'yes' },
      })

      await cache.put(request, response.clone())
    } catch (error) {
      // Log error but don't throw as this is not critical to the main flow
      const cacheError = PwaErrorFactory.createCacheError(
        PwaErrorCode.CACHE_WRITE_FAILED,
        'CacheManager.updateCache',
        { operation: 'cache_update', cacheName: this.cacheStrategy.cacheName },
        error,
      )
      logger.error('CacheManager', 'Cache update failed:', cacheError.format())
    }
  }
}

/**
 * Route matcher for handling route resolution
 */
class RouteMatcher {
  private routes: ReturnType<typeof createRoutes> = []
  private reactRouterBuild: ReactRouterBuild

  constructor(reactRouterBuild: ReactRouterBuild) {
    this.reactRouterBuild = reactRouterBuild
  }

  /**
   * Get routes with lazy initialization
   */
  getRoutes(): ReturnType<typeof createRoutes> {
    if (this.routes.length === 0) {
      this.routes = createRoutes(this.reactRouterBuild.assets.routes)
    }
    return this.routes
  }

  /**
   * Check if URL matches navigation patterns
   */
  isNavigationRequest(url: URL, dynamicPaths: string[]): boolean {
    return dynamicPaths.some((pattern) => matchPath(pattern, url.pathname))
  }

  /**
   * Check if URL is a data request
   */
  isDataRequest(url: URL): boolean {
    return url.pathname.indexOf('.data') > -1 && url.searchParams.has('_routes')
  }

  /**
   * Normalize route path for data requests
   *
   * /              -> /root.data
   * /_root.data     -> /root.data
   * /services.data  -> /services.data
   * products/:slug? -> /products.data
   */
  normalizeRoutePath(path: string): string {
    if (path === '/') return '/_root.data'

    // If already a data path, return as is
    if (path.includes('.data')) {
      return path
    }

    // Remove optional parameters (e.g., :slug?) and dynamic segments (e.g., :id)
    const normalizedPath = path.replace(/\/:\w+\??/g, '')

    // Add .data extension
    return normalizedPath + '.data'
  }

  /**
   * Generate data URL for route
   */
  generateDataUrl(routePath: string, routeId: string): string {
    const normalizedPath = this.normalizeRoutePath(routePath)
    return `${normalizedPath}?_routes=${encodeURIComponent(routeId)}`
  }
}

/**
 * Process and merge input data
 */
function processInputData(inputData: (readonly [string, RouteData])[]): Record<string, any> {
  const result: Record<string, Record<string, any>> = {}

  const sortedInput = inputData
    .map(([key, value], index) => ({ key, value, index }))
    .sort((a, b) => a.key.length - b.key.length || a.index - b.index)

  for (const { key, value } of sortedInput) {
    if (key === 'root') {
      result[key] = value[key]
      continue
    }

    for (const routeKey in value) {
      const data = value[routeKey].data || {}
      const prev = result[routeKey]?.data || {}
      result[routeKey] = {
        data: {
          ...prev,
          ...data,
        },
      }
    }
  }

  return Object.fromEntries(Object.entries(result).map(([k, v]) => [k, v]))
}

/**
 * Create and configure a PWA handler
 */
export function createPwaHandler(options: PwaHandlerOptions): PwaHandler {
  logger.info('Handler', 'Creating PWA handler', {
    dynamicPathsCount: options.dynamicPaths.length,
    hasFallbackLoaderData: !!options.fallbackLoaderData,
  })

  // Initialize managers
  const fallbackLoaderData = options.fallbackLoaderData?.() || {}
  const routeDataManager = new RouteDataManager(fallbackLoaderData)
  const cacheManager = new CacheManager(options.cacheStrategy)
  const routeMatcher = new RouteMatcher(options.reactRouterBuild)

  logger.info('Handler', 'PWA handler managers initialized', {
    routeKeysCount: routeDataManager.getRouteKeys().length,
    cacheName: cacheManager.getStrategy().cacheName,
  })

  /**
   * Precache loader data for all routes with validation
   */
  async function precacheLoaderData(): Promise<void> {
    const cache = await self.caches.open(cacheManager.getStrategy().cacheName)
    const abortController = new AbortController()

    const cachePromises = routeDataManager.getRouteKeys().map(async (routeKey) => {
      try {
        const route = options.reactRouterBuild.assets.routes[routeKey]
        if (!route) return

        const routeId = route.id
        const routePath = route.path || '/'
        const dataUrl = routeMatcher.generateDataUrl(routePath, routeId)
        const request = new Request(dataUrl, { method: 'GET' })

        logger.info('precache', `Precaching data for route [${routeId}]`, request)

        const encodedData = await routeDataManager.encodeRouteData(routeId, abortController.signal)

        if (!encodedData || encodedData.trim().length === 0) {
          logger.warn('precache', `Empty encoded data for route ${routeKey}, skipping precache`)
          return
        }

        const response = Helpers.createResponse(encodedData, {
          headers: { 'X-Remix-Response': 'yes' },
        })

        await cache.put(request, response)
      } catch (error) {
        const precacheError =
          error instanceof PwaError
            ? error
            : PwaErrorFactory.createUnknownError(`precacheLoaderData.route(${routeKey})`, error)
        logger.error('precache', `Failed to precache data for route ${routeKey}:`, precacheError.format())
      }
    })

    await Promise.all(cachePromises)
  }

  async function mergeLoaderData(data: RouteData) {
    const cache = await self.caches.open(cacheManager.getStrategy().cacheName)
    const abortController = new AbortController()
    const record = Object.fromEntries(
      Object.entries(data)
        .filter(([k, v]) => k && v)
        .map(([k, v]) => [k, { data: v }]),
    )

    for (const routeKey in record) {
      const route = options.reactRouterBuild.assets.routes[routeKey]
      if (!route) continue

      const routeId = route.id
      const routePath = route.path || '/'
      const dataUrl = routeMatcher.generateDataUrl(routePath, routeId)
      const request = new Request(dataUrl, { method: 'GET' })

      const encodedData = await Helpers.encodeToString(
        routeKey === 'root' ? record[routeKey] : record,
        abortController.signal,
      )

      if (!encodedData || encodedData.trim().length === 0) {
        logger.warn('precache', `Empty encoded data for route ${routeKey}, skipping precache`)
        return
      }

      const response = Helpers.createResponse(encodedData, {
        headers: { 'X-Remix-Response': 'yes' },
      })

      await cache.put(request, response.clone())
    }
  }

  /**
   * Fetch route loader data with proper fallback chain: cache -> fetch(online) -> fallback
   *
   * ┌────────────────────────────────────────────────────┐
   * │ fetchRouteLoaderData(routeId, routePath)           │
   * └─────────────────────────┬──────────────────────────┘
   *                           ▼
   * ┌────────────────────────────────────────────────────┐
   * │ Step 1: tryGetFromCache()                          │
   * └─────────────────────────┬──────────────────────────┘
   *                           ▼
   *                    ┌───────────────┐
   *                    │ Cache Result? │
   *                    └─────┬─────────┘
   *              ┌───────────┼───────────┐
   *              ▼           ▼           ▼
   *     ┌─────────────┐ ┌─────────┐ ┌─────────────┐
   *     │ Success     │ │ null    │ │ Error       │
   *     │ (RouteData) │ │ (miss)  │ │ (throw)     │
   *     └─────┬───────┘ └────┬────┘ └─────┬───────┘
   *           ▼              ▼            ▼
   *     ┌─────────────┐ ┌───────────┐ ┌─────────────┐
   *     │ RETURN data │ │ Continue  │ │ Continue    │
   *     │             │ │ to Step 2 │ │ to Step 2   │
   *     └─────────────┘ └────┬──────┘ └─────┬───────┘
   *                          └────────┬─────┘
   *                                   ▼
   *                            ┌─────────────┐
   *                            │ Is Online?  │
   *                            └──────────┬──┘
   *                        ┌──────────────│
   *                        ▼              ▼
   *                   ┌─────────┐       ┌─────────┐
   *                   │ Yes     │       │ No      │
   *                   └────┬────┘       └────┬────┘
   *                        ▼                 ▼
   * ┌─────────────────────────────────┐ ┌───────────────────┐
   * │ Step 2: tryGetFromServer()      │ │ Skip to Step 3    │
   * └─────────────────┬───────────────┘ └──────┬────────────┘
   *                   ▼                        │
   *            ┌───────────────┐               │
   *            │ Server Result │               │
   *            └────────┬──────┘               │
   *        ┌───────────────────────┐           │
   *        ▼                       ▼           │
   * ┌────────────────────┐ ┌─────────────────┐ │
   * │Success (RouteData) │ │Error (throw)    │ │
   * └─────┬──────────────┘ └───────┬─────────┘ │
   *       ▼                        ▼           │
   * ┌─────────────┐        ┌─────────────┐     │
   * │RETURN data  │        │ Continue    │     │
   * │cache update │        │ to Step 3   │     │
   * └─────────────┘        └─────┬───────┘     │
   *                              └──────┬──────┘
   *                                     ▼
   * ┌─────────────────────────────────────────────┐
   * │ Step 3: tryGetFromFallback()                │
   * └─────────────────────────┬───────────────────┘
   *                           ▼
   *                    ┌──────────────────┐
   *                    │ Fallback Result? │
   *                    └───────────┬──────┘
   *              ┌─────────────────│
   *              ▼                 ▼
   *     ┌────────────────────┐ ┌─────────────────┐
   *     │Success (RouteData) │ │Error (throw)    │
   *     └─────┬──────────────┘ └───────┬─────────┘
   *           ▼                        ▼
   *     ┌─────────────┐        ┌─────────────────┐
   *     │ RETURN data │        │ THROW error     │
   *     └─────────────┘        └─────────────────┘
   */
  async function fetchRouteLoaderData(routeId: string, routePath: string): Promise<RouteData> {
    const dataUrl = routeMatcher.generateDataUrl(routePath, routeId)
    const request = new Request(dataUrl, { method: 'GET' })
    const context = `fetchRouteLoaderData(${routeId})`

    logger.info('Fetch', `Fetching route loader data for [${routeId}]`, {
      routePath,
      dataUrl,
      request,
    })

    const isOnline = typeof navigator !== 'undefined' && navigator.onLine

    // Step 1: Try cache first
    try {
      const cachedData = await tryGetFromCache(request, routeId)
      if (cachedData) {
        logger.info('Cache', `Cache hit for route [${routeId}]`, cachedData)

        return cachedData
      }
      // Cache miss - continue to server
      logger.info('Cache', `Cache miss for route [${routeId}], trying server`)
    } catch (error) {
      // Cache errors are usually not fatal, log and continue
      if (error instanceof PwaError) {
        logger.warn('Cache', `Cache read failed for route [${routeId}], continuing to server`, error.format())
      } else {
        logger.warn('Cache', `Cache read failed for route [${routeId}]`, error)
      }
    }

    // Step 2: Try server if online
    if (isOnline) {
      try {
        const serverData = await tryGetFromServer(request, routeId)
        if (serverData) {
          logger.info('Server', `Server success for route ${routeId}`)
          return serverData
        }
        // This shouldn't happen since tryGetFromServer throws on failure
        logger.warn('Server', `Server returned null for route [${routeId}], trying fallback`)
      } catch (error) {
        // Log server error and continue to fallback
        if (error instanceof PwaError) {
          logger.warn('Server', `Server request failed for route [${routeId}], trying fallback`, error.format())
        } else {
          logger.warn('Server', `Server request failed for route [${routeId}]`, error)
        }
      }
    } else {
      logger.info('Network', `Device offline for route [${routeId}], skipping server and trying fallback`)
    }

    // Step 3: Try fallback data
    try {
      return await tryGetFromFallback(routeId)
    } catch (error) {
      if (error instanceof PwaError) {
        logger.error('Server', `All data sources failed for route [${routeId}]:`, error.format())
        throw error
      } else {
        const unknownError = PwaErrorFactory.createUnknownError(context, error)
        logger.error('Server', `All data sources failed for route [${routeId}]:`, unknownError.format())
        throw unknownError
      }
    }
  }

  /**
   * Try to get data from cache
   */
  async function tryGetFromCache(request: Request, routeId: string): Promise<RouteData | null> {
    const context = `tryGetFromCache(${routeId})`

    const cache = await self.caches.open(cacheManager.getStrategy().cacheName)
    const cachedResponse = await cache.match(request)

    if (!cachedResponse) {
      return null // No cache hit
    }

    const cachedDataString = await cachedResponse.text()

    if (!cachedDataString || cachedDataString.trim().length === 0) {
      throw PwaErrorFactory.createDataError(PwaErrorCode.DATA_EMPTY, context, {
        dataType: 'cached_response',
      })
    }

    const data = await Helpers.decodeRouteData(cachedDataString, routeId, 'cache')

    if (data.data && 'success' in data.data) {
      if (!data.data.success) {
        throw PwaErrorFactory.createValidationError(PwaErrorCode.DATA_VALIDATION_FAILED, context)
      }

      return {
        [routeId]: {
          data: data.data,
        },
      }
    }

    if (data[routeId]?.data) {
      if ('success' in data[routeId].data && !data[routeId].data.success) {
        throw PwaErrorFactory.createValidationError(PwaErrorCode.DATA_VALIDATION_FAILED, context)
      }
    }

    return data
  }

  /**
   * Try to get data from server
   */
  async function tryGetFromServer(request: Request, routeId: string): Promise<RouteData> {
    const context = `tryGetFromServer(${routeId})`

    const serverResponse = await fetch(request)

    const responseData = await serverResponse.text()

    if (!responseData || responseData.trim().length === 0) {
      throw PwaErrorFactory.createServerError(PwaErrorCode.SERVER_RESPONSE_INVALID, context, {
        status: serverResponse.status,
        statusText: 'Empty response',
      })
    }

    // Update cache in background (don't wait)
    cacheManager.updateCache(request, responseData)

    return await Helpers.decodeRouteData(responseData, routeId, 'server')
  }

  /**
   * Try to get data from fallback
   */
  async function tryGetFromFallback(routeId: string): Promise<RouteData> {
    const context = `tryGetFromFallback(${routeId})`

    if (!routeDataManager.hasFallbackData(routeId)) {
      throw PwaErrorFactory.createDataError(PwaErrorCode.DATA_EMPTY, context, {
        dataType: 'fallback',
      })
    }

    const fallbackData = routeDataManager.getFallbackData(routeId)

    if (!fallbackData || typeof fallbackData !== 'object') {
      throw PwaErrorFactory.createDataError(PwaErrorCode.DATA_VALIDATION_FAILED, context, {
        dataType: 'fallback',
      })
    }

    // Log that we're using fallback data (this is informational, not an error)
    const fallbackInfo = PwaErrorFactory.createFallbackUsed(
      context,
      'Using fallback data due to cache and server unavailability',
    )
    logger.info('fallback', `Using fallback data for route [${routeId}]:`, fallbackInfo.format())

    return {
      [routeId]: {
        data: fallbackData,
      },
    }
  }

  /**
   * Get loader data for all matched routes
   */
  async function getMatchLoadersData(url: URL): Promise<{
    result: Record<string, RouteData>
    errors: Record<string, any> | undefined
  }> {
    const routes = routeMatcher.getRoutes()
    const matches = Helpers.matchServerRoutes(routes, url.pathname)
    let errors: Record<string, any> = {}

    const routeDataPromises = matches.map(async (match): Promise<readonly [string, RouteData]> => {
      const routeId = match.route.id
      const routePath = match.route.path || '/'

      if (!match.route.hasLoader) {
        return [routeId, {}] as const
      }

      try {
        const data = await fetchRouteLoaderData(routeId, routePath)

        return [routeId, data] as const
      } catch (error) {
        let businessError: PwaError

        if (error instanceof PwaError) {
          businessError = error
        } else {
          businessError = PwaErrorFactory.createUnknownError(
            `getMatchLoadersData.fetchRouteLoaderData(${routeId})`,
            error,
          )
        }

        const errorData = businessError.toStandardError()

        if (errorData) {
          errors[routeId] = errorData
        }

        return [routeId, {}] as const
      }
    })

    const routeDataEntries = await Promise.all(routeDataPromises)

    return {
      result: processInputData(routeDataEntries),
      errors: Object.keys(errors).length > 0 ? errors : undefined,
    }
  }

  /**
   * Handle navigation requests
   */
  async function handleNavigationRequest(
    url: URL,
    context: RequestContext,
    navigationOptions: NavigationOptions = {},
  ): Promise<Response> {
    if (!context.response) {
      throw new Error('Response context is required')
    }

    try {
      const routes = routeMatcher.getRoutes()

      const [shellHtml, loaderData] = await Promise.all([context.response.text(), getMatchLoadersData(url)])

      const combinedData = {
        actionData: undefined,
        loaderData: Object.fromEntries(
          Object.entries(loaderData.result).map(([k, v]) => {
            return [k, v?.data ?? {}]
          }),
        ),
        errors: loaderData.errors,
      }

      const encodedLoaderData = await Helpers.encodeToString(combinedData)

      const html = Helpers.applyHtmlReplacements({
        url,
        routes,
        loaderData: encodedLoaderData,
        reactRouterBuild: options.reactRouterBuild,
        html: shellHtml,
      })

      return new Response(html, {
        headers: {
          'Content-Type': 'text/html',
          'X-Remix-Response': 'yes',
          ...navigationOptions.headers,
        },
      })
    } catch (error) {
      let businessError: PwaError

      if (error instanceof PwaError) {
        businessError = error
      } else {
        businessError = PwaErrorFactory.createUnknownError(`handleNavigationRequest(${url.pathname})`, error)
      }

      let standardError = businessError.toStandardError()

      const renderErrorOverlay = () =>
        errorOverlayHtml
          .replace('placeholder-error-message', standardError.message)
          .replace('placeholder-error-stack', standardError.stack)
          .replace('placeholder-error-details', JSON.stringify(standardError.cause, null, 2))

      return new Response(renderErrorOverlay(), {
        status: 500,
        headers: {
          'Content-Type': 'text/html',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          ...navigationOptions.headers,
        },
      })
    }
  }

  /**
   * Handle data requests with enhanced caching and offline support
   */
  async function handleDataRequest(
    url: URL,
    context: RequestContext,
    _navigationOptions: NavigationOptions = {},
  ): Promise<Response> {
    try {
      const routeId = url.searchParams.get('_routes')

      if (!routeId) {
        throw new Error('Route ID is required')
      }

      if (!context.request) {
        throw new Error('Request context is required')
      }

      const routeData = await fetchRouteLoaderData(routeId, url.pathname)
      const encodedLoaderData = await Helpers.encodeToString(routeData)

      return Helpers.createResponse(encodedLoaderData)
    } catch (error) {
      let businessError: PwaError

      if (error instanceof PwaError) {
        businessError = error
      } else {
        businessError = PwaErrorFactory.createUnknownError(`handleDataRequest(${url.pathname})`, error)
      }

      return await encodeErrorResponse(businessError)
    }
  }

  /**
   * Encode error as turbo stream response
   */
  async function encodeErrorResponse(error: PwaError): Promise<Response> {
    try {
      const errorData = error.toStandardError()
      const encodedErrorData = await Helpers.encodeToString(errorData)

      return Helpers.createResponse(encodedErrorData, {
        status: 500,
        headers: { 'X-PWA-Error': 'true' },
      })
    } catch (encodeError) {
      const fallbackError = {
        _tag: 'InternalServerError',
        message: 'Failed to encode error response',
        cause: {
          message: 'Failed to encode error response',
          stack: encodeError instanceof Error ? encodeError.stack : JSON.stringify(encodeError),
        },
      }

      return new Response(JSON.stringify(fallbackError), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-Remix-Response': 'yes',
          'X-PWA-Error': 'true',
        },
      })
    }
  }

  return {
    precacheLoaderData,
    mergeLoaderData,
    isNavigationRequest: (url: URL) => routeMatcher.isNavigationRequest(url, options.dynamicPaths),
    isDataRequest: (url: URL) => routeMatcher.isDataRequest(url),
    handleNavigationRequest,
    handleDataRequest,
  }
}
