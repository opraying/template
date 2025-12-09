#!/usr/bin/env tsx

import { execFile } from 'node:child_process'
import { Buffer } from 'node:buffer'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
import * as dotenv from '@dotenvx/dotenvx'
import { getOctokit } from '@actions/github'
// @ts-ignore
import sodium from 'libsodium-wrappers'

interface RepoCoordinates {
  readonly owner: string
  readonly repo: string
}

const execFileAsync = promisify(execFile)
const SECRETS_FILE = '.env.github'

async function main(): Promise<void> {
  const env = dotenv.config({
    quiet: true,
    ignore: ['MISSING_ENV_FILE'],
    processEnv: {},
  })
  await sodium.ready

  const token = env.parsed?.GITHUB_SECRET_SYNC_TOKEN
  if (!token) {
    throw new Error('Missing GitHub token. Set GITHUB_SECRET_SYNC_TOKEN.')
  }

  const repo = await inferRepoFromGit()
  const secrets = loadSecretsFromEnvFile(resolve(process.cwd(), SECRETS_FILE))

  if (Object.keys(secrets).length === 0) {
    console.warn('⚠️  No secrets found in .env.github, nothing to sync.')
    return
  }

  const octokit = getOctokit(token)
  const [publicKey, remoteSecretNames] = await Promise.all([
    fetchPublicKey(octokit, repo),
    listRepoSecrets(octokit, repo),
  ])

  await upsertSecrets({ octokit, repo, publicKey, secrets })
  await pruneSecrets({
    octokit,
    repo,
    desired: new Set(Object.keys(secrets)),
    remote: remoteSecretNames,
  })
}

async function inferRepoFromGit(): Promise<RepoCoordinates> {
  try {
    const { stdout } = await execFileAsync('git', ['config', '--get', 'remote.origin.url'], {
      encoding: 'utf8',
    })

    const remote = stdout.trim()

    if (remote.length === 0) {
      throw new Error('remote.origin.url is empty')
    }

    return parseGitRemote(remote)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`Unable to derive repo from git config: ${reason}`)
  }
}

function parseGitRemote(remote: string): RepoCoordinates {
  const trimmed = remote.trim()

  if (trimmed.includes('://')) {
    return parseUrlRemote(trimmed)
  }

  if (trimmed.includes(':')) {
    return parseScpRemote(trimmed)
  }

  throw new Error(`Unsupported git remote: ${remote}`)
}

function parseUrlRemote(remote: string): RepoCoordinates {
  let url: URL
  try {
    url = new URL(remote)
  } catch (error) {
    throw new Error(`Invalid git remote url: ${(error as Error).message}`)
  }

  if (!url.hostname.endsWith('github.com')) {
    throw new Error(`Expected a GitHub remote, received host "${url.hostname}"`)
  }

  return parseRemotePath(url.pathname)
}

function parseScpRemote(remote: string): RepoCoordinates {
  const atIndex = remote.indexOf('@')
  const withoutUser = atIndex === -1 ? remote : remote.slice(atIndex + 1)
  const colonIndex = withoutUser.indexOf(':')

  if (colonIndex === -1) {
    throw new Error(`Malformed SCP-style remote: ${remote}`)
  }

  const host = withoutUser.slice(0, colonIndex)
  const path = withoutUser.slice(colonIndex + 1)

  if (!host.endsWith('github.com')) {
    throw new Error(`Expected a GitHub remote, received host "${host}"`)
  }

  return parseRemotePath(path)
}

function parseRemotePath(pathname: string): RepoCoordinates {
  const sanitized = pathname.replace(/^\/+/, '').replace(/\.git$/i, '')
  const segments = sanitized.split('/').filter(Boolean)

  if (segments.length !== 2) {
    throw new Error(`Expected remote path to look like <owner>/<repo>, received "${pathname}"`)
  }

  const [owner, repo] = segments
  return { owner, repo }
}

function loadSecretsFromEnvFile(filePath: string): Record<string, string> {
  const result = dotenv.config({
    path: filePath,
    quiet: true,
    processEnv: {},
  })

  if (result.error) {
    throw new Error(`Unable to read ${SECRETS_FILE}: ${result.error.message}`)
  }

  const parsed = result.parsed ?? {}
  const entries = Object.entries(parsed)
  const next: Record<string, string> = {}

  for (const [key, value] of entries) {
    if (!key || key.trim().length === 0) {
      continue
    }

    next[key] = value ?? ''
  }

  return next
}

async function fetchPublicKey(octokit: ReturnType<typeof getOctokit>, repo: RepoCoordinates) {
  const response = await octokit.rest.actions.getRepoPublicKey({
    owner: repo.owner,
    repo: repo.repo,
  })
  return response.data
}

async function listRepoSecrets(octokit: ReturnType<typeof getOctokit>, repo: RepoCoordinates): Promise<Set<string>> {
  const secretNames = new Set<string>()

  for await (const response of octokit.paginate.iterator(octokit.rest.actions.listRepoSecrets, {
    owner: repo.owner,
    repo: repo.repo,
    per_page: 100,
  })) {
    if (!response.data || !Array.isArray(response.data.secrets)) {
      continue
    }

    for (const secret of response.data.secrets) {
      secretNames.add(secret.name)
    }
  }

  return secretNames
}

interface UpsertContext {
  readonly octokit: ReturnType<typeof getOctokit>
  readonly repo: RepoCoordinates
  readonly publicKey: { readonly key_id: string; readonly key: string }
  readonly secrets: Record<string, string>
}

async function upsertSecrets(context: UpsertContext): Promise<void> {
  const entries = Object.entries(context.secrets).sort(([a], [b]) => a.localeCompare(b))

  for (const [name, value] of entries) {
    const encrypted_value = encryptSecret(value, context.publicKey.key)

    await context.octokit.rest.actions.createOrUpdateRepoSecret({
      owner: context.repo.owner,
      repo: context.repo.repo,
      secret_name: name,
      encrypted_value,
      key_id: context.publicKey.key_id,
    })

    console.log(`✅ Synced ${name}`)
  }
}

interface PruneContext {
  readonly octokit: ReturnType<typeof getOctokit>
  readonly repo: RepoCoordinates
  readonly desired: ReadonlySet<string>
  readonly remote: ReadonlySet<string>
}

async function pruneSecrets(context: PruneContext): Promise<void> {
  const deletions: string[] = []

  for (const name of Array.from(context.remote)) {
    if (context.desired.has(name)) {
      continue
    }

    await context.octokit.rest.actions.deleteRepoSecret({
      owner: context.repo.owner,
      repo: context.repo.repo,
      secret_name: name,
    })

    deletions.push(name)
    console.log(`🗑️  Removed ${name}`)
  }

  if (deletions.length === 0) {
    console.log('✓ Repo secrets already match .env.github')
  }
}

function encryptSecret(secret: string, base64Key: string): string {
  const messageBytes = Buffer.from(secret, 'utf8')
  const keyBytes = Buffer.from(base64Key, 'base64')
  const encryptedBytes = sodium.crypto_box_seal(messageBytes, keyBytes)
  return Buffer.from(encryptedBytes).toString('base64')
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
