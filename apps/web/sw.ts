import type { RootLoader } from '@/root'
import type * as Loaders from '@server/loaders'
import { dynamicPaths } from '@shared/config'
import { headers } from '@shared/config.server'
import { ServiceUnavailableError } from '@xstack/app/pwa/errors'
import type { ReactRouterBuild } from '@xstack/app/pwa/react-router-helpers'
import { reactRouterPwa } from '@xstack/app/pwa/react-router-pwa'
import type { WorkboxPlugin } from 'workbox-core'
import { ExpirationPlugin } from 'workbox-expiration'
import type { PrecacheEntry } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { StaleWhileRevalidate } from 'workbox-strategies'

declare let self: {
  __WB_MANIFEST: Array<PrecacheEntry | string>
  __MANIFEST_VERSION: string
  __MANIFEST_CUSTOM: Array<PrecacheEntry | string>
  __REACT_ROUTER_BUILD: ReactRouterBuild
}

declare global {
  var SANITY_STUDIO_DATASET: string
  var SANITY_STUDIO_PROJECT_ID: string
}

// Will be replaced by vite-plugin-vite
const MANIFEST = self.__WB_MANIFEST

// Will be replaced by build script
const reactRouterBuild = self.__REACT_ROUTER_BUILD
const manifestVersion = self.__MANIFEST_VERSION
const manifestCustom = self.__MANIFEST_CUSTOM

const manifest = MANIFEST.concat(manifestCustom || [])

reactRouterPwa({
  dynamicPaths,
  manifest,
  manifestVersion,
  reactRouterBuild,
  fallbackLoaderData: () => {
    return {
      root: {
        success: true,
        result: {
          isShell: false,
          isAppEnable: false,
          sanity: {
            dataset: globalThis.SANITY_STUDIO_DATASET || '',
            projectId: globalThis.SANITY_STUDIO_PROJECT_ID,
          },
        },
      } satisfies Awaited<ReturnType<RootLoader>>,
      home: {
        success: false,
        error: new ServiceUnavailableError('Home page data is currently unavailable.') as any,
      } satisfies Awaited<ReturnType<Loaders.HomeLoader>>,
      'app-home': {
        success: false,
        error: new ServiceUnavailableError('Home page data is currently unavailable.') as any,
      } satisfies Awaited<ReturnType<Loaders.HomeLoader>>,
      pricing: {
        success: false,
        error: new ServiceUnavailableError('Pricing page data is currently unavailable.') as any,
      } satisfies Awaited<ReturnType<Loaders.PricingLoader>>,
      changelog: {
        success: false,
        error: new ServiceUnavailableError('Changelog page data is currently unavailable.') as any,
      } satisfies Awaited<ReturnType<Loaders.ChangelogLoader>>,
    }
  },
  navigateOptions: {
    headers: {
      ...headers,
    },
  },
})

// Dynamic cache
registerRoute(
  /^https:\/\/cdn\.sanity\.io/,
  new StaleWhileRevalidate({
    cacheName: 'sanity-files',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 30,
        maxAgeSeconds: 3 * 24 * 60 * 60, // 3 Days
      }) as WorkboxPlugin,
    ],
  }),
)

// https://insight.opraying.com/script.js
registerRoute(
  /^https:\/\/insight\.opraying\.com/,
  new StaleWhileRevalidate({
    cacheName: 'scripts',
  }),
)
