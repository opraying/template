import { ConfigProvider, Effect } from 'effect'
import { describe, expect, it } from '@effect/vitest'
import { Git, branchToNativeChannel } from '../git'

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

describe('branchToNativeChannel', () => {
  it('keeps main/staging/test channels without env prefixing', () => {
    expect(branchToNativeChannel('main', 'staging')).toBe('main')
    expect(branchToNativeChannel('staging', 'production')).toBe('staging')
    expect(branchToNativeChannel('test', 'production')).toBe('test')
  })

  it('maps feature branches to feat-*', () => {
    expect(branchToNativeChannel('feat/native/ui')).toBe('feat-native-ui')
  })

  it('detects PR refs and maps to preview channels', () => {
    expect(branchToNativeChannel('refs/pull/42/head')).toBe('preview/pr-42')
    expect(branchToNativeChannel('pr/amazing-change')).toBe('preview/amazing-change')
  })

  it('falls back to env-prefixed channel for other branches', () => {
    expect(branchToNativeChannel('feature/native/rework', 'Staging')).toBe('staging-feature-native-rework')
  })

  it('defaults to main when empty', () => {
    expect(branchToNativeChannel('///', 'production')).toBe('production-main')
  })
})
