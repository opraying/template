import { ConfigProvider, Effect } from 'effect'
import { describe, expect, it } from '@effect/vitest'
import { Git } from '../git'

describe('git', () => {
  it('local', () => {
    const program = Effect.gen(function* () {
      const git = yield* Git

      const commit = yield* git.lastCommit
      const branch = yield* git.branch

      expect(commit).toBeDefined()
      expect(branch).toBeDefined()
    })

    const main = program.pipe(Effect.provide(Git.Default))

    return Effect.runPromise(main)
  })

  it.skip('live', () => {
    const config = new Map([
      ['GITHUB_SHA', 'sha'],
      ['GITHUB_REF', 'main'],
      ['GITHUB_OWNER', 'opraying'],
      ['GITHUB_REPO', 'opraying/xstack'],
      ['GITHUB_TOKEN', process.env.GITHUB_TOKEN || ''],
    ])
    const provider = ConfigProvider.fromMap(config)

    const program = Effect.gen(function* () {
      const git = yield* Git

      const commit = yield* git.lastCommit
      const branch = yield* git.branch

      expect(commit).toBeDefined()
      expect(branch).toBeDefined()
    })

    const main = program.pipe(Effect.provide(Git.Default), Effect.withConfigProvider(provider))

    return Effect.runPromise(main)
  })
})
