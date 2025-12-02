#!/usr/bin/env tsx

import { appendFileSync } from 'node:fs'

import { detectSurfaces } from './surface-detector'
import type { SurfaceDetectionPayload } from './surface-detector'

type OutputFormat = 'text' | 'json' | 'github'

interface CliOptions {
  surfaces: string[]
  format: OutputFormat
  base?: string
  head?: string
  help?: boolean
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    surfaces: [],
    format: 'text',
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    switch (arg) {
      case '-h':
      case '--help':
        options.help = true
        break
      case '--surface':
        options.surfaces.push(expectValue('--surface', argv[++i]))
        break
      case '--surfaces':
        options.surfaces.push(
          ...expectValue('--surfaces', argv[++i])
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean),
        )
        break
      case '--format':
        options.format = expectValue('--format', argv[++i]) as OutputFormat
        break
      case '--base':
        options.base = expectValue('--base', argv[++i])
        break
      case '--head':
        options.head = expectValue('--head', argv[++i])
        break
      default:
        if (arg.startsWith('--surface=')) {
          options.surfaces.push(arg.split('=')[1])
        } else if (arg.startsWith('--surfaces=')) {
          options.surfaces.push(
            ...arg
              .split('=')[1]
              .split(',')
              .map((value) => value.trim())
              .filter(Boolean),
          )
        } else if (arg.startsWith('--format=')) {
          options.format = arg.split('=')[1] as OutputFormat
        } else if (arg.startsWith('--base=')) {
          options.base = arg.split('=')[1]
        } else if (arg.startsWith('--head=')) {
          options.head = arg.split('=')[1]
        } else {
          console.error(`Unknown argument: ${arg}`)
          options.help = true
        }
        break
    }
  }
  return options
}

function expectValue(flag: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing value for ${flag}`)
  }
  return value
}

function printHelp() {
  console.log(`Usage: pnpm tsx scripts/ci/detect-surfaces.ts [options]

Options:
  --surface <name>        Check a single CI surface (repeatable)
  --surfaces <a,b,c>      Comma separated surfaces
  --format <text|json|github>  Output style (default: text)
  --base <sha>            Override git base commit (defaults to merge-base of main)
  --head <sha>            Override git head commit (defaults to HEAD)
  -h, --help              Show this message`)
}

function writeGithubOutput(key: string, value: string) {
  const outputFile = process.env.GITHUB_OUTPUT
  if (!outputFile) return
  appendFileSync(outputFile, `${key}=${value}\n`)
}

function formatText(payload: SurfaceDetectionPayload) {
  const { affectedProjects, results, base, head, changedFiles } = payload
  const header = `Detected ${affectedProjects.length} affected Nx project(s) between ${base.slice(0, 7)}...${head.slice(0, 7)}`
  console.log(header)
  for (const result of results) {
    const status = result.impacted ? 'impacted' : 'no-impact'
    const matched = result.matches.length > 0 ? ` (${result.matches.join(', ')})` : ''
    console.log(`- ${result.name}: ${status}${matched}`)
    if (result.description) {
      console.log(`  ${result.description}`)
    }
    writeGithubOutput(`surface-${result.name}`, String(result.impacted))
    writeGithubOutput(`surface-${result.name}-projects`, result.matches.join(','))
  }
  writeGithubOutput('affected-projects', affectedProjects.join(','))
  writeGithubOutput('changed-files', changedFiles.join(','))
  console.log(`Changed files: ${changedFiles.length}`)
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }
  const payload = detectSurfaces({ surfaces: options.surfaces, base: options.base, head: options.head })
  if (options.format === 'json') {
    console.log(JSON.stringify(payload, null, 2))
    return
  }
  if (options.format === 'github') {
    for (const result of payload.results) {
      writeGithubOutput(`surface-${result.name}`, String(result.impacted))
      writeGithubOutput(`surface-${result.name}-projects`, result.matches.join(','))
    }
    writeGithubOutput('affected-projects', payload.affectedProjects.join(','))
    writeGithubOutput('changed-files', payload.changedFiles.join(','))
    return
  }
  formatText(payload)
}

main()
