#!/usr/bin/env tsx

import * as dotenv from '@dotenvx/dotenvx'
import * as Otlp from '@effect/opentelemetry/Otlp'
import { NodeContext, NodeHttpClient } from '@effect/platform-node'
import { defaultTeardown } from '@effect/platform/Runtime'
import { workspaceRoot } from '@nx/devkit'
import { Effect, Exit, Fiber, FiberRef, Layer, Logger, LogLevel, pipe, Scope } from 'effect'
import * as path from 'node:path'
import { cli } from './cli'
import { DiscordNotification } from './discord'
import type { Stage } from './domain'
import { Git } from './git'
import { Github } from './github'

// declare process.env
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      // @ts-ignore
      NODE_ENV: NodeEnv
      CI: 'true' | 'false'
      STAGE: Stage
      GITHUB_TOKEN: string
      GITHUB_STEP_SUMMARY: string | undefined
    }
  }
}

const TracerLive = pipe(
  Otlp.layer({
    baseUrl: 'http://localhost:4318',
    shutdownTimeout: 500,
    resource: {
      serviceName: 'thing-cli',
      serviceVersion: '0.0.1',
    },
  }),
  Layer.locally(FiberRef.currentMinimumLogLevel, LogLevel.Error),
  Layer.provide(NodeHttpClient.layer),
)

const Live = pipe(
  Layer.mergeAll(
    Git.Default,
    Github.Default,
    DiscordNotification.Default.pipe(Layer.provide(NodeHttpClient.layer)),
    NodeContext.layer,
    NodeHttpClient.layer,
  ),
  Layer.provide(
    Layer.suspend(() => {
      if (process.env.CI && process.env.GITHUB_REPO) {
        return Layer.empty
      }
      return TracerLive
    }),
  ),
  Layer.provide([
    Logger.replace(Logger.defaultLogger, Logger.prettyLogger({ mode: 'tty' })),
    Logger.minimumLogLevel(LogLevel.All),
  ]),
  Layer.orDie,
)

const scope = Effect.runSync(Scope.make())

dotenv.config({
  envKeysFile: path.join(workspaceRoot, '.env.keys'),
  overload: true,
  quiet: true,
  ignore: ['MISSING_ENV_FILE'],
})

const fiber = pipe(
  Effect.suspend(() => cli(process.argv)),
  Effect.provide(Live),
  Effect.provideService(Scope.Scope, scope),
  Effect.catchAllCause(Effect.logError),
  Effect.catchAllDefect(Effect.logError),
  Effect.runFork,
)

let shuttingDown = false
async function shutdown(code: number) {
  if (shuttingDown) return
  shuttingDown = true

  let timeoutHandle: NodeJS.Timeout | undefined
  const timeout = new Promise<'timeout'>((resolve) => {
    timeoutHandle = setTimeout(() => {
      console.warn('Graceful shutdown timeout, forcing exit')
      resolve('timeout')
    }, 50_000)
  })

  const cleanup = Promise.all([
    Effect.runPromise(Fiber.interrupt(fiber)),
    Effect.runPromise(Scope.close(scope, Exit.void)),
  ]).then(() => 'cleanup')

  const result = await Promise.race([cleanup, timeout])

  if (result === 'cleanup') {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle)
    }
  } else {
    cleanup.catch((error) => {
      if (error) {
        console.error('Cleanup rejected after timeout', error)
      }
    })
  }

  process.exit(code)
}

process.once('SIGINT', () => {
  shutdown(0)
})

process.once('SIGTERM', () => {
  void shutdown(0)
})

const keepAlive = setInterval(() => {}, 2 ** 31 - 1)

fiber.addObserver((exit) => {
  clearInterval(keepAlive)

  if (shuttingDown) {
    return
  }

  defaultTeardown(exit, (code) => shutdown(code))
})

process.on('unhandledRejection', (reason, p) => {
  if ((reason as any)?._tag) return

  console.error(reason, 'Unhandled Rejection at Promise', p)
})

process.on('uncaughtException', (error) => {
  if (error?.message.includes('fetch failed')) {
    return
  }

  console.error(error, 'Uncaught Exception thrown')
  process.exit(1)
})
