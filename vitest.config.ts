import * as dotenv from '@dotenvx/dotenvx'
import { playwright } from '@vitest/browser-playwright'
import { existsSync, readdirSync } from 'node:fs'
import { workspaceRoot } from '@nx/devkit'
import { join } from 'node:path'
import { globSync } from 'tinyglobby'
import { tsImport } from 'tsx/esm/api'
import {
  defineConfig,
  mergeConfig,
  Plugin,
  TestProjectConfiguration,
  TestUserConfig,
  ViteUserConfig,
} from 'vitest/config'
import { ALIAS_DEFINITIONS } from './project-manifest'
import { getProjectAlias } from './scripts/generate-tsconfig/alias'

process.env.TEST = 'true'

// Flag to control logging output - only log when running directly via CLI
const IS_CLI_MODE = import.meta.url === `file://${process.argv[1]}`

// Unified log function that only outputs in CLI mode
const log = (...args: any[]) => {
  if (IS_CLI_MODE) {
    console.log(...args)
  }
}

// Browser test configuration
const browserConfig: TestUserConfig['browser'] = {
  enabled: true,
  provider: playwright({
    launchOptions: {
      slowMo: 50,
    },
    actionTimeout: 5_000,
  }),
  instances: [
    {
      browser: 'chromium',
      provider: playwright(),
    },
    {
      browser: 'firefox',
      provider: playwright({
        launchOptions: {
          firefoxUserPrefs: {
            'browser.startup.homepage': 'https://example.com',
          },
        },
      }),
    },
    {
      browser: 'webkit',
      provider: playwright(),
    },
  ],
}

const getVitestConfig = (
  config: Partial<TestUserConfig>,
  _: {
    projectDir: string
    projectPath: string
  },
): TestUserConfig => {
  return {
    passWithNoTests: true,
    isolate: false,
    silent: false,
    hookTimeout: 15_000,
    testTimeout: 15_000,
    fakeTimers: {
      toFake: undefined,
    },
    setupFiles: [join(workspaceRoot, 'packages', 'testing', 'src', 'test-setup.ts'), ...(config.setupFiles ?? [])],
    root: _.projectPath,
    globals: false,
    coverage: {
      provider: 'v8',
      reportsDirectory: join(workspaceRoot, 'coverage', _.projectDir),
      reporter: ['html-spa', 'lcov', 'text-summary'],
      exclude: ['fixtures/**', 'build/**', '**/*.{test,spec}.{ts,tsx}'],
    },
    ...config,
  }
}

const defaultBrowsersLists = ['chrome141', 'firefox144', 'safari26']

const getViteConfig = (
  alias: Record<string, string>,
  _: {
    projectDir: string
    projectPath: string
  },
  config: Partial<ViteUserConfig> = {},
): ViteUserConfig =>
  mergeConfig(
    {
      root: _.projectPath,
      cacheDir: join(workspaceRoot, `node_modules/.vitest/${_.projectDir}`),
      build: {
        target: defaultBrowsersLists,
        cssTarget: defaultBrowsersLists,
        modulePreload: false,
        rolldownOptions: {
          external: [/^cloudflare:/, /^node:/],
          resolve: {
            alias,
            mainFields: ['browser', 'module', 'main'],
          },
          platform: 'browser',
          experimental: {
            attachDebugInfo: 'simple',
          },
          optimization: {
            inlineConst: true,
          },
          transform: {
            target: 'esnext',
            jsx: {
              development: true,
              runtime: 'automatic',
            },
          },
          treeshake: true,
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
      experimental: { enableNativePlugin: true },
    } satisfies ViteUserConfig,
    config,
  )

const APP_CONFIG_HINT_FILES = [
  'tsconfig.json',
  'tsconfig.app.json',
  'tsconfig.build.json',
  'tsconfig.lib.json',
  'package.json',
  'project.json',
  'vite.config.ts',
] as const
const APP_CONFIG_HINT_DIRS = ['tests', 'e2e'] as const
const SKIPPED_NESTED_DIRS = new Set(['node_modules', 'dist', 'build', '.git', '.output'])
const MAX_NESTED_APP_SCAN_DEPTH = 3

/**
 * Add test projects for a specific directory
 */
async function addTestProjectsForDir(
  projects: TestProjectConfiguration[],
  categoryTests: Map<string, { unit: string[]; e2e: string[]; browser: string[] }>,
  packageDir: string,
  packagePath: string,
  projectName: string,
  category: string,
): Promise<void> {
  log(`Scanning: ${packageDir} (${packagePath})`)

  const projectInfo = {
    projectDir: packageDir,
    projectPath: packagePath,
  }

  const alias: Record<string, string> = {}

  const plugins: ViteUserConfig['plugins'] = []
  let webAppViteConfig: Partial<ViteUserConfig> = {}

  const projectVitePath = join(packagePath, 'vite.config.ts')
  if (existsSync(projectVitePath)) {
    webAppViteConfig = await tsImport(projectVitePath, {
      parentURL: import.meta.filename,
      tsconfig: 'tsconfig.json',
    }).then((_) => _.default)
    if (webAppViteConfig.plugins && webAppViteConfig.plugins.length > 0) {
      webAppViteConfig.plugins = webAppViteConfig.plugins.filter((item) => {
        // react-router plugin
        if (Array.isArray(item) && item.some((_) => (_ as Plugin).name.indexOf('react-router') > -1)) {
          return false
        }

        const plugin = item as Plugin
        const rejectPlugins = ['vite-plugin-checker', 'vite:plugin:mkcert']
        return !rejectPlugins.includes(plugin.name)
      })
    }
    webAppViteConfig.server = undefined
    webAppViteConfig.cacheDir = undefined
    webAppViteConfig.logLevel = undefined
  } else {
    const projectAlias = await getProjectAlias(packageDir)
    Object.assign(alias, projectAlias)
    // TODO: Add common plugins if needed
  }

  const isInfra = packageDir.startsWith('infra')
  const isWebApp = packageDir.endsWith('/web') || packageDir.endsWith('/website') || packageDir.endsWith('/studio')

  const loadProjectEnv = () => {
    if (isInfra || isWebApp) {
      return dotenv.config({
        envKeysFile: join(workspaceRoot, '.env.keys'),
        path: [join(packagePath, '.env'), join(packagePath, '.env.local')],
        quiet: true,
        ignore: ['MISSING_ENV_FILE'],
        processEnv: {},
      }).parsed
    }

    return {}
  }

  // Initialize category tracking
  if (!categoryTests.has(category)) {
    categoryTests.set(category, { unit: [], e2e: [], browser: [] })
  }

  // Check for unit tests in tests/ directory
  const testsDir = join(packagePath, 'tests')
  if (existsSync(testsDir)) {
    const filePattern = 'tests/**/*.test.{ts,tsx}'
    const pattern = `${packageDir}/${filePattern}`
    log(`  Checking unit tests: ${pattern}`)
    if (hasTestFiles(pattern)) {
      log(`  ✓ Found unit tests`)
      const env = loadProjectEnv()

      const setupFiles: string[] = []
      const setupFile = join(testsDir, 'test.setup.ts')
      if (existsSync(setupFile)) {
        setupFiles.push(setupFile)
      }

      projects.push(
        mergeConfig(getViteConfig(alias, projectInfo, webAppViteConfig), {
          plugins,
          test: getVitestConfig(
            {
              env,
              name: `${category}-${projectName}:unit`,
              include: [filePattern],
              exclude: ['node_modules/**', 'fixtures/**', 'build/**', 'dist/**', '**/*.browser.test.{ts,tsx}'],
              environment: 'node',
              setupFiles,
            },
            projectInfo,
          ),
        }),
      )
      categoryTests.get(category)!.unit.push(pattern)
    }
  }

  // Check for e2e tests in e2e/ directory
  const e2eDir = join(packagePath, 'e2e')
  if (existsSync(e2eDir)) {
    const filePattern = 'e2e/**/*.test.{ts,tsx}'
    const pattern = `${packageDir}/${filePattern}`
    log(`  Checking e2e tests: ${pattern}`)
    if (hasTestFiles(pattern)) {
      log(`  ✓ Found e2e tests`)
      const env = loadProjectEnv()

      const setupFiles: string[] = []
      const setupFile = join(e2eDir, 'e2e.setup.ts')
      if (existsSync(setupFile)) {
        setupFiles.push(setupFile)
      }

      projects.push(
        mergeConfig(getViteConfig(alias, projectInfo, webAppViteConfig), {
          plugins,
          test: getVitestConfig(
            {
              env,
              name: `${category}-${projectName}:e2e`,
              include: [filePattern],
              exclude: ['node_modules/**', 'fixtures/**', 'build/**', 'dist/**', '**/*.browser.test.{ts,tsx}'],
              environment: 'node',
              testTimeout: 30_000,
              hookTimeout: 30_000,
              setupFiles,
            },
            projectInfo,
          ),
        }),
      )

      categoryTests.get(category)!.e2e.push(pattern)
    }
  }

  // Check for browser tests (they can be anywhere in the package)
  const filePattern = 'tests/**/*.browser.test.{ts,tsx}'
  const browserPattern = `${packageDir}/${filePattern}`
  log(`  Checking browser tests: ${browserPattern}`)
  if (hasTestFiles(browserPattern)) {
    log(`  ✓ Found browser tests`)
    const env = loadProjectEnv()

    const setupFiles: string[] = []
    const setupFile = join(testsDir, 'browser.setup.ts')
    if (existsSync(setupFile)) {
      setupFiles.push(setupFile)
    }

    projects.push(
      mergeConfig(getViteConfig(alias, projectInfo, webAppViteConfig), {
        plugins,
        test: getVitestConfig(
          {
            env,
            name: `${category}-${projectName}:browser`,
            include: [filePattern],
            exclude: ['node_modules/**', 'fixtures/**', 'build/**', 'dist/**'],
            browser: browserConfig,
            setupFiles,
          },
          projectInfo,
        ),
      }),
    )
    categoryTests.get(category)!.browser.push(browserPattern)
  }
}

/**
 * Scan application directories
 * These contain client, web, server, shared subdirectories
 */
async function scanApplicationDirs(
  projects: TestProjectConfiguration[],
  categoryTests: Map<string, { unit: string[]; e2e: string[]; browser: string[] }>,
): Promise<void> {
  const appDirs = ['apps', 'template']
  const processedDirs = new Set<string>()

  for (const appDir of appDirs) {
    const appPath = join(workspaceRoot, appDir)
    log(`\nScanning application directory: ${appDir}`)

    if (!existsSync(appPath)) {
      log(`  Directory does not exist: ${appPath}`)
      continue
    }

    // Get all applications in this directory
    const apps = readdirSync(appPath, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory() && dirent.name !== 'node_modules')
      .map((dirent) => dirent.name)

    log(`  Found apps: ${apps.join(', ')}`)

    for (const app of apps) {
      const relativeDir = `${appDir}/${app}`
      await scanAppNode(relativeDir, app, appDir, 0)
    }
  }

  async function scanAppNode(packageDir: string, projectName: string, category: string, depth: number): Promise<void> {
    const normalizedDir = packageDir.replace(/\\/g, '/')
    if (processedDirs.has(normalizedDir)) {
      return
    }
    processedDirs.add(normalizedDir)

    const packagePath = join(workspaceRoot, normalizedDir)
    if (!existsSync(packagePath)) {
      return
    }

    log(`  Scanning app: ${normalizedDir}`)

    const canHandleTests = await processApplicationNode(
      projects,
      categoryTests,
      normalizedDir,
      packagePath,
      projectName,
      category,
    )

    if (depth >= MAX_NESTED_APP_SCAN_DEPTH) {
      return
    }

    const nestedCandidates = readdirSync(packagePath, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory() && !shouldSkipNestedDir(dirent.name))
      .map((dirent) => dirent.name)
      .filter((dir) => {
        const nestedPath = join(packagePath, dir)
        if (hasAppConfig(nestedPath)) {
          return true
        }
        return !canHandleTests
      })

    if (nestedCandidates.length === 0) {
      return
    }

    log(`    Descending into nested apps: ${nestedCandidates.join(', ')}`)

    for (const nested of nestedCandidates) {
      const nestedDir = `${normalizedDir}/${nested}`
      const nestedProjectName = buildProjectName(projectName, nested)
      await scanAppNode(nestedDir, nestedProjectName, category, depth + 1)
    }
  }
}

/**
 * Get package directory from alias path
 * e.g., 'packages/atom-react/src' -> 'packages/atom-react'
 * e.g., 'infra/ratelimiter' -> 'infra/ratelimiter'
 */
function getPackageDir(aliasPath: string): string {
  const parts = aliasPath.split('/')
  // For paths like 'packages/xxx/src', remove '/src'
  if (parts[parts.length - 1] === 'src') {
    return parts.slice(0, -1).join('/')
  }
  return aliasPath
}

/**
 * Get project name from package directory
 * e.g., 'packages/atom-react' -> 'atom-react'
 * e.g., 'infra/ratelimiter' -> 'ratelimiter'
 */
function getProjectName(packageDir: string): string {
  const parts = packageDir.split('/')
  return parts[parts.length - 1]
}

/**
 * Get category from package directory
 * e.g., 'packages/atom-react' -> 'packages'
 * e.g., 'infra/ratelimiter' -> 'infra'
 */
function getCategory(packageDir: string): string {
  return packageDir.split('/')[0].replace('packages', 'pkgs')
}

/**
 * Check if test files exist in a directory
 */
function hasTestFiles(pattern: string, cwd: string = workspaceRoot): boolean {
  try {
    const files = globSync(pattern, {
      cwd,
      ignore: ['**/node_modules/**', '**/dist/**'],
    })
    return files.length > 0
  } catch {
    return false
  }
}

function hasAppConfig(dirPath: string): boolean {
  return (
    APP_CONFIG_HINT_FILES.some((file) => existsSync(join(dirPath, file))) ||
    APP_CONFIG_HINT_DIRS.some((dir) => existsSync(join(dirPath, dir)))
  )
}

function shouldSkipNestedDir(dirName: string): boolean {
  return SKIPPED_NESTED_DIRS.has(dirName) || dirName.startsWith('.')
}

function buildProjectName(base: string, segment: string): string {
  return base ? `${base}/${segment}` : segment
}

async function processApplicationNode(
  projects: TestProjectConfiguration[],
  categoryTests: Map<string, { unit: string[]; e2e: string[]; browser: string[] }>,
  packageDir: string,
  packagePath: string,
  projectName: string,
  category: string,
): Promise<boolean> {
  if (!hasAppConfig(packagePath)) {
    return false
  }

  await addTestProjectsForDir(projects, categoryTests, packageDir, packagePath, projectName, category)
  return true
}

/**
 * Generate test projects by scanning alias paths and application directories
 */
async function generateTestProjects(): Promise<TestProjectConfiguration[]> {
  const projects: TestProjectConfiguration[] = []

  // Track which categories and test types we have
  const categoryTests = new Map<string, { unit: string[]; e2e: string[]; browser: string[] }>()

  log('=== Scanning Packages and Infra ===')
  // Scan packages and infra from aliases

  await Promise.all(
    ALIAS_DEFINITIONS.map(async ({ name: aliasName, path: aliasPath }) => {
      // Skip UI aliases
      if (aliasName.startsWith('@/')) {
        return
      }

      const packageDir = getPackageDir(aliasPath)
      const packagePath = join(workspaceRoot, packageDir)
      const projectName = getProjectName(packageDir)
      const category = getCategory(packageDir)

      // Only process packages and infra here
      if (!['pkgs', 'infra'].includes(category)) {
        return
      }
      if (!existsSync(packagePath)) {
        return
      }

      await addTestProjectsForDir(projects, categoryTests, packageDir, packagePath, projectName, category)
    }),
  )

  log('=== Scanning Application Directories ===')
  // Scan application directories
  await scanApplicationDirs(projects, categoryTests)

  log(`=== Total test projects created: ${projects.length} ===`)
  return projects.sort((a: any, b: any) => {
    const aName = a.test.name
    const bName = b.test.name
    return aName.localeCompare(bName)
  })
}

dotenv.config({
  envKeysFile: join(workspaceRoot, '.env.keys'),
  path: [join(workspaceRoot, '.env')],
  overload: true,
  quiet: true,
  ignore: ['MISSING_ENV_FILE'],
})

const testProjects = await generateTestProjects()

log('=== Generated Test Projects ===')
log(
  JSON.stringify(
    testProjects.map((p: any) => p.test.name),
    null,
    2,
  ),
)

export default defineConfig({
  test: {
    projects: testProjects,
  },
})
