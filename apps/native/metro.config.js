const { withNxMetro } = require('@nx/expo')
const { getDefaultConfig } = require('@expo/metro-config')
const { mergeConfig } = require('metro-config')
const makeResolver = require('@rnx-kit/metro-resolver-symlinks')
const { makeMetroConfig } = require('@rnx-kit/metro-config')
const path = require('node:path')
const { parseModuleRef } = require('@rnx-kit/tools-node/module')
const { withNativeWind } = require('nativewind/metro')

const make = (dirname) => {
  const defaultConfig = getDefaultConfig(dirname, {
    isCSSEnabled: true,
  })
  const { assetExts, sourceExts } = defaultConfig.resolver

  /**
   * Metro configuration
   * https://reactnative.dev/docs/metro
   *
   * @type {import('metro-config').MetroConfig}
   */
  const customConfig = {
    cacheVersion: 'native',
    transformer: {
      getTransformOptions: async () => ({
        transform: {
          experimentalImportSupport: false,
          inlineRequires: true,
        },
      }),
      babelTransformerPath: require.resolve('react-native-svg-transformer'),
    },
    resolver: {
      assetExts: assetExts.filter((ext) => ext !== 'svg'),
      sourceExts: [...sourceExts, 'cjs', 'mjs', 'svg'],
      resolverMainFields: ['react-native', 'browser', 'main'],
    },
  }

  const ios = defaultConfig.projectRoot
  const iosNodeModules = path.join(ios, 'node_modules')
  const macos = `${defaultConfig.projectRoot}-macos`
  const macosNodeModules = path.join(macos, 'node_modules')
  const _macReactVersion = '19.1.0'

  const tryAbsoluteResolve = (context, moduleName, platform, paths) => {
    const dir = path.dirname(context.originModulePath)
    const file = path.join(dir, moduleName)

    let filePath = ''
    try {
      filePath = require.resolve(file, { paths })
    } catch {
      let fixName = ''
      const hasAnyExt = file.endsWith('.js') || file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.jsx')
      if (!hasAnyExt) {
        fixName = `${file}.${platform}.js`
      }
      filePath = require.resolve(fixName, { paths })
    }

    return {
      type: 'sourceFile',
      filePath: filePath,
    }
  }

  const pkgResolvedPaths = new Map()

  const fixReanimatedImportPath = (context, _moduleName, _platform, paths) => {
    // parse originModulePath
    //  /Users/name/project/node_modules/.pnpm/react-native-reanimated@3.17.5_@babel+core@7.27.1_react-native@0.79.2_patch_hash=f552da_e5c3b941e27fc9d0f8c07c9a8e761274/node_modules/react-native-reanimated/src/index.ts
    const lastIndex = context.originModulePath.lastIndexOf('/node_modules/')
    // /node_modules/react-native-reanimated/src/index.ts
    const requirePath = context.originModulePath.slice(lastIndex, context.originModulePath.length)
    // react-native-reanimated
    const pkgName = requirePath.split('/').slice(2, 3).join('')
    let pkgRoot = ''
    if (pkgResolvedPaths.has(pkgName)) {
      pkgRoot = pkgResolvedPaths.get(pkgName)
    } else {
      // /Users/name/project/node_modules/.pnpm/react-native-reanimated@3.17.5_@babel+core@7.27.1_react-native@0.79.2_patch_hash=f552da_e5c3b941e27fc9d0f8c07c9a8e761274/node_modules/react-native-reanimated/lib/module'
      const entry = require.resolve(pkgName, { paths })
      const nodeModulesIndex = entry.lastIndexOf('/node_modules/')
      // /Users/name/project/node_modules/.pnpm/react-native-reanimated@3.17.5_@babel+core@7.27.1_react-native@0.79.2_patch_hash=f552da_e5c3b941e27fc9d0f8c07c9a8e761274
      pkgRoot = entry.slice(0, nodeModulesIndex)
      pkgResolvedPaths.set(pkgName, pkgRoot)
    }

    context.originModulePath = `${pkgRoot}${requirePath}`
  }

  const fixDuplicateImportPath = (context, moduleName, _platform, paths) => {
    const isPkg = !moduleName.startsWith('.')
    // parse originModulePath
    // /Users/name/project/node_modules/.pnpm/react-native-reanimated@3.17.5_@babel+core@7.27.1_react-native@0.79.2_patch_hash=f552da_e5c3b941e27fc9d0f8c07c9a8e761274/node_modules/react-native-reanimated/src/index.ts
    const lastIndex = context.originModulePath.lastIndexOf('/node_modules/')
    // /node_modules/react-native-reanimated/src/index.ts
    const requirePath =
      lastIndex === -1
        ? ''
        : context.originModulePath.slice(lastIndex, context.originModulePath.length).replace('/node_modules/', '')
    // react-native-reanimated
    let pkgName = ''
    if (requirePath) {
      /**
       * name ='virtualized-lists'
       * path ='Lists/VirtualizedListContext.js'
       * scope = '@react-native'
       */
      const parsed = parseModuleRef(requirePath)
      pkgName = parsed.scope ? `${parsed.scope}/${parsed.name}` : parsed.name
    } else {
      // 'react-native-css-interop/jsx-runtime'
      const parsed = parseModuleRef(moduleName)
      pkgName = parsed.scope ? `${parsed.scope}/${parsed.name}` : parsed.name
    }
    let pkgRoot = ''
    if (pkgResolvedPaths.has(pkgName)) {
      pkgRoot = pkgResolvedPaths.get(pkgName)
    } else {
      // /Users/name/project/node_modules/.pnpm/react-native-reanimated@3.17.5_@babel+core@7.27.1_react-native@0.79.2_patch_hash=f552da_e5c3b941e27fc9d0f8c07c9a8e761274/node_modules/react-native-reanimated/lib/module'
      const entry = require.resolve(pkgName, { paths })
      const nodeModulesIndex = entry.lastIndexOf('/node_modules/')
      // /Users/name/project/node_modules/.pnpm/react-native-reanimated@3.17.5_@babel+core@7.27.1_react-native@0.79.2_patch_hash=f552da_e5c3b941e27fc9d0f8c07c9a8e761274
      pkgRoot = entry.slice(0, nodeModulesIndex)
      pkgResolvedPaths.set(pkgName, pkgRoot)
    }

    if (isPkg) {
      const pkgPath = require.resolve(moduleName, { paths })

      return {
        type: 'sourceFile',
        filePath: pkgPath,
      }
    }

    const pkgPath = path.join(pkgRoot, 'node_modules', path.dirname(requirePath), moduleName)

    const r = {
      type: 'sourceFile',
      filePath: require.resolve(pkgPath, { paths }),
    }
    return r
  }

  const nxConfig = withNxMetro(mergeConfig(defaultConfig, customConfig), {
    // Change this to true to see debugging info.
    // Useful if you have issues resolving modules
    debug: false,
    // all the file extensions used for imports other than 'ts', 'tsx', 'js', 'jsx', 'json'
    extensions: [],
    // Specify folders to watch, in addition to Nx defaults (workspace libraries and node_modules)
    watchFolders: [],
  })

  const symlinksResolver = makeResolver()

  /**
   * Metro configuration
   *
   * @type {import('metro-config').MetroConfig}
   */
  const finallyConfig = mergeConfig(nxConfig, {
    resolver: {
      /**
       * @type {import('metro-config').ResolverConfigT['resolveRequest']}
       */
      resolveRequest: (context, oldName, platform) => {
        const resolver = (...args) => {
          const resolved = symlinksResolver(...args) || nxConfig.resolver.resolveRequest(...args)
          if (!resolved) {
            throw new Error(`module not found: ${moduleName}`)
          }
          return resolved
        }

        const tryRequireResolve = (context, moduleName, platform, paths) => {
          let r
          try {
            const filePath = require.resolve(moduleName, { paths })
            r = {
              type: 'sourceFile',
              filePath: filePath,
            }
          } catch {
            r = resolver(context, moduleName, platform)
          }
          return r
        }

        const moduleName = oldName
        if (platform === 'macos') {
          const nodeModulesPaths = Array.from(new Set([macosNodeModules, ...context.nodeModulesPaths]))

          const modules = context.extraNodeModules || {}
          if (modules['react-native']) {
            modules['react-native'] = require.resolve('react-native-macos', { paths: nodeModulesPaths })
            modules['react-native-macos'] = modules['react-native']
          }

          context.nodeModulesPaths = nodeModulesPaths

          if (moduleName === 'react-native' || moduleName.startsWith('react-native/')) {
            const newModuleName = moduleName.replace('react-native', 'react-native-macos')
            return tryRequireResolve(context, newModuleName, platform, nodeModulesPaths)
          }

          if (context.originModulePath.includes('/node_modules/react-native-macos') && moduleName.startsWith('.')) {
            return tryAbsoluteResolve(context, moduleName, platform, nodeModulesPaths)
          }
          if (
            context.originModulePath.includes('/node_modules/react-native-reanimated') &&
            moduleName.startsWith('.')
          ) {
            fixReanimatedImportPath(context, moduleName, platform, nodeModulesPaths)
            return resolver(context, moduleName, platform)
          }

          const fixPkgs = ['@react-native/assets-registry', 'react-native-css-interop']
          if (
            (fixPkgs.some((_) => context.originModulePath.includes(`/node_modules/${_}`)) &&
              moduleName.startsWith('.')) ||
            fixPkgs.some((_) => moduleName.startsWith(_))
          ) {
            if (moduleName.indexOf('./web/interopComponentsMap') > -1) {
              return { type: 'empty' }
            }
            return fixDuplicateImportPath(
              context,
              moduleName.replace('./web/', './native/').replace('./doctor', './doctor.native'),
              platform,
              nodeModulesPaths,
            )
          }
        } else {
          const nodeModulesPaths = Array.from(new Set([iosNodeModules, ...context.nodeModulesPaths]))

          const modules = context.extraNodeModules || {}
          if (modules['react-native']) {
            modules['react-native'] = require.resolve('react-native', { paths: nodeModulesPaths })
            modules['react-native-macos'] = undefined
          }

          context.nodeModulesPaths = nodeModulesPaths

          if (moduleName === 'react-native' || moduleName.startsWith('react-native/')) {
            return tryRequireResolve(context, moduleName, platform, nodeModulesPaths)
          }

          if (
            context.originModulePath.includes('/node_modules/react-native-reanimated') &&
            moduleName.startsWith('.')
          ) {
            fixReanimatedImportPath(context, moduleName, platform, nodeModulesPaths)
            return resolver(context, moduleName, platform)
          }

          const fixPkgs = ['@react-native/assets-registry', 'react-native-css-interop']
          if (
            (fixPkgs.some((_) => context.originModulePath.includes(`/node_modules/${_}`)) &&
              moduleName.startsWith('.')) ||
            fixPkgs.some((_) => moduleName.startsWith(_))
          ) {
            if (moduleName.indexOf('./web/interopComponentsMap') > -1) {
              return { type: 'empty' }
            }
            return fixDuplicateImportPath(
              context,
              moduleName.replace('./web/', './native/').replace('./doctor', './doctor.native'),
              platform,
              nodeModulesPaths,
            )
          }
        }

        if (moduleName === 'msgpackr') {
          return resolver(context, 'msgpackr', platform)
        }

        if (moduleName === 'crypto') {
          return resolver(context, 'react-native-quick-crypto', platform)
        }

        if (moduleName === 'buffer' || moduleName === 'node:buffer') {
          return resolver(context, '@craftzdog/react-native-buffer', platform)
        }

        if (moduleName === 'stream') {
          return resolver(context, 'readable-stream', platform)
        }

        return resolver(context, moduleName, platform)
      },
    },
  })

  finallyConfig.resolver.extraNodeModules = {
    ...finallyConfig.resolver.extraNodeModules,
    buffer: require.resolve('@craftzdog/react-native-buffer'),
    stream: require.resolve('readable-stream'),
    // path: require.resolve('path-browserify'),
    // http: require.resolve('stream-http'),
    // https: require.resolve('https-browserify'),
    // net: require.resolve('react-native-tcp-socket'),
    // tls: require.resolve('react-native-tcp-socket'),
    // zlib: require.resolve('browserify-zlib'),
  }

  const v2 = makeMetroConfig(finallyConfig)

  // reject list
  const rejectList = [/\/coverage/, /\/docs/, /\/patches/, /\/scratchpad/, /\/scripts/]
  v2.watchFolders = v2.watchFolders.filter((path) => !rejectList.some((_) => _.test(path)))

  const originalGetModulesRunBeforeMainModule = v2.serializer.getModulesRunBeforeMainModule
  v2.serializer.getModulesRunBeforeMainModule = (entryFilePath) => {
    if (entryFilePath.includes('macos')) {
      const macos = require.resolve('react-native-macos/Libraries/Core/InitializeCore', {
        paths: [macosNodeModules],
      })
      const original = originalGetModulesRunBeforeMainModule(entryFilePath)

      return [...original.slice(0, 1), macos, ...original.slice(1)]
    }

    return originalGetModulesRunBeforeMainModule(entryFilePath)
  }

  return withNativeWind(v2, { input: './global.css' })
}

module.exports = make(__dirname)
