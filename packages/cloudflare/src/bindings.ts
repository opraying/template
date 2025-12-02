import type {
  Ai,
  AnalyticsEngineDataset,
  D1Database,
  DurableObjectNamespace,
  Hyperdrive,
  ImagesBinding,
  KVNamespace,
  Queue,
  R2Bucket,
  RateLimit,
  Socket,
  SocketAddress,
  SocketOptions,
  Vectorize,
} from '@cloudflare/workers-types'
import * as Context from 'effect/Context'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import * as Layer from 'effect/Layer'
import * as Option from 'effect/Option'

type Fetcher = {
  fetch(input: globalThis.RequestInfo | URL, init?: globalThis.RequestInit): Promise<globalThis.Response>
  connect(address: SocketAddress | string, options?: SocketOptions): Socket
}

type Binding =
  | KVNamespace
  | R2Bucket
  | D1Database
  | DurableObjectNamespace
  | Queue
  | ImagesBinding
  | Hyperdrive
  | AnalyticsEngineDataset
  | Vectorize
  | Ai
  | RateLimit
  | Fetcher

// TODO: add BrowserRender support

type BindingType =
  | 'kv'
  | 'r2'
  | 'd1'
  | 'durable_object'
  | 'queue'
  | 'images'
  | 'hyperdrive'
  | 'analytics_engine'
  | 'vectorize'
  | 'ai'
  | 'rate_limit'
  | 'fetcher'

interface BindingMetadata {
  name: string
  type: BindingType
  value: Binding
}

interface Bindings {
  readonly getD1Database: (name: string) => Effect.Effect<Option.Option<D1Database>>

  readonly getKVNamespace: (name: string) => Effect.Effect<Option.Option<KVNamespace>>

  readonly getR2Bucket: (name: string) => Effect.Effect<Option.Option<R2Bucket>>

  readonly getDurableObjectNamespace: (name: string) => Effect.Effect<Option.Option<DurableObjectNamespace>>

  readonly getQueue: <Body = unknown>(name: string) => Effect.Effect<Option.Option<Queue<Body>>>

  readonly getImagesBinding: (name: string) => Effect.Effect<Option.Option<ImagesBinding>>

  readonly getHyperdrive: (name: string) => Effect.Effect<Option.Option<Hyperdrive>>

  readonly getAnalyticsEngineDataset: (name: string) => Effect.Effect<Option.Option<AnalyticsEngineDataset>>

  readonly getVectorize: (name: string) => Effect.Effect<Option.Option<Vectorize>>

  readonly getAi: (name: string) => Effect.Effect<Option.Option<Ai>>

  readonly getRateLimit: (name: string) => Effect.Effect<Option.Option<RateLimit>>

  readonly getFetcher: (name: string) => Effect.Effect<Option.Option<Fetcher>>

  readonly getD1Databases: () => Effect.Effect<D1Database[]>

  readonly getKVNamespaces: () => Effect.Effect<KVNamespace[]>

  readonly getR2Buckets: () => Effect.Effect<R2Bucket[]>

  readonly getQueues: <Body = unknown>() => Effect.Effect<Queue<Body>[]>

  readonly getBindings: () => Effect.Effect<Record<string, Binding>>

  readonly hasBinding: (name: string) => Effect.Effect<boolean>

  readonly getEnv: () => Effect.Effect<Record<string, any>>

  readonly getRaw: () => Effect.Effect<Record<string, any>>
}

/**
 * Infer binding type from the binding name using naming conventions
 *
 * Naming conventions:
 * - D1 Database: `DB`, `*_DB`, `*_DATABASE`
 * - KV Namespace: `KV`, `*_KV`
 * - R2 Bucket: `R2`, `*_R2`, `*_BUCKET`
 * - AI: `AI`, `*_AI`
 * - Queue: contains `QUEUE`
 * - Analytics: contains `EVENTS` or `ANALYTICS`
 * - Durable Object: contains `DURABLE_OBJECT` or starts with `DO_`
 * - Vectorize: contains `VECTORIZE` or `VECTOR`
 * - Images: contains `IMAGE`
 * - Hyperdrive: contains `HYPERDRIVE`
 * - Rate Limit: exact match `RATE_LIMIT` or `RATELIMIT`
 * - Fetcher (Service): default for unknown object types
 */
const inferBindingTypeFromName = (name: string): BindingType | null => {
  const upper = name.toUpperCase()

  // D1 Database - most specific matches first
  if (upper === 'DB' || upper.endsWith('_DB') || upper.endsWith('_DATABASE')) {
    return 'd1'
  }

  // KV Namespace
  if (upper === 'KV' || upper.endsWith('_KV')) {
    return 'kv'
  }

  // R2 Bucket
  if (upper === 'R2' || upper.endsWith('_R2') || upper.endsWith('_BUCKET')) {
    return 'r2'
  }

  // AI
  if (upper === 'AI' || upper.endsWith('_AI')) {
    return 'ai'
  }

  // Queue
  if (upper.includes('QUEUE')) {
    return 'queue'
  }

  // Analytics Engine / Events
  if (upper.includes('EVENTS') || upper.includes('ANALYTICS') || upper.includes('TELEMETRY')) {
    return 'analytics_engine'
  }

  // Durable Object
  if (upper.includes('DURABLE_OBJECT') || upper.startsWith('DO_')) {
    return 'durable_object'
  }

  // Vectorize
  if (upper.includes('VECTORIZE') || upper.includes('VECTOR')) {
    return 'vectorize'
  }

  // Images
  if (upper.includes('IMAGE')) {
    return 'images'
  }

  // Hyperdrive
  if (upper.includes('HYPERDRIVE')) {
    return 'hyperdrive'
  }

  // Rate Limit - be specific to avoid false matches
  if (upper.includes('RATE_LIMIT_TIER')) {
    return 'rate_limit'
  }

  return null
}

const make = (env: Record<string, any>): Bindings => {
  const bindingsMap = new Map<string, BindingMetadata>()
  const envRecord: Record<string, any> = {}

  for (const [key, value] of Object.entries(env)) {
    // Filter primitive types
    //  string | number | boolean | null
    if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      // Primitive types go to envRecord
      envRecord[key] = value
    } else {
      // Infer type from binding name, default to 'fetcher' for unknown object types
      const bindingType = inferBindingTypeFromName(key) ?? 'fetcher'

      bindingsMap.set(key, {
        name: key,
        type: bindingType,
        value: value as Binding,
      })
    }
  }

  const getBindingByType = <T extends Binding>(name: string, expectedType: BindingType): Option.Option<T> => {
    const binding = bindingsMap.get(name)
    if (!binding || binding.type !== expectedType) {
      return Option.none()
    }
    return Option.some(binding.value as T)
  }

  const getBindingsByType = <T extends Binding>(type: BindingType): T[] => {
    return Array.from(bindingsMap.values())
      .filter((binding) => binding.type === type)
      .map((binding) => binding.value as T)
  }

  return {
    getD1Database: (name: string): Effect.Effect<Option.Option<D1Database>> =>
      Effect.sync(() => getBindingByType<D1Database>(name, 'd1')),

    getKVNamespace: (name: string): Effect.Effect<Option.Option<KVNamespace>> =>
      Effect.sync(() => getBindingByType<KVNamespace>(name, 'kv')),

    getR2Bucket: (name: string): Effect.Effect<Option.Option<R2Bucket>> =>
      Effect.sync(() => getBindingByType<R2Bucket>(name, 'r2')),

    getDurableObjectNamespace: (name: string): Effect.Effect<Option.Option<DurableObjectNamespace>> =>
      Effect.sync(() => getBindingByType<DurableObjectNamespace>(name, 'durable_object')),

    getQueue: <Body = unknown>(name: string): Effect.Effect<Option.Option<Queue<Body>>> =>
      Effect.sync(() => getBindingByType<Queue<Body>>(name, 'queue')),

    getImagesBinding: (name: string): Effect.Effect<Option.Option<ImagesBinding>> =>
      Effect.sync(() => getBindingByType<ImagesBinding>(name, 'images')),

    getHyperdrive: (name: string): Effect.Effect<Option.Option<Hyperdrive>> =>
      Effect.sync(() => getBindingByType<Hyperdrive>(name, 'hyperdrive')),

    getAnalyticsEngineDataset: (name: string): Effect.Effect<Option.Option<AnalyticsEngineDataset>> =>
      Effect.sync(() => getBindingByType<AnalyticsEngineDataset>(name, 'analytics_engine')),

    getVectorize: (name: string): Effect.Effect<Option.Option<Vectorize>> =>
      Effect.sync(() => getBindingByType<Vectorize>(name, 'vectorize')),

    getAi: (name: string): Effect.Effect<Option.Option<Ai>> => Effect.sync(() => getBindingByType<Ai>(name, 'ai')),

    getRateLimit: (name: string): Effect.Effect<Option.Option<RateLimit>> =>
      Effect.sync(() => getBindingByType<RateLimit>(name, 'rate_limit')),

    getFetcher: (name: string): Effect.Effect<Option.Option<Fetcher>> =>
      Effect.sync(() => getBindingByType<Fetcher>(name, 'fetcher')),

    getD1Databases: (): Effect.Effect<D1Database[]> => Effect.sync(() => getBindingsByType<D1Database>('d1')),

    getKVNamespaces: (): Effect.Effect<KVNamespace[]> => Effect.sync(() => getBindingsByType<KVNamespace>('kv')),

    getR2Buckets: (): Effect.Effect<R2Bucket[]> => Effect.sync(() => getBindingsByType<R2Bucket>('r2')),

    getQueues: <Body = unknown>(): Effect.Effect<Queue<Body>[]> =>
      Effect.sync(() => getBindingsByType<Queue<Body>>('queue')),

    getBindings: (): Effect.Effect<Record<string, Binding>> =>
      Effect.sync(() => Object.fromEntries(Array.from(bindingsMap.entries()).map(([key, meta]) => [key, meta.value]))),

    hasBinding: (name: string): Effect.Effect<boolean> => Effect.sync(() => bindingsMap.has(name)),

    getEnv: (): Effect.Effect<Record<string, any>> => Effect.sync(() => envRecord),

    getRaw: (): Effect.Effect<Record<string, any>> => Effect.sync(() => env),
  }
}

export class CloudflareBindings extends Context.Tag('@cloudflare:bindings')<CloudflareBindings, Bindings>() {
  /**
   * Create a Layer from Cloudflare Worker's environment object.
   * Binding types are inferred automatically from binding names using naming conventions.
   *
   * @param env Cloudflare Worker's env object containing all bindings
   *
   * @example
   * ```ts
   * // Naming conventions for auto-detection:
   * // - D1 Database: DB, *_DB, *_DATABASE
   * // - KV Namespace: KV, *_KV
   * // - R2 Bucket: R2, *_R2, *_BUCKET
   * // - AI: AI, *_AI
   * // - Events: *EVENTS, *ANALYTICS
   * // - Queue: *QUEUE
   * // - Services (Fetcher): PURCHASE, EMAILER, RATELIMITER, etc.
   *
   * const layer = CloudflareBindings.fromEnv(env)
   * ```
   */
  static fromEnv(env: Record<string, any>): Layer.Layer<CloudflareBindings> {
    return Layer.succeed(CloudflareBindings, make(env))
  }

  static use<A>(fn: (bindings: Bindings) => Effect.Effect<A>): Effect.Effect<A> {
    return pipe(
      Effect.context<never>(),
      Effect.flatMap((ctx) => fn(Context.unsafeGet(ctx, CloudflareBindings))),
    )
  }

  static hasBinding(name: string): Effect.Effect<boolean> {
    return CloudflareBindings.use((bindings) => bindings.hasBinding(name))
  }

  static getBindings(): Effect.Effect<Record<string, Binding>> {
    return CloudflareBindings.use((bindings) => bindings.getBindings())
  }

  static getEnv(): Effect.Effect<Record<string, any>> {
    return CloudflareBindings.use((bindings) => bindings.getEnv())
  }

  static getRaw(): Effect.Effect<Record<string, any>> {
    return CloudflareBindings.use((bindings) => bindings.getRaw())
  }
}
