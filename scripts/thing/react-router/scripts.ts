import { parse } from '@babel/core'
// @ts-ignore
import * as traverse from '@babel/traverse'
import { FileSystem, Path } from '@effect/platform'
import { Config, Data, Effect } from 'effect'
import * as R from 'remeda'
import { shellInPath } from '../utils'
import type { Workspace } from '../workspace'

type ReactRouterBuildEntry = {
  module: string
}

type ReactRouterBuildAssetsEntry = {
  module: string
  imports: string[]
  css: string[]
}

type ReactRouterBuildRoute = {
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

type ReactRouterBuild = {
  entry: ReactRouterBuildEntry
  future: Record<string, string>
  assets: {
    url: string
    version: string
    entry: ReactRouterBuildAssetsEntry
    routes: Record<string, ReactRouterBuildRoute>
  }
}
const stripAssets = (assets: any) =>
  ({
    url: assets.url,
    version: assets.version,
    entry: assets.entry,
    routes: stripRoutes(assets),
  }) satisfies ReactRouterBuild['assets']

const stripRoutes = (assets: any) => {
  const pick = (obj: any) => {
    return {
      id: obj.id,
      parentId: obj.parentId,
      path: obj.path || '',
      index: obj.index || false,
      caseSensitive: obj.caseSensitive || false,
      hasAction: obj.hasAction,
      hasLoader: obj.hasLoader,
      hasClientAction: obj.hasClientAction,
      hasClientLoader: obj.hasClientLoader,
      hasClientMiddleware: obj.hasClientMiddleware,
      hasErrorBoundary: obj.hasErrorBoundary,
      css: obj.css || [],
      module: obj.module,
      imports: obj.imports || [],
      clientActionModule: obj.clientActionModule,
      clientLoaderModule: obj.clientLoaderModule,
      clientMiddlewareModule: obj.clientMiddlewareModule,
      hydrateFallbackModule: obj.hydrateFallbackModule,
    }
  }

  const routes = Object.fromEntries(
    Object.entries(assets.routes).map(([key, value]) => {
      return [key, pick(value)]
    }),
  )

  return routes satisfies ReactRouterBuild['assets']['routes']
}

export const extractServerManifest = (content: string) => {
  // Parse the content into an AST
  const ast = parse(content, {
    sourceType: 'module',
  })

  // Object to store our extracted variables
  const extractedData: Record<string, any> = {}

  interface Node {
    type: string
    value: string
    elements: Node[]
    properties: any[]
  }

  // Function to extract literal values from AST nodes
  const extractLiteralValue = (node: Node): any => {
    if (!node) return undefined

    switch (node.type) {
      case 'StringLiteral':
      case 'NumericLiteral':
      case 'BooleanLiteral':
        return node.value
      case 'NullLiteral':
        return null
      case 'Undefined':
        return undefined
      case 'UnaryExpression':
        // Handle void 0 (undefined)
        if ((node as any).operator === 'void' && (node as any).argument?.value === 0) {
          return undefined
        }
        return undefined
      case 'ObjectExpression': {
        const obj: Record<string, any> = {}
        node.properties.forEach((prop) => {
          if (prop.type === 'ObjectProperty' && !prop.computed) {
            const key = prop.key.name || prop.key.value
            obj[key] = extractLiteralValue(prop.value)
          }
        })
        return obj
      }
      case 'ArrayExpression':
        return node.elements.map(extractLiteralValue)
      default:
        return undefined
    }
  }

  // Traverse the AST
  traverse.default(ast, {
    VariableDeclarator(path: any) {
      const name = path.node.id.name
      if (['server_manifest_default', 'future'].includes(name)) {
        extractedData[name] = extractLiteralValue(path.node.init)
      }
    },
    AssignmentExpression(path: any) {
      if (path.node.left.type === 'Identifier') {
        const name = path.node.left.name
        if (['server_manifest_default', 'future'].includes(name)) {
          extractedData[name] = extractLiteralValue(path.node.right)
        }
      }
    },
  })

  // Transform the new structure to match our expected ReactRouterBuild format
  const serverManifest = extractedData.server_manifest_default
  if (serverManifest) {
    // New structure already has entry, routes, url, version at top level
    // We need to reorganize it to match our ReactRouterBuild type
    return {
      entry: serverManifest.entry,
      future: extractedData.future || {},
      assets: {
        url: serverManifest.url,
        version: serverManifest.version,
        entry: serverManifest.entry,
        routes: stripRoutes({ routes: serverManifest.routes }),
      },
    } as ReactRouterBuild
  }

  // Fallback to old structure for backward compatibility
  extractedData.assets = extractedData.serverManifest

  delete extractedData.serverManifest

  return extractedData as ReactRouterBuild
}

export class ReactRouterPwaBuildTransformError extends Data.TaggedError('ReactRouterPwaBuildTransformError')<{
  cause?: Error | undefined
}> {}

const ReactRouterPwaConfig = Config.all({
  SANITY_STUDIO_PROJECT_ID: Config.string('SANITY_STUDIO_PROJECT_ID'),
  SANITY_STUDIO_DATASET: Config.string('SANITY_STUDIO_DATASET'),
  NODE_ENV: Config.string('NODE_ENV'),
  STAGE: Config.string('STAGE'),
})

export const fixPwaSwScript = Effect.fn('build.fix-pwa-script')(function* (
  workspace: Workspace,
  { minify }: { minify: boolean },
) {
  const path = yield* Path.Path
  const fs = yield* FileSystem.FileSystem

  const swPath = path.join(workspace.projectOutput.dist, 'client/sw.js')
  let swContent = yield* fs.readFileString(swPath, 'utf8')

  const reactRouterBuildPath = path.join(workspace.projectOutput.dist, 'server/index.js')
  const reactRouterBuildContent = yield* fs.readFileString(reactRouterBuildPath, 'utf8')
  const reactRouterBuild = yield* Effect.try(() => extractServerManifest(reactRouterBuildContent))

  const { SANITY_STUDIO_PROJECT_ID, SANITY_STUDIO_DATASET, NODE_ENV, STAGE } = yield* ReactRouterPwaConfig
  // replace react-router build
  // fix manifest-[version].js
  const version = reactRouterBuild.assets.version
  const manifestScriptUrl = reactRouterBuild.assets.url

  const MANIFEST_CUSTOM = JSON.stringify([
    {
      url: '/?shell=true',
      revision: version,
    },
    {
      url: manifestScriptUrl,
      revision: version,
    },
  ])

  swContent = swContent
    .replace(
      'self.__REACT_ROUTER_BUILD',
      JSON.stringify({
        entry: { module: reactRouterBuild.assets.entry.module },
        assets: stripAssets(reactRouterBuild.assets),
        future: reactRouterBuild.future,
      } satisfies ReactRouterBuild),
    )
    .replace('self.__MANIFEST_VERSION', JSON.stringify(version))
    .replace('self.__MANIFEST_CUSTOM', MANIFEST_CUSTOM)

  // const MANIFEST = [
  //  ...
  // ];
  // const xxxx = [];
  // try get manifest from react-router build, use json.parse
  const manifestString = (swContent.match(/var\sMANIFEST\s=\s\[([\s\S]*?)\];/)?.[0] || '')
    .replace(/var\sMANIFEST\s=\s/, '')
    .replace(/revision:\s/g, `"revision": `)
    .replace(/url:\s/g, `"url": `)
    .replace(/",\n\s\s}/g, `"\n}`)
    .replace(/\},\n\];/, '}\n]')
    .replace(/\}\];/, '}]')

  const manifest: Array<{ revision: string; url: string }> = JSON.parse(manifestString)
  // unique by url
  const uniqueManifest = R.uniqueBy(manifest, (_) => _.url)

  // unique wasm file
  // { "revision": null, "url": "assets/wa-sqlite-BkB4z1it.wasm" }
  // { "revision": null, "url": "assets/wa-sqliteBkB4z1it.wasm" }
  // use wa-sqlite-xxxx.wasm spec
  const removePath: string[] = []
  uniqueManifest.forEach((item, index) => {
    if (item.url.endsWith('.wasm')) {
      if (item.url.match(/wa-sqlite\w+/)) {
        // remove
        uniqueManifest.splice(index, 1)
        removePath.push(`./client/${item.url}`)
      }
    }
  })

  yield* shellInPath(workspace.projectOutput.dist)`$ rm -rf ${removePath.join(' ')}`

  const newContent = swContent
    .replace(/const\sMANIFEST\s=\s\[([\s\S]*?)\];/g, `const MANIFEST = ${JSON.stringify(uniqueManifest, null, 2)};`)
    .replace(/globalThis\.SANITY_STUDIO_PROJECT_ID/g, `"${SANITY_STUDIO_PROJECT_ID}"`)
    .replace(/globalThis\.SANITY_STUDIO_DATASET/g, `"${SANITY_STUDIO_DATASET}"`)
    .replace(/globalThis\.NODE_ENV/g, `"${NODE_ENV}"`)
    .replace(/globalThis\.STAGE/g, `"${STAGE}"`)

  yield* fs.writeFileString(swPath, newContent)

  const bundler = yield* Effect.tryPromise({
    try: () => import('rolldown'),
    catch: () => new Error('rolldown not found'),
  }).pipe(Effect.orDie)

  const tsconfigPath = path.join(workspace.projectPath, 'tsconfig.json')
  const outputFilePath = `${workspace.projectOutput.dist}/client/sw.js`

  yield* Effect.promise(() =>
    bundler.build({
      input: swPath,
      write: true,
      platform: 'browser',
      tsconfig: tsconfigPath,
      optimization: {
        inlineConst: true,
      },
      resolve: {
        mainFields: ['browser', 'module', 'main'],
      },
      transform: {
        target: 'esnext',
        define: {
          'process.env.NODE_ENV': JSON.stringify(NODE_ENV),
          'process.env.STAGE': JSON.stringify(STAGE),
        },
      },
      treeshake: true,
      output: {
        keepNames: minify ? false : true,
        file: outputFilePath,
        format: 'esm',
        legalComments: 'none',
        minify: minify
          ? true
          : {
              codegen: { removeWhitespace: false },
              compress: {
                keepNames: {
                  class: true,
                  function: true,
                },
                target: 'esnext',
              },
              mangle: false,
            },
        esModule: true,
      },
    }),
  )
})
