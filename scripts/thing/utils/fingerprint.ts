import { SourceSkips, createFingerprintAsync, type HashSource, type Options } from '@expo/fingerprint'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { globSync } from 'tinyglobby'

/**
 * Utility function that takes an array of extensions and generates glob patterns to allow those extensions.
 * @param extensions Array of allowed extensions (e.g., ["*.swift", "*.kt", "*.java"])
 * @returns Array of glob patterns
 */
function allowExtensions(extensions: string[]) {
  return extensions.map((ext) => `!**/${ext}`)
}

/**
 * Utility function that returns the default ignore paths.
 * @returns Array of default ignore paths
 */
function getDefaultIgnorePaths() {
  return ['**/*', '**/.build/**/*', '**/build/']
}

/**
 * Processes extra source files and directories for fingerprinting.
 * @param extraSources Array of file paths, directory paths, or glob patterns
 * @param cwd Current working directory for resolving paths
 * @returns Array of processed sources with their contents or directory information
 */
function processExtraSources(extraSources: string[], cwd: string): HashSource[] {
  const processedSources: HashSource[] = []
  for (const source of extraSources)
    try {
      const matches = globSync(source, {
        cwd,
        ignore: [],
        absolute: true,
        onlyFiles: false,
      })
      for (const absolutePath of matches)
        if (fs.existsSync(absolutePath)) {
          const stats = fs.statSync(absolutePath)
          const relativePath = path.relative(cwd, absolutePath)
          if (stats.isDirectory())
            processedSources.push({
              type: 'dir',
              filePath: relativePath,
              reasons: ['custom-user-config'],
            })
          else
            processedSources.push({
              type: 'contents',
              id: relativePath,
              contents: fs.readFileSync(absolutePath, 'utf-8'),
              reasons: ['custom-user-config'],
            })
        }
    } catch (error) {
      console.warn(`Error processing extra source "${source}": ${error}`)
    }
  return processedSources
}

function getOtaFingerprintOptions(
  platform: 'ios' | 'android',
  path: string,
  options: {
    ignorePaths?: string[] | undefined
    extraSources?: string[] | undefined
    debug?: boolean | undefined
    silent?: boolean | undefined
  },
): Options {
  return {
    useRNCoreAutolinkingFromExpo: false,
    platforms: [platform],
    ignorePaths: [
      ...getDefaultIgnorePaths(),
      ...allowExtensions([
        '*.swift',
        '*.h',
        '*.m',
        '*.mm',
        '*.kt',
        '*.java',
        '*.cpp',
        '*.hpp',
        '*.c',
        '*.cc',
        '*.cxx',
        '*.podspec',
        '*.gradle',
        '*.kts',
        'CMakeLists.txt',
        'Android.mk',
        'Application.mk',
        '*.pro',
        '*.mk',
        '*.cmake',
        '*.ninja',
        'Makefile',
        '*.bazel',
        '*.buck',
        'BUILD',
        'WORKSPACE',
        'BUILD.bazel',
        'WORKSPACE.bazel',
      ]),
      'android/**/*',
      'ios/**/*',
      ...(options.ignorePaths ?? []),
    ],
    sourceSkips:
      SourceSkips.GitIgnore |
      SourceSkips.PackageJsonScriptsAll |
      SourceSkips.PackageJsonAndroidAndIosScriptsIfNotContainRun |
      SourceSkips.ExpoConfigAll |
      SourceSkips.ExpoConfigVersions |
      SourceSkips.ExpoConfigNames |
      SourceSkips.ExpoConfigRuntimeVersionIfString |
      SourceSkips.ExpoConfigAssets |
      SourceSkips.ExpoConfigExtraSection |
      SourceSkips.ExpoConfigEASProject |
      SourceSkips.ExpoConfigSchemes,
    extraSources: processExtraSources(options.extraSources ?? [], path),
    debug: options.debug ?? false,
    silent: options.silent ?? true,
  }
}

export type FingerprintMode = 'ota' | 'native'

interface FingerprintOptions {
  platform?: 'ios' | 'android'
  debug?: boolean | undefined
  silent?: boolean | undefined
  mode?: FingerprintMode
  ignorePaths?: string[]
  extraSources?: string[]
}

export const createFingerprint = async (projectPath: string, inputOptions?: FingerprintOptions) => {
  const { mode = 'ota', platform = 'ios', ...options } = inputOptions ?? {}

  if (mode === 'native') {
    return await createFingerprintAsync(projectPath, {
      platforms: [platform],
      debug: options.debug ?? false,
      silent: options.silent ?? true,
    })
  }

  // const fingerprintConfig: any = (await import('../../apps/native/hot-updater.config')).default

  return await createFingerprintAsync(
    projectPath,
    getOtaFingerprintOptions(platform, projectPath, {
      // ...fingerprintConfig,
      ...options,
    }),
  )
}
