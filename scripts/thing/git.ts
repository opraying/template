import { Config, Context, Effect, Layer, Option } from 'effect'
import { spawnSync } from 'node:child_process'
import { shell } from './utils/shell'
import type { Stage } from './domain'
import { workspaceRoot } from '@nx/devkit'

export interface GitCommandOptions {
  cwd?: string
  trim?: boolean
}

export const git = (args: string[], options?: GitCommandOptions) => {
  const result = spawnSync('git', args, {
    cwd: options?.cwd ?? workspaceRoot,
    encoding: 'utf8',
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  if (result.error) {
    throw new Error(`[git] Failed to run git ${args.join(' ')}: ${result.error.message}`)
  }

  if (result.status !== 0) {
    const message = (result.stderr || result.stdout || '').trim()
    throw new Error(`[git] Command git ${args.join(' ')} exited with code ${result.status}. ${message}`)
  }

  const output = result.stdout ?? ''
  return options?.trim === false ? output : output.trim()
}

interface GitCommit {
  sha: string
  message: string
  author: {
    name: string
    email: string
  }
}

const GitConfig = Config.all({
  GITHUB_BRANCH: Config.string('GITHUB_BRANCH'),
  GITHUB_TOKEN: Config.string('GITHUB_TOKEN'),
  GITHUB_OWNER: Config.string('GITHUB_OWNER'),
  GITHUB_REPO: Config.string('GITHUB_REPO'),
  GITHUB_SHA: Config.string('GITHUB_SHA'),
})

export class Git extends Context.Tag('@thing/Git')<
  Git,
  {
    lastCommit: Effect.Effect<GitCommit>
    branch: Effect.Effect<string>
  }
>() {
  static Github = Layer.effect(
    this,
    Effect.gen(function* () {
      yield* Effect.logInfo('Use octokit')

      const { GITHUB_BRANCH, GITHUB_OWNER, GITHUB_REPO, GITHUB_SHA, GITHUB_TOKEN } = yield* GitConfig

      const { getOctokit } = yield* Effect.promise(() => import('@actions/github'))
      const octokit = getOctokit(GITHUB_TOKEN)

      const lastCommit = Effect.promise(() =>
        octokit.rest.git.getCommit({
          owner: GITHUB_OWNER,
          repo: GITHUB_REPO,
          commit_sha: GITHUB_SHA,
        }),
      ).pipe(
        Effect.andThen((_) => {
          return {
            sha: _.data.sha,
            message: _.data.message,
            author: {
              name: _.data.author.name,
              email: _.data.author.email,
            },
          }
        }),
        Effect.withSpan('git.lastCommit'),
      )

      const branch = Effect.withSpan(
        Effect.sync(() => formatBranch(GITHUB_BRANCH)),
        'git.branch',
      )

      return Git.of({
        lastCommit,
        branch,
      })
    }),
  )

  static Local = Layer.effect(
    this,
    Effect.gen(function* () {
      const lastCommit = shell`$ git log -1 --pretty=format:%H%x00%s%x00%aN%x00%aE`.pipe(
        Effect.map((_) => {
          const [sha, message, name, email] = _.stdout.trim().split('\0')
          return {
            sha,
            message,
            author: { name, email },
          }
        }),
        Effect.withSpan('git.lastCommit'),
      )

      const branch = shell`
        $ git rev-parse --abbrev-ref HEAD
      `.pipe(
        Effect.map((_) => _.stdout),
        Effect.withSpan('git.branch'),
      )

      return Git.of({
        lastCommit,
        branch,
      })
    }),
  )

  static Default = Layer.suspend(() => {
    return process.env.CI && process.env.GITHUB_REPO ? Git.Github : Git.Local
  })
}

const formatBranch = (branch: string) => branch.replace(/^refs\/heads\//, '')

const sanitizeChannelSegment = (value?: string) => {
  if (!value) {
    return ''
  }

  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized
}

const resolvePreviewChannel = (branch: string) => {
  const prRef = branch.match(/^refs\/pull\/(\d+)\/(head|merge)$/i)
  if (prRef) {
    return `preview/pr-${prRef[1]}`
  }

  const shortPrRef = branch.match(/^pull\/(\d+)\/(head|merge)$/i)
  if (shortPrRef) {
    return `preview/pr-${shortPrRef[1]}`
  }

  const previewLike = branch.match(/^(?:pr|preview)[/-](.+)$/i)
  if (previewLike) {
    const suffix = sanitizeChannelSegment(previewLike[1]) || 'pr'
    return `preview/${suffix}`
  }

  return undefined
}

export const branchToNativeChannel = (branch: string, env?: string) => {
  const formatted = formatBranch(branch)
  const previewChannel = resolvePreviewChannel(formatted)
  if (previewChannel) {
    return previewChannel
  }

  const branchSegment = sanitizeChannelSegment(formatted) || 'main'
  if (
    branchSegment === 'main' ||
    branchSegment === 'staging' ||
    branchSegment === 'test' ||
    branchSegment.startsWith('feat-')
  ) {
    return branchSegment
  }

  const envSegment = sanitizeChannelSegment(env)
  return envSegment ? `${envSegment}-${branchSegment}` : branchSegment
}

export const detectStage = Effect.fn('detectStage')(function* (defaultStage?: Option.Option<Stage>) {
  const git = yield* Git

  const branch = yield* git.branch
  const defaultValue = defaultStage ? Option.getOrUndefined(defaultStage) : undefined
  const branchStage = branch === 'main' ? 'production' : branch === 'staging' ? 'staging' : 'test'

  process.env.STAGE = defaultValue || process.env.STAGE || branchStage
})
