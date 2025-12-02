#!/usr/bin/env tsx

import * as dotenv from '@dotenvx/dotenvx'
import * as Otlp from '@effect/opentelemetry/Otlp'
import { NodeContext, NodeHttpClient } from '@effect/platform-node'
import { defaultTeardown } from '@effect/platform/Runtime'
import { workspaceRoot } from '@nx/devkit'
import { Effect, Exit, Fiber, Layer, Logger, LogLevel, pipe, Scope } from 'effect'
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
    resource: {
      serviceName: 'thing-cli',
      serviceVersion: '0.0.1',
    },
  }),
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

// ctrl + c 中断
async function onSigint() {
  await Effect.runPromise(Scope.close(scope, Exit.void))
  await Effect.runPromise(Fiber.interruptFork(fiber))
}

process.once('SIGINT', onSigint)
process.once('SIGTERM', onSigint)

const keepAlive = setInterval(() => {}, 2 ** 31 - 1)

// program 执行结束
fiber.addObserver((exit) => {
  clearInterval(keepAlive)
  defaultTeardown(exit, async (code) => {
    process.exit(code)
  })
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
