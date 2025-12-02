#!/usr/bin/env tsx

import { execFile } from 'node:child_process'
import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import { promisify } from 'node:util'

interface CliOptions {
  readonly dryRun: boolean
}

type GroupStrategy = 'prefix' | 'none'

const DEFAULT_GROUP_STRATEGY: GroupStrategy = 'prefix'

interface KeyEntry {
  readonly key: string
  readonly group: string
  readonly order: number
  readonly lines: readonly string[]
  readonly pinned: boolean
}

interface ParsedEnvFile {
  readonly header: readonly string[]
  readonly keys: readonly KeyEntry[]
  readonly footer: readonly string[]
}

interface ProcessedFile {
  readonly path: string
  readonly changed: boolean
}

const ENV_FILE_REGEX = /^\.env(\..+)?$/i
const IGNORED_FILE_NAMES = new Set(['.env.keys'])
const KEY_PATTERN = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_.-]*)\s*=.*$/
const execFileAsync = promisify(execFile)

const RIPGREP_ARGS = [
  '--files',
  '--hidden',
  '-g',
  '.env',
  '-g',
  '.env.*',
  '-g',
  '!.env.keys',
  '--color',
  'never',
  '--null',
]

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  const groupStrategy: GroupStrategy = DEFAULT_GROUP_STRATEGY
  const root = process.cwd()
  const files = await discoverEnvFiles(root)

  if (files.length === 0) {
    console.warn('⚠️  No .env files found.')
    return
  }

  const processed: ProcessedFile[] = []

  for (const filePath of files) {
    const original = await fs.readFile(filePath, 'utf8')
    const parsed = parseEnvFile(original, groupStrategy)

    if (!parsed) {
      continue
    }

    const formatted = formatEnv(parsed, groupStrategy)
    const changed = formatted !== normalizeLineEndings(original)

    if (changed && !options.dryRun) {
      await fs.writeFile(filePath, formatted, 'utf8')
    }

    processed.push({ path: filePath, changed })
  }

  const changedFiles = processed.filter((file) => file.changed)
  if (changedFiles.length === 0) {
    console.log('✓  No changes needed.')
    return
  }

  const action = options.dryRun ? 'Would update' : 'Updated'
  for (const file of changedFiles) {
    console.log(`${action} ${path.relative(root, file.path)}`)
  }
}

function parseArgs(argv: readonly string[]): CliOptions {
  let dryRun = false

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]

    if (token === '--dry-run') {
      dryRun = true
      continue
    }

    throw new Error(`Unknown flag: ${token}`)
  }

  return {
    dryRun,
  }
}

async function discoverEnvFiles(root: string): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync('rg', RIPGREP_ARGS, {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 16,
    })

    if (!stdout) {
      return []
    }

    const trimmed = stdout.endsWith('\0') ? stdout.slice(0, -1) : stdout
    if (!trimmed) {
      return []
    }

    const discovered = new Set<string>()

    for (const relative of trimmed.split('\0')) {
      if (!relative) {
        continue
      }

      const absolutePath = path.resolve(root, relative)

      if (!isEnvFile(absolutePath)) {
        continue
      }

      discovered.add(absolutePath)
    }

    return Array.from(discovered).sort((left, right) => left.localeCompare(right))
  } catch (error) {
    const err = error as NodeJS.ErrnoException & { code?: string | number; stderr?: string }

    if (err.code === 'ENOENT') {
      throw new Error('ripgrep (rg) command not found in PATH. Please install ripgrep to use this script.')
    }

    if (typeof err.code === 'number' && err.code === 1) {
      return []
    }

    const reason = typeof err.stderr === 'string' && err.stderr.trim().length > 0 ? err.stderr.trim() : err.message
    throw new Error(`ripgrep (rg) failed to execute: ${reason}`)
  }
}

function isEnvFile(target: string): boolean {
  const filename = path.basename(target)

  if (IGNORED_FILE_NAMES.has(filename)) {
    return false
  }

  return ENV_FILE_REGEX.test(filename)
}

function parseEnvFile(content: string, strategy: GroupStrategy): ParsedEnvFile | null {
  const normalized = normalizeLineEndings(content)
  const lines = normalized.split('\n')

  if (lines.length === 0) {
    return null
  }

  const keys: KeyEntry[] = []
  const footer: string[] = []
  let header: string[] = []
  let buffer: string[] = []
  let encounteredKey = false
  let ordinal = 0

  for (const line of lines) {
    const match = KEY_PATTERN.exec(line)

    if (match) {
      const key = match[1]
      const group = computeGroupKey(key, strategy)
      let prelude = buffer
      buffer = []

      if (!encounteredKey) {
        const split = splitHeaderAndPrelude(prelude)
        header = split.header
        prelude = split.prelude
      }

      encounteredKey = true
      const attachment = normalizePrelude(prelude)
      const entryLines = [...attachment, line]

      keys.push({
        key,
        group,
        order: ordinal,
        lines: entryLines,
        pinned: key.startsWith('DOTENV_PUBLIC'),
      })
      ordinal += 1
      continue
    }

    if (!encounteredKey) {
      buffer = [...buffer, line]
      continue
    }

    buffer = [...buffer, line]
  }

  if (!encounteredKey) {
    return null
  }

  footer.push(...normalizeFooter(buffer))

  return { header, keys, footer }
}

function splitHeaderAndPrelude(lines: readonly string[]): { header: string[]; prelude: string[] } {
  let lastBlank = -1
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lines[index].trim().length === 0) {
      lastBlank = index
      break
    }
  }

  if (lastBlank === -1) {
    return { header: [], prelude: [...lines] }
  }

  const header = lines.slice(0, lastBlank + 1)
  const prelude = lines.slice(lastBlank + 1)
  return { header, prelude }
}

function normalizePrelude(lines: readonly string[]): string[] {
  const result: string[] = []
  let seenBlank = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.length === 0) {
      if (seenBlank) {
        continue
      }
      seenBlank = true
      result.push('')
      continue
    }

    seenBlank = false
    result.push(line)
  }

  while (result.length > 0 && result[0].trim().length === 0) {
    result.shift()
  }

  while (result.length > 0 && result[result.length - 1].trim().length === 0) {
    result.pop()
  }

  return result
}

function normalizeFooter(lines: readonly string[]): string[] {
  const result: string[] = []
  let previousBlank = false

  for (const line of lines) {
    if (line.trim().length === 0) {
      if (previousBlank) {
        continue
      }
      previousBlank = true
      result.push('')
      continue
    }

    previousBlank = false
    result.push(line)
  }

  while (result.length > 0 && result[result.length - 1].trim().length === 0) {
    result.pop()
  }

  return result
}

function formatEnv(parsed: ParsedEnvFile, strategy: GroupStrategy): string {
  const header = [...parsed.header]
  const footer = [...parsed.footer]

  const sortedNonPinned = parsed.keys
    .filter((entry) => !entry.pinned)
    .slice()
    .sort((a, b) => {
      const groupCompare = a.group.localeCompare(b.group, 'en', { sensitivity: 'base' })
      if (groupCompare !== 0) {
        return groupCompare
      }
      const keyCompare = a.key.localeCompare(b.key, 'en', { sensitivity: 'base' })
      if (keyCompare !== 0) {
        return keyCompare
      }
      return a.order - b.order
    })

  const orderedKeys: KeyEntry[] = []
  let sortedIndex = 0

  for (const entry of parsed.keys) {
    if (entry.pinned) {
      orderedKeys.push(entry)
      continue
    }

    const replacement = sortedNonPinned[sortedIndex]
    if (!replacement) {
      throw new Error('Invariant violated: missing sorted entry for non-pinned key')
    }
    orderedKeys.push(replacement)
    sortedIndex += 1
  }

  const lines: string[] = []
  appendNormalized(lines, header)

  if (lines.length > 0 && orderedKeys.length > 0 && lines[lines.length - 1].trim().length !== 0) {
    lines.push('')
  }

  let previousGroup: string | undefined

  for (const entry of orderedKeys) {
    if (strategy !== 'none') {
      if (previousGroup && entry.group !== previousGroup) {
        if (lines.length > 0 && lines[lines.length - 1].trim().length !== 0) {
          lines.push('')
        }
      }
    }

    appendNormalized(lines, entry.lines)
    previousGroup = entry.group
  }

  if (footer.length > 0) {
    if (lines.length > 0 && lines[lines.length - 1].trim().length !== 0) {
      lines.push('')
    }
    appendNormalized(lines, footer)
  }

  const trimmed = trimTrailingBlankLines(lines)
  const output = trimmed.join('\n')
  return output.length === 0 ? '' : `${output}\n`
}

function appendNormalized(target: string[], source: readonly string[]): void {
  for (const line of source) {
    const isBlank = line.trim().length === 0
    if (isBlank) {
      if (target.length === 0) {
        continue
      }
      if (target[target.length - 1].trim().length === 0) {
        continue
      }
      target.push('')
      continue
    }

    target.push(line)
  }
}

function trimTrailingBlankLines(lines: readonly string[]): string[] {
  let end = lines.length
  while (end > 0 && lines[end - 1].trim().length === 0) {
    end -= 1
  }
  return lines.slice(0, end)
}

function computeGroupKey(key: string, strategy: GroupStrategy): string {
  if (strategy === 'none') {
    return '__all__'
  }

  const separators = ['__', '_', '.', '-']
  let index = Number.POSITIVE_INFINITY

  for (const separator of separators) {
    const position = key.indexOf(separator)
    if (position > 0 && position < index) {
      index = position
    }
  }

  if (!Number.isFinite(index)) {
    return key
  }

  return key.slice(0, index)
}

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/g, '\n')
}

await main()
