// @ts-ignore
import { PwaError, PwaErrorCode, PwaErrorFactory } from '@xstack/app/pwa/errors'
import { dedupe, getKeyedLinksForMatches, matchRoutes } from '@xstack/app/pwa/react-router'
import * as TurboStream from 'turbo-stream'

export type Params<Key extends string = string> = { readonly [key in Key]: string | undefined }

export const SingleFetchRedirectSymbol = Symbol('SingleFetchRedirect')

export type ErrorResponse = {
  status: number
  statusText: string
  data: any
}

/**
 * @private
 * Utility class we use to hold auto-unwrapped 4xx/5xx Response bodies
 *
 * We don't export the class for public use since it's an implementation
 * detail, but we export the interface above so folks can build their own
 * abstractions around instances via isRouteErrorResponse()
 */
export class ErrorResponseImpl implements ErrorResponse {
  status: number
  statusText: string
  data: any
  private error?: Error
  private internal: boolean

  constructor(status: number, statusText: string | undefined, data: any, internal = false) {
    this.status = status
    this.statusText = statusText || ''
    this.internal = internal
    if (data instanceof Error) {
      this.data = data.toString()
      this.error = data
    } else {
      this.data = data
    }
  }
}

// Note: If you change this function please change the corresponding
// decodeViaTurboStream function in server-runtime
export function encodeViaTurboStream(data: any, requestSignal: AbortSignal, streamTimeout?: number | undefined) {
  const controller = new AbortController()
  // How long are we willing to wait for all of the promises in `data` to resolve
  // before timing out?  We default this to 50ms shorter than the default value
  // of 5000ms we had in `ABORT_DELAY` in Remix v2 that folks may still be using
  // in RR v7 so that once we reject we have time to flush the rejections down
  // through React's rendering stream before we call `abort()` on that.  If the
  // user provides their own it's up to them to decouple the aborting of the
  // stream from the aborting of React's `renderToPipeableStream`
  const timeoutId = setTimeout(
    () => controller.abort(new Error('Server Timeout')),
    typeof streamTimeout === 'number' ? streamTimeout : 4950,
  )
  requestSignal.addEventListener('abort', () => clearTimeout(timeoutId))

  return TurboStream.encode(data, {
    signal: controller.signal,
    plugins: [
      (value) => {
        // Even though we sanitized errors on context.errors prior to responding,
        // we still need to handle this for any deferred data that rejects with an
        // Error - as those will not be sanitized yet
        if (value instanceof Error) {
          const { name, message, stack } = value
          return ['SanitizedError', name, message, stack]
        }

        if (value instanceof ErrorResponseImpl) {
          const { data, status, statusText } = value
          return ['ErrorResponse', data, status, statusText]
        }

        if (value && typeof value === 'object' && SingleFetchRedirectSymbol in value) {
          return ['SingleFetchRedirect', value[SingleFetchRedirectSymbol]]
        }
      },
    ],
    postPlugins: [
      (value) => {
        if (!value) return
        if (typeof value !== 'object') return

        return ['SingleFetchClassInstance', Object.fromEntries(Object.entries(value))]
      },
      () => ['SingleFetchFallback'],
    ],
  })
}

// Note: If you change this function please change the corresponding
// encodeViaTurboStream function in server-runtime
export function decodeViaTurboStream(body: ReadableStream<Uint8Array>, global: Window | typeof globalThis) {
  return TurboStream.decode(body, {
    plugins: [
      (type: string, ...rest: unknown[]) => {
        // Decode Errors back into Error instances using the right type and with
        // the right (potentially undefined) stacktrace
        if (type === 'SanitizedError') {
          const [name, message, stack] = rest as [string, string, string | undefined]
          let Constructor = Error
          // @ts-ignore
          if (name && name in global && typeof global[name] === 'function') {
            // @ts-ignore
            Constructor = global[name]
          }
          const error = new Constructor(message)
          error.stack = stack ?? ''
          return { value: error }
        }

        if (type === 'ErrorResponse') {
          const [data, status, statusText] = rest as [unknown, number, string | undefined]
          return {
            value: new ErrorResponseImpl(status, statusText, data),
          }
        }

        if (type === 'SingleFetchRedirect') {
          return { value: { [SingleFetchRedirectSymbol]: rest[0] } }
        }

        if (type === 'SingleFetchClassInstance') {
          return { value: rest[0] }
        }

        if (type === 'SingleFetchFallback') {
          return { value: undefined }
        }
      },
    ],
  })
}

/**
 * Encode data as turbo stream and read to string
 */
export async function encodeToString(data: any, requestSignal?: AbortSignal, streamTimeout?: number): Promise<string> {
  const signal = requestSignal || new AbortController().signal
  const stream = encodeViaTurboStream(data, signal, streamTimeout)
  const decoder = new TextDecoder()
  const reader = stream.getReader()

  let result = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    result += decoder.decode(value)
  }
  return result
}

/**
 * Create response from encoded data
 */
export function createResponse(
  data: string,
  options: {
    status?: number
    headers?: Record<string, string>
    contentType?: string
  } = {},
): Response {
  const { status = 200, headers = {}, contentType = 'text/x-script' } = options

  return new Response(data, {
    status,
    headers: {
      'Content-Type': contentType,
      'X-Remix-Response': 'yes',
      ...headers,
    },
  })
}

/**
 * Decode route data string with proper error handling
 */
export async function decodeRouteData(dataString: string, routeId: string, source: string): Promise<RouteData> {
  const context = `decodeRouteDataString(${routeId}, ${source})`

  try {
    const decodedResult = await decodeViaTurboStream(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(dataString))
          controller.close()
        },
      }),
      globalThis,
    )

    const routeData = await decodedResult.done.then(() => decodedResult.value as RouteData)

    if (!routeData || typeof routeData !== 'object') {
      throw PwaErrorFactory.createDataError(PwaErrorCode.DATA_VALIDATION_FAILED, context, {
        dataType: `decoded_${source}`,
      })
    }

    return routeData
  } catch (error) {
    if (error instanceof PwaError) {
      throw error
    }

    throw PwaErrorFactory.createDataError(PwaErrorCode.DATA_DECODE_FAILED, context, { dataType: source }, error)
  }
}

export type ReactRouterBuildEntry = {
  module: string
}

export type ReactRouterBuildAssetsEntry = {
  module: string
  imports: string[]
  css: string[]
}

export type ReactRouterBuildRoute = {
  id: string
  parentId: string
  path: string
  index: boolean
  caseSensitive: boolean
  hasAction: boolean
  hasLoader: boolean
  hasClientAction: boolean
  hasClientLoader: boolean
  hasClientMiddleware: boolean
  hasErrorBoundary: boolean
  css: string[]
  module: string
  imports: string[]
  clientActionModule?: string
  clientLoaderModule?: string
  clientMiddlewareModule?: string
  hydrateFallbackModule?: string
}

export type ReactRouterBuild = {
  entry: ReactRouterBuildEntry
  future: Record<string, string>
  assets: {
    url: string
    version: string
    entry: ReactRouterBuildAssetsEntry
    routes: Record<string, ReactRouterBuildRoute>
  }
}

export type RouteData = Record<string, any>

export interface AssetsRoute {
  id: string
  path: string
  hasLoader: boolean
}

export interface RouteMatch<Route> {
  params: Params
  pathname: string
  route: Route
}

export function matchServerRoutes(
  routes: Array<AssetsRoute>,
  pathname: string,
  basename = '/',
): Array<RouteMatch<AssetsRoute>> {
  const matches = matchRoutes(routes, pathname, basename)

  if (!matches) return []

  return matches.map((match: any) => ({
    params: match.params,
    pathname: match.pathname,
    route: match.route,
  }))
}

/**
 * PWA HTML template replacement placeholders
 */
export const PWA_PLACEHOLDERS = {
  modulepreload: /<meta id="__react_pwa_modulepreload"\/>/,
  links: /<meta id="__react_pwa_links"\/>/,
  context: /<script\s+id="__react_pwa_context">([^]*?)<\/script>/,
  routeModules: /<script\s+id="__react_pwa_route_modules">([^]*?)<\/script>/,
  hydrateData: /<div\s+id="__react_pwa_hydrate_data">([^]*?)<\/div>/,
} as const

/**
 * Generated script result structure
 */
export interface ScriptResult {
  script: string
  data: any
}

/**
 * HTML replacement context
 */
export interface HtmlReplaceContext {
  routes: Array<AssetsRoute>
  url: URL
  html: string
  reactRouterBuild: ReactRouterBuild
  loaderData: string
}

/**
 * PWA hydration data structure
 */
export interface PwaHydrateData {
  links: any[]
  modulepreload: any[]
  context: any
  routeModule: string
}

/**
 * Generate CSS and resource links for matched routes
 */
function generateLinksScript(
  matches: Array<RouteMatch<AssetsRoute>>,
  assets: ReactRouterBuild['assets'],
): ScriptResult {
  const keyedLinks = getKeyedLinksForMatches(matches, assets.routes, assets).map((item: any) => item.link)

  const script = keyedLinks.map((item: any) => `<link rel="${item.rel}" href="${item.href}" />`).join('\n')

  return {
    script,
    data: keyedLinks,
  }
}

/**
 * Generate module preload links for performance optimization
 */
function generateModulePreloadScript(
  matches: Array<RouteMatch<AssetsRoute>>,
  assets: ReactRouterBuild['assets'],
  entry: ReactRouterBuildEntry,
): ScriptResult {
  // Collect all route modules and their imports
  const routePreloads = matches.flatMap((match) => {
    const route = assets.routes[match.route.id]
    if (!route) return []
    return (route.imports || []).concat([route.module])
  })

  // Combine entry imports with route preloads
  const allPreloads = assets.entry.imports.concat(routePreloads)

  // Dedupe and create preload objects
  const preloadData = dedupe([assets.url, entry.module].concat(allPreloads)).map((href: string) => ({
    type: 'modulepreload',
    href,
  }))

  const script = preloadData
    .map((preload) => {
      if (preload.type === 'script') {
        return `<link rel="preload" href="${preload.href}" as="script" crossorigin="" />`
      }
      return `<link rel="modulepreload" href="${preload.href}" />`
    })
    .join('\n')

  return {
    script,
    data: preloadData,
  }
}

/**
 * Generate React Router context initialization script
 * This sets up the global context object that React Router needs for SSR
 *
 * @see https://github.com/remix-run/react-router/blob/ae65995a175cbe383d86687a3efe87625bf10a82/packages/remix-react/components.tsx#L671
 */
function generateContextScript(url: URL, future: Record<string, string>): ScriptResult {
  const context = {
    url: url.pathname,
    future,
    routeDiscovery: {
      mode: 'lazy' as const,
      manifestPath: '/__manifest',
    },
    ssr: true,
    isSpaMode: false,
  }

  // Create the initialization script with stream setup
  const initScript = `window.__reactRouterContext = ${JSON.stringify(context)};`
  const streamScript = `window.__reactRouterContext.stream = new ReadableStream({
    start(controller) {
      window.__reactRouterContext.streamController = controller;
    }
  }).pipeThrough(new TextEncoderStream());`

  const content = initScript + streamScript

  return {
    script: `<script>${content}</script>`,
    data: context,
  }
}

/**
 * Generate route module imports and initialization script
 * This creates the module loading script that imports all necessary route modules
 *
 * @see https://github.com/remix-run/react-router/blob/ae65995a175cbe383d86687a3efe87625bf10a82/packages/remix-react/components.tsx#L772
 */
function generateRouteModuleScript(
  matches: Array<RouteMatch<AssetsRoute>>,
  assets: ReactRouterBuild['assets'],
  loaderData: string,
): ScriptResult {
  const routeImports = matches
    .map((match, index) => {
      const route = assets.routes[match.route.id]
      if (!route) return ''
      return `import * as route${index} from ${JSON.stringify(route.module)};`
    })
    .filter(Boolean)
    .join('\n')

  // Create route module mapping
  const routeModuleMapping = matches.map((match, index) => `${JSON.stringify(match.route.id)}:route${index}`).join(',')

  // Build the complete script content
  const content = `
window.__reactRouterManifest = ${JSON.stringify(assets)};

${routeImports}

window.__reactRouterRouteModules = {${routeModuleMapping}};

import(${JSON.stringify(assets.entry.module)});

window.__reactRouterContext.streamController.enqueue(${JSON.stringify(loaderData)});
window.__reactRouterContext.streamController.close();
`.trim()

  return {
    script: `<script type="module" async>${content}</script>`,
    data: content,
  }
}

/**
 * Generate all PWA-related scripts and data
 */
function generatePwaScripts(context: HtmlReplaceContext): {
  modulepreload: ScriptResult
  links: ScriptResult
  context: ScriptResult
  routeModule: ScriptResult
} {
  const { reactRouterBuild, routes, url, loaderData } = context
  const { entry, assets } = reactRouterBuild
  const matches = matchServerRoutes(routes, url.pathname)

  return {
    modulepreload: generateModulePreloadScript(matches, assets, entry),
    links: generateLinksScript(matches, assets),
    context: generateContextScript(url, reactRouterBuild.future),
    routeModule: generateRouteModuleScript(matches, assets, loaderData),
  }
}

/**
 * Create PWA hydration data for client-side consumption
 */
function createPwaHydrateData(scripts: ReturnType<typeof generatePwaScripts>): string {
  const hydrateData: PwaHydrateData = {
    links: scripts.links.data,
    modulepreload: scripts.modulepreload.data,
    context: scripts.context.data,
    routeModule: scripts.routeModule.data,
  }

  return JSON.stringify(hydrateData)
}

/**
 * Main function to replace PWA placeholders in HTML with React Router specific content
 *
 * This function orchestrates the generation of all necessary scripts and data
 * for PWA functionality in a React Router application, including:
 * - Module preloading for performance
 * - CSS and resource links
 * - React Router context initialization
 * - Route module imports and setup
 * - Hydration data for client-side consumption
 */
export function applyHtmlReplacements(context: HtmlReplaceContext): string {
  // Generate all PWA scripts and data
  const scripts = generatePwaScripts(context)

  // Create hydration data for client consumption
  const hydrateData = createPwaHydrateData(scripts)

  // Apply all replacements to the HTML
  return context.html
    .replace(PWA_PLACEHOLDERS.modulepreload, scripts.modulepreload.script)
    .replace(PWA_PLACEHOLDERS.links, scripts.links.script)
    .replace(PWA_PLACEHOLDERS.context, scripts.context.script)
    .replace(PWA_PLACEHOLDERS.routeModules, scripts.routeModule.script)
    .replace(
      PWA_PLACEHOLDERS.hydrateData,
      `<div id='__react_pwa_hydrate_data' style='display: none;'>${hydrateData}</div>`,
    )
}
