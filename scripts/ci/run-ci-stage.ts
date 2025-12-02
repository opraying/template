import { spawnSync } from 'node:child_process'
import path from 'node:path'

import { STAGES } from './stages'
import type { Platform, StageContext } from './types'
import { detectSurfaces } from './surface-detector'
import { ensureEnvVars, repoRoot } from './utils'

interface StageOptions {
  stage?: string
  platform?: Platform
  dryRun?: boolean
  list?: boolean
  help?: boolean
}

function parseArgs(argv: string[]): StageOptions {
  const options: StageOptions = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    switch (arg) {
      case '--stage':
        options.stage = expectValue('--stage', argv[++i])
        break
      case '--platform':
        options.platform = normalizePlatform(expectValue('--platform', argv[++i]))
        break
      case '--dry-run':
        options.dryRun = true
        break
      case '--list':
        options.list = true
        break
      case '-h':
      case '--help':
        options.help = true
        break
      default:
        if (arg.startsWith('--stage=')) {
          options.stage = arg.split('=')[1]
        } else if (arg.startsWith('--platform=')) {
          options.platform = normalizePlatform(arg.split('=')[1])
        } else {
          console.error(`Unknown argument: ${arg}`)
          options.help = true
        }
        break
    }
  }
  return options
}

function expectValue(flag: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Missing value for ${flag}`)
  }
  return value
}

function normalizePlatform(value: string | undefined): Platform {
  switch ((value ?? '').toLowerCase()) {
    case 'linux':
    case 'ubuntu':
      return 'linux'
    case 'mac':
    case 'macos':
    case 'darwin':
      return 'macos'
    case 'win':
    case 'windows':
      return 'windows'
    default:
      return detectHostPlatform()
  }
}

function detectHostPlatform(): Platform {
  switch (process.platform) {
    case 'darwin':
      return 'macos'
    case 'win32':
      return 'windows'
    default:
      return 'linux'
  }
}

function printHelp() {
  console.log(`Usage: pnpm tsx scripts/run-ci-stage.ts --stage <name> [options]

Options:
  --stage <name>        Stage to run (${Object.keys(STAGES).join(', ')})
  --platform <value>    linux | macos | windows (defaults to host platform)
  --dry-run             Print the commands without executing them
  --list                List available stages
  -h, --help            Show this message`)
}

function runStage(stageName: string, platform: Platform, dryRun: boolean) {
  const stage = STAGES[stageName]
  if (!stage) {
    throw new Error(`Unknown stage "${stageName}". Use --list to inspect options.`)
  }
  console.log(`Running stage "${stageName}" (${stage.description}) on ${platform}`)
  if (stage.steps.length === 0) {
    console.log('No commands configured for this stage. Nothing to do.')
    return
  }
  if (stage.supportedPlatforms && !stage.supportedPlatforms.includes(platform)) {
    throw new Error(`Stage "${stageName}" only runs on ${stage.supportedPlatforms.join(', ')}.`)
  }
  if (stage.requiredEnv) {
    ensureEnvVars(stageName, stage.requiredEnv)
  }
  const detection = detectSurfaces({
    surfaces: stage.surface ? [stageName] : undefined,
  })
  console.log(
    `Detected ${detection.affectedProjects.length} affected Nx project(s) between ${detection.base.slice(0, 7)}...${detection.head.slice(0, 7)}`,
  )
  const context: StageContext = {
    ci: {
      base: detection.base,
      head: detection.head,
      changedFiles: detection.changedFiles,
      affectedProjects: detection.affectedProjects,
      projectMeta: detection.projectMeta,
      surfaces: detection.results,
    },
  }
  stage.prepare?.(context)
  for (const step of stage.steps) {
    if (step.platforms && !step.platforms.includes(platform)) {
      console.log(`Skipping step "${step.name}" on ${platform}`)
      continue
    }
    const args = typeof step.args === 'function' ? step.args(context) : (step.args ?? [])
    const cwdOption = typeof step.cwd === 'function' ? step.cwd(context) : step.cwd
    const envOption = typeof step.env === 'function' ? step.env(context) : step.env
    console.log(`→ ${step.name}`)
    if (dryRun) {
      console.log(`  ${step.command} ${args.join(' ')}`)
      continue
    }
    const result = spawnSync(step.command, args, {
      cwd: cwdOption ? path.resolve(repoRoot, cwdOption) : repoRoot,
      stdio: 'inherit',
      env: { ...process.env, ...envOption },
    })
    if (result.status !== 0) {
      throw new Error(`Step "${step.name}" failed with code ${result.status ?? 1}`)
    }
  }
}

function listStages() {
  console.log('Available stages:')
  for (const [name, stage] of Object.entries(STAGES)) {
    console.log(`- ${name}: ${stage.description}`)
  }
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2))
    if (options.help) {
      printHelp()
      return
    }
    if (options.list) {
      listStages()
      return
    }
    if (!options.stage) {
      printHelp()
      process.exit(1)
    }
    const platform = options.platform ?? detectHostPlatform()
    runStage(options.stage, platform, Boolean(options.dryRun))
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

main()
