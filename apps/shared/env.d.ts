/// <reference types="@cloudflare/workers-types" />
/// <reference types="react-router" />

/// <reference types="./i18n.d.ts" />
/// <reference types="./client.d.ts" />

import type * as LogLevel from 'effect/LogLevel'
import type { ManagedRuntime } from 'effect/ManagedRuntime'

interface AppEnv {
  NODE_ENV: 'development' | 'production'
  STAGE: 'test' | 'staging' | 'production'
  LOG_LEVEL: LogLevel.Literal

  SANITY_STUDIO_PROJECT_ID: string | undefined
  SANITY_STUDIO_DATASET: string | undefined
  SANITY_STUDIO_API_TOKEN: string | undefined

  AXIOM_TOKEN: string | undefined
  AXIOM_DATASET: string | undefined
}

type GlobalEnv = AppEnv & {
  RATELIMITER: Fetcher
  PURCHASE: Fetcher

  CMS_KV: KVNamespace
  DB: D1Database

  SERVER: Fetcher
}

interface AppContext {
  env: GlobalEnv
  caches: CacheStorage
  runtime: ManagedRuntime<never, never>
  waitUntil: ExecutionContext['waitUntil']
  passThroughOnException: ExecutionContext['passThroughOnException']
}

import type * as ServerSchema from '@server/schema'

declare global {
  var process: {
    env: AppEnv
  }

  declare type UserWithSensitive = ServerSchema.UserWithSensitive
}

import 'react-router'

declare module 'react-router' {
  interface AppLoadContext extends AppContext {}
}
