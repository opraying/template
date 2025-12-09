/// <reference types='vitest' />
import { workspaceRoot } from '@nx/devkit'
import { reactRouter as reactRouterVite } from '@react-router/dev/vite'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { visualizer } from 'rollup-plugin-visualizer'
import { defineConfig, mergeConfig, type HmrOptions, type Plugin, type UserConfig } from 'vite'
import checker from 'vite-plugin-checker'
import mkcert from 'vite-plugin-mkcert'
import type { VitePWAOptions } from 'vite-plugin-pwa'
import { VitePWA } from 'vite-plugin-pwa'
import { browserslistBuildTarget } from './browserslists'
import { preprocessorDirectivePlugin } from './plugins/preprocessor-directives'
import { reactCompilerPlugin } from './plugins/react-compiler'
import { svgrPlugin } from './plugins/svgr'
import { getProjectAlias } from '../../../scripts/generate-tsconfig/alias'

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      // @ts-ignore
      NODE_ENV: 'development' | 'production'
      MODE: 'dev' | 'test'
      ANALYZE: 'true' | 'false'
      MINIFY: 'true' | 'false'
      STAGE: 'test' | 'staging' | 'production'
      BUILD_TARGET: 'server' | 'client' | undefined
      DESKTOP: 'true' | 'false' | undefined
    }
  }
}

interface ViteConfig {
  vite?: UserConfig
  checker?: boolean
  port?: number
  alias?: Record<string, string>
}

const packagesDir = join(workspaceRoot, 'packages')

const rootPackageJson = JSON.parse(readFileSync(join(workspaceRoot, 'package.json'), 'utf-8'))
const browserslists = rootPackageJson.browserslist

// https://github.com/vitejs/vite/issues/16719#issuecomment-2308170706
function workerChunkPlugin() {
  return {
    name: workerChunkPlugin.name,
    apply: 'build',
    enforce: 'pre',
    async resolveId(source, importer, _options) {
      if (source.endsWith('?worker')) {
        const resolved = await this.resolve(source.split('?')[0], importer)
        return `\0${resolved?.id}?worker-chunk`
      }
    },
    load(id: string) {
      if (id.startsWith('\0') && id.endsWith('?worker-chunk')) {
        const referenceId = this.emitFile({
          type: 'chunk',
          id: id.slice(1).split('?')[0],
        })
        return `
            export default function WorkerWrapper() {
              return new Worker(
                import.meta.ROLLUP_FILE_URL_${referenceId},
                { type: "module" }
              );
            }`
      }
    },
  } as Plugin
}

export async function reactRouter(projectPath: string, options?: ViteConfig) {
  const isProduction = process.env.NODE_ENV === 'production'
  const isDev = process.env.NODE_ENV === 'development'
  const isAnalyze = process.env.ANALYZE === 'true'
  const isServerTarget = process.env.BUILD_TARGET === 'server'
  const isMinify = (process.env.MINIFY ?? 'true') === 'true'
  const isDesktop = process.env.DESKTOP && process.env.DESKTOP !== 'false'

  const stage = process.env.STAGE ?? 'development'
  const browsersTarget = isProduction ? browserslists.production : browserslists.development
  const buildTarget = browserslistBuildTarget(browsersTarget.join(','))

  const projectRoot = resolve(projectPath, '../')
  // /Users/xx/dir/name
  // get last part of path /dir/name
  const projectLocation = projectPath.split('/').slice(-2).join('/')
  const projectOutput = join(workspaceRoot, 'dist', projectLocation)

  const port = options?.port ?? 1420

  const plugins: UserConfig['plugins'] = [
    preprocessorDirectivePlugin({
      include: [/entry\.server\.ts/, /cms\/src\/hooks\/index\.ts/],
      exclude: [],
    }),

    reactRouterVite(),

    !isServerTarget &&
      reactCompilerPlugin({
        development: !isProduction,
        projectRoot: projectPath,
        target: browsersTarget,
        exclude: [
          /\/node_modules/,
          /\.css$/,
          // react router related
          /\?__react-router-build-client-route/,
          /\.server\.tsx?$/,
          // /entry\/client\.tsx?$/,
          /.*\/locales/,
          /packages\/lib\/src\/hooks\/.*/,
          /packages\/lib\/src\/ui\/.*/,
          /packages\/sqlite/,
          /packages\/cms/,
          /packages\/fx\/.*/,
          /.*\/server/,
          /.*\/db/,
          /client\/worker-runner\.ts/,
          /client\/worker-pool\.ts/,
          /client\/api-client\.ts/,
        ],
        include: [/(hooks|components|ui|atom)\/.*\.tsx?/, /hooks\.tsx?$/, /packages\/sqlite\/src\/.*\.ts/, /.*\.tsx/],
      }),

    isDev && !isServerTarget && mkcert(),

    svgrPlugin(),

    isAnalyze &&
      (visualizer({
        projectRoot,
        brotliSize: true,
        title: isServerTarget ? 'Server Bundle Visualizer' : 'Client Bundle Visualizer',
        filename: join(projectPath, isServerTarget ? 'analyze-server.html' : 'analyze-client.html'),
        gzipSize: true,
        open: false,
        template: 'treemap', // or sunburst
      }) as any),
  ].filter(Boolean)

  const publicAlts = [
    join(projectPath, 'public/manifest.webmanifest'),
    join(projectRoot, 'client', 'public/manifest.webmanifest'),
    join(projectRoot, 'shared', 'public/manifest.webmanifest'),
  ]

  if (!isDev && !isServerTarget) {
    let manifestPath = ''
    while (publicAlts.length) {
      const publicPath = publicAlts.shift()
      if (publicPath && existsSync(publicPath)) {
        manifestPath = publicPath
        break
      }
    }
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))

    const pwaOptions: Partial<VitePWAOptions> = {
      base: '/',
      includeAssets: ['logo', 'locales', 'fonts', 'images'],
      manifest: {
        ...manifest,
        name: isProduction ? manifest.name : `${stage} ${manifest.name}`,
        short_name: isProduction ? manifest.short_name : `${stage} ${manifest.short_name}`,
      },
      mode: 'production',
      scope: '/',
      minify: isMinify,
      injectRegister: null,
      registerType: 'prompt',
      srcDir: projectPath,
      strategies: 'injectManifest',
      filename: 'sw.ts',
      buildBase: '/',
      includeManifestIcons: false,
      injectManifest: {
        globPatterns: ['assets/*.{svg,png,js,css,wasm}', 'fonts/*', 'images/*', 'logo/**', '*.{png,svg,ico}'],
        globDirectory: join(projectOutput, 'client'),
        globIgnores: ['**/node_modules/**/*'],
        minify: false,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        target: buildTarget,
        buildPlugins: {
          rollup: [
            {
              name: 'replace-env',
              transform: {
                filter: {
                  id: /.ts$/,
                },
                handler(code: string) {
                  return code
                    .replace('process.env.NODE_ENV', JSON.stringify(process.env.NODE_ENV))
                    .replace('process.env.STAGE', JSON.stringify(stage))
                    .replace('define_process_env_default.STAGE', JSON.stringify(stage))
                },
              } as any,
            },
          ],
        },
        rollupOptions: {
          treeshake: true,
        },
      },
      workbox: {
        mode: 'production',
        disableDevLogs: true,
        babelPresetEnvTargets: browsersTarget,
      },
    }

    plugins.push(VitePWA(pwaOptions))
  }

  if (isDev && options?.checker !== false) {
    plugins.push(
      checker({
        typescript: {
          tsconfigPath: 'tsconfig.check.json',
          useNative: true,
        } as any,
        enableBuild: false,
        overlay: {
          initialIsOpen: false,
          panelStyle: 'opacity: 0.8; height: 90dvh; width: auto; inset: 5%;',
        },
        root: projectPath,
      }),
    )
  }

  const projectAlias = await getProjectAlias(projectLocation)

  const alias: Record<string, string> = {
    ...projectAlias,
    lodash: 'lodash-es',
    ...options?.alias,
  }

  if (isProduction) {
    alias['react-router/dom'] = join(workspaceRoot, 'node_modules/react-router/dist/production/dom-export.mjs')
    alias['react-router'] = join(workspaceRoot, 'node_modules/react-router/dist/production/index.mjs')
  }

  const hmrConfig: HmrOptions = isDesktop
    ? {
        overlay: true,
        path: '/vite-hmr',
      }
    : {
        overlay: true,
        clientPort: 443,
        port: port + 1,
        path: '/vite-hmr',
      }

  if (isProduction && !isServerTarget) {
    plugins.push(workerChunkPlugin())
  }

  const warmup = {
    clientFiles: [`${projectRoot}/shared/**/*.{ts,tsx}`],
    ssrFiles: [`${projectPath}/**/*.{ts,tsx}`, `${projectRoot}/server/**/*.{ts,tsx}`],
  }

  const config = defineConfig({
    root: projectPath,
    cacheDir: join(workspaceRoot, `node_modules/.vite/${projectLocation}`),
    envPrefix: ['VITE_'],
    envDir: false,
    logLevel: 'warn',
    server: {
      cors: false,
      fs: {
        allow: [join(workspaceRoot, 'node_modules'), packagesDir, projectRoot],
      },
      watch: {
        ignored: [
          'dist',
          '.direnv',
          'logs',
          'private',
          'scratchpad',
          'infra',
          'scripts',
          '**/coverage',
          '**/build',
          '**/e2e',
          '**/fixtures',
          '**/test',
          '**/tests',
          '**/.DS_Store',
          '**/wrangler.jsonc',
          '**/*.tsbuildinfo',
          '**/*.react-router',
        ],
      },
      allowedHosts: true,
      hmr: hmrConfig,
      port,
      warmup,
    },
    build: {
      cssTarget: buildTarget,
      target: buildTarget,
      minify: isServerTarget ? false : isMinify ? 'oxc' : false,
      cssMinify: isDev ? false : 'lightningcss',
      emptyOutDir: false,
      reportCompressedSize: false,
      modulePreload: false,
      rolldownOptions: {
        external: [/^cloudflare:/, /^node:/, isServerTarget ? 'react-router' : undefined].filter(Boolean),
        resolve: {
          alias,
          mainFields: ['browser', 'module', 'main'],
        },
        platform: 'browser',
        experimental: {
          attachDebugInfo: isDev ? 'simple' : 'none',
        },
        optimization: {
          inlineConst: true,
        },
        transform: {
          target: 'esnext',
          jsx: {
            development: !isProduction && !isServerTarget,
            runtime: 'automatic',
          },
        },
        treeshake: true,
        output: {
          format: 'esm',
          keepNames: isMinify ? false : true,
          legalComments: 'none',
          esModule: true,
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
          ...(!isServerTarget ? { manualChunks } : {}),
        },
      },
    },
    optimizeDeps: {
      // A workaround for Vite bug: https://github.com/vitejs/vite/issues/13314#issuecomment-1560745780
      exclude: ['@effect-x/wa-sqlite'],
      // Another workaround for Vite bug: https://github.com/radix-ui/primitives/discussions/1915#discussioncomment-5733178
      include: ['react-dom', 'react/jsx-runtime'],
    },
    worker: {
      format: 'es',
    },
    resolve: {
      alias,
      mainFields: ['browser', 'module', 'main'],
    },
    plugins,
    experimental: { enableNativePlugin: true },
  } as UserConfig)

  return mergeConfig(config, options?.vite ?? {})
}

const manualChunks = (id: string) => {
  if (
    [
      'packages/otel/src/session',
      'shared/config',
      'react-router/src/cookie',
      'vite/dynamic-import-helper.js',
      'vite/preload-helper.js',
      'commonjsHelpers.js',
    ].some((_) => id.includes(_))
  ) {
    return 'entry'
  }

  if (['i18next', 'accept-language-parser'].some((_) => id.includes(`node_modules/${_}`))) {
    return 'i18n'
  }

  if (
    [
      '@opentelemetry',
      'nanoid',
      'uuid',
      'clsx',
      'tailwind-merge',
      'class-variance-authority',
      'temporal-polyfill',
      'ua-parser-js',
      'scheduler',
    ].some((_) => id.includes(`node_modules/${_}`))
  ) {
    return 'vendor'
  }

  if (
    [
      'framer-motion',
      '@ebay/nice-modal-react',
      'sonner',
      'react-i18next',
      'react',
      'react-dom',
      'react-is',
      'react-jsx-runtim',
      'react-compiler-runtime',
      'react-router',
      '@effect-atom/atom',
      'ahooks',
      '@radix-ui',
      'cmdk',
      'vaul',
      'react-hook-form',
      'react-hotkeys-hook',
      'react-virtualized',
      'react-resizable-panels',
      '@tanstack/react-table',
      'recharts',
    ].some((_) => id.includes(`node_modules/${_}`)) ||
    [
      'packages/app/src/hooks',
      'packages/react-router/src/hooks',
      'packages/lib/src/utils',
      'packages/lib/src/hooks',
      // 'packages/lib/src/components/error-boundary',
      // 'packages/lib/src/components/errors',
      'packages/atom-react/src',
      'root.tsx',
    ].some((_) => id.includes(_))
  ) {
    return 'react'
  }

  if (
    ['/packages/otel/src'].some((_) => id.includes(_)) ||
    ['@effect/experimental', '@effect/opentelemetry', '@effect/platform-browser', '@effect/platform', 'effect'].some(
      (_) => id.includes(`node_modules/${_}`),
    )
  ) {
    return 'effect'
  }

  if (
    [
      '@effect/sql',
      '@effect-x/wa-sqlite',
      'kysely',
      'db/src',
      'sqlite/src',
      'sql-kysely/src',
      'otel/src/browser-worker',
      'react-router/src/context/browser-worker',
      'local-first/src/context',
      'local-first/src/worker',
      'event-log/src',
      'fx/src/schema',
      'fx/src/worker',
      'msgpack',
    ].some((_) => id.includes(_))
  ) {
    return 'effect-apps'
  }

  //
  if ([/runner\.ts$/, /-runner\.ts$/].some((_) => _.test(id))) {
    return 'runner'
  }
}
