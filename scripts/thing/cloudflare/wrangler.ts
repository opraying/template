import * as Crypto from 'node:crypto'
import { Effect, Option, pipe } from 'effect'
import type { Unstable_Config, Unstable_DevOptions, Unstable_DevWorker } from 'wrangler'
import type { Workspace } from '../workspace'

type SignalHandler = (...args: unknown[]) => void

// Wrangler installs SIGINT/SIGTERM listeners that call process.exit(). We wrap them so
// other listeners finish cleanup before we optionally exit.
const wranglerSignals: ReadonlyArray<NodeJS.Signals> = ['SIGINT', 'SIGTERM']

const baselineListeners = new Map<NodeJS.Signals, Set<SignalHandler>>(
  wranglerSignals.map((signal) => [signal, new Set(process.listeners(signal) as SignalHandler[])]),
)

const originalToWrapped = new WeakMap<SignalHandler, SignalHandler>()
const wrappedToOriginal = new WeakMap<SignalHandler, SignalHandler>()
let pendingExitCode: number | null = null

// Snapshot the current listeners so we only touch the ones Wrangler registers later.

const wrap = (handler: SignalHandler): SignalHandler => {
  const existing = originalToWrapped.get(handler)

  if (existing) {
    return existing
  }

  const wrapped: SignalHandler = (...args) => {
    const originalExit = process.exit
    let exitRequested = false
    let exitCode: number | undefined

    process.exit = ((code?: number) => {
      exitRequested = true
      exitCode = code
      return undefined as never
    }) as typeof process.exit

    try {
      handler(...args)
    } finally {
      process.exit = originalExit

      if (exitRequested) {
        pendingExitCode = exitCode ?? 0
      }
    }
  }

  originalToWrapped.set(handler, wrapped)
  wrappedToOriginal.set(wrapped, handler)

  return wrapped
}

const apply = () => {
  for (const signal of wranglerSignals) {
    const baseline = baselineListeners.get(signal)

    for (const listener of process.listeners(signal) as SignalHandler[]) {
      if (wrappedToOriginal.has(listener) || baseline?.has(listener)) {
        continue
      }

      const wrapped = wrap(listener)
      process.removeListener(signal, listener)
      process.on(signal, wrapped)
    }
  }
}

const restore = () => {
  for (const signal of wranglerSignals) {
    for (const listener of process.listeners(signal) as SignalHandler[]) {
      const original = wrappedToOriginal.get(listener)

      if (!original) {
        continue
      }

      process.removeListener(signal, listener)
      process.on(signal, original)
      wrappedToOriginal.delete(listener)
      originalToWrapped.delete(original)
    }
  }
}

const consumeExitCode = () => {
  const code = pendingExitCode
  pendingExitCode = null
  return code
}

const wranglerSignalPatch = { apply, restore, consumeExitCode }

const durableObjectNamespaceIdFromName = (uniqueKey: string, data: string) => {
  const key = Crypto.createHash('sha256').update(uniqueKey).digest()
  const nameHmac = Crypto.createHmac('sha256', key).update(data).digest().subarray(0, 16)
  const hmac = Crypto.createHmac('sha256', key).update(nameHmac).digest().subarray(0, 16)
  return Buffer.concat([nameHmac, hmac]).toString('hex')
}

// R2BucketObject
// KVNamespaceObject
// QueueBrokerObject
export const getD1Name = (id: string) => durableObjectNamespaceIdFromName('miniflare-D1DatabaseObject', id)

export const parseConfig = Effect.fn('wrangler.parse-config')(function* (
  path: string | Array<string>,
  nodeEnv: 'development' | 'production' = 'development',
  stage: 'test' | 'staging' | 'production' = 'test',
) {
  // Test 表示测试环境, Staging 表示预发布环境, 为空表示生产环境或者本地沿用生产配置
  const env = nodeEnv === 'development' || stage === 'production' ? '' : stage

  const config: Option.Option<{ config: Unstable_Config; path: string }> = yield* Effect.acquireRelease(
    pipe(
      Effect.promise(() => import('wrangler')),
      Effect.withSpan('wrangler.import'),
      Effect.flatMap(({ unstable_readConfig }) =>
        Effect.reduce(
          Array.isArray(path) ? path : [path],
          Option.none<{ config: Unstable_Config; path: string }>(),
          Effect.fnUntraced(function* (acc, configPath) {
            if (Option.isSome(acc)) return acc

            const result: Option.Option<{ config: Unstable_Config; path: string }> = yield* pipe(
              Effect.try(() =>
                unstable_readConfig({ config: configPath, env, remote: false }, { hideWarnings: false }),
              ),
              Effect.tapErrorCause(Effect.logError),
              Effect.map((config) => Option.some({ config, path: configPath })),
              Effect.orElseSucceed(() => Option.none()),
              Effect.withSpan('wrangler.read-config', {
                attributes: {
                  configPath,
                  env,
                },
              }),
            )

            return result
          }),
        ),
      ),
      Effect.tap(() => {
        wranglerSignalPatch.apply()
      }),
      Effect.tapErrorCause(Effect.logError),
      Effect.orDie,
    ),
    () => {
      wranglerSignalPatch.restore()

      return Effect.void
    },
  )

  // const config: Option.Option<{ config: Unstable_Config; path: string }> = yield*
  if (Option.isNone(config)) {
    return yield* Effect.dieMessage(`No configuration found, ${path}`)
  }

  return config.value
})

export const getPlatformProxy = Effect.fn('wrangler.get-platform-proxy')(function* ({
  workspace,
}: {
  workspace: Workspace
}) {
  const persistPath = `${workspace.root}/.wrangler/state`

  const dev = yield* Effect.acquireRelease(
    pipe(
      Effect.promise(() => import('wrangler')),
      Effect.withSpan('wrangler.import'),
      Effect.flatMap(({ getPlatformProxy }) =>
        Effect.tryPromise(() =>
          getPlatformProxy({
            configPath: `${workspace.projectPath}/wrangler.jsonc`,
            persist: { path: persistPath },
            envFiles: [],
          }),
        ),
      ),
      Effect.tap(() => {
        wranglerSignalPatch.apply()
      }),
      Effect.tapErrorCause(Effect.logError),
      Effect.orDie,
    ),
    (proxy) => {
      wranglerSignalPatch.restore()

      return Effect.promise(() => proxy.dispose()).pipe(Effect.withSpan('wrangler.stop-platform-proxy'))
    },
  )

  return {
    env: dev.env,
    caches: dev.caches,
    ctx: dev.ctx,
  }
})

export const unstableDev = Effect.fn('wrangler.unstable-dev')(function* (script: string, options: Unstable_DevOptions) {
  const stop = Effect.fn('wrangler.stop-dev-worker')(function* (_: Unstable_DevWorker) {
    yield* Effect.promise(() => _.stop()).pipe(Effect.timeout(500), Effect.ignore)
  })

  yield* Effect.acquireRelease(
    pipe(
      Effect.promise(() => import('wrangler')),
      Effect.withSpan('wrangler.import'),
      Effect.flatMap(({ unstable_dev }) => Effect.tryPromise(() => unstable_dev(script, options))),
      Effect.tap(() => {
        wranglerSignalPatch.apply()
      }),
      Effect.tapErrorCause(Effect.logError),
      Effect.orDie,
    ),
    (devWorker) => {
      wranglerSignalPatch.restore()

      return stop(devWorker)
    },
  )

  return yield* Effect.never.pipe(Effect.withSpan('wrangler.serve'))
})
