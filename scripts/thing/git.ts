import { Config, Context, Effect, Layer, Option } from 'effect'
import { shell } from './utils'
import type { Stage } from './domain'

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
      yield* Effect.logDebug('Use octokit')

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

const formatBranch = (branch: string) => branch.replace('refs/heads/', '')

export const detectStage = Effect.fn('detectStage')(function* (defaultStage?: Option.Option<Stage>) {
  const git = yield* Git

  const branch = yield* git.branch
  const defaultValue = defaultStage ? Option.getOrUndefined(defaultStage) : undefined
  const branchStage = branch === 'main' ? 'production' : branch === 'staging' ? 'staging' : 'test'

  process.env.STAGE = defaultValue || process.env.STAGE || branchStage
})
