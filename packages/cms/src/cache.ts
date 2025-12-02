import type { KVNamespace } from '@cloudflare/workers-types'
import * as Option from 'effect/Option'

interface Cache {
  get: (key: string) => Promise<string | undefined>
  put: (key: string, value: string) => Promise<void>
  delete: (key: string) => Promise<void>
}

interface CacheEntry<T> {
  data: T
  timestamp: number
}

interface CachedCallOptions {
  /** Function to handle background tasks (e.g., globalThis.waitUntil in Cloudflare Workers) */
  waitUntil?: (promise: Promise<any>) => void
  /** Max age in seconds before considering data stale (default: 300 = 5 minutes) */
  maxAge?: number
}

const hashKey = (input: string): string => {
  let hash = 0
  if (input.length === 0) return hash.toString()
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36)
}

// Generate cache key from arguments
const generateCacheKey = (args: any[]): string => {
  const [projectId, ...rest] = args
  const keyString = JSON.stringify(rest)
  const hash = hashKey(keyString)
  return `${projectId}:${hash}`
}

const _map = new Map<string, string>()

export const memory: Cache = {
  get: async (key: string) => _map.get(key),
  put: async (key: string, value: any) => {
    _map.set(key, value)
  },
  delete: async (key: string) => {
    _map.delete(key)
  },
}

export const createKVCache = (kv: KVNamespace): Cache => ({
  get: async (key: string) => {
    try {
      const value = await kv.get(key)
      return value || undefined
    } catch {
      return undefined
    }
  },
  put: async (key: string, value: string) => {
    try {
      await kv.put(key, value, { expirationTtl: 7 * 24 * 60 * 60 }) // 7 days
    } catch {
      // Silent fail
    }
  },
  delete: async (key: string) => {
    try {
      await kv.delete(key)
    } catch {
      // Silent fail
    }
  },
})

export class CacheUtil {
  private _cache: Cache

  constructor(kvNamespace?: Option.Option<KVNamespace>) {
    if (kvNamespace && Option.isSome(kvNamespace)) {
      this._cache = createKVCache(kvNamespace.value)
    } else {
      this._cache = memory
    }
  }

  private async getCacheEntry<T>(key: string): Promise<CacheEntry<T> | undefined> {
    try {
      const cached = await this._cache.get(key)
      if (cached) {
        return JSON.parse(cached) as CacheEntry<T>
      }
    } catch {
      // Silent fail
    }
    return undefined
  }

  private async setCacheEntry<T>(key: string, data: T): Promise<void> {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
    }
    try {
      await this._cache.put(key, JSON.stringify(entry))
    } catch {
      // Silent fail
    }
  }

  async cachedCall<F extends () => Promise<any>>(
    fn: F,
    args: any[],
    options?: CachedCallOptions,
  ): Promise<Awaited<ReturnType<F>>> {
    const cacheKey = generateCacheKey(args)
    const maxAge = options?.maxAge ?? 60 * 60 * 1000 // 1 hour

    const cachedEntry = await this.getCacheEntry<Awaited<ReturnType<F>>>(cacheKey)

    if (cachedEntry) {
      const age = Date.now() - cachedEntry.timestamp
      const isStale = age > maxAge

      // If data is stale and we have waitUntil, refresh in background
      if (isStale && options?.waitUntil) {
        options.waitUntil(
          fn()
            .then((result) => this.setCacheEntry(cacheKey, result))
            .catch(() => {}),
        )
      }

      return cachedEntry.data
    }

    // Cache miss - fetch and cache
    const result = await fn()
    await this.setCacheEntry(cacheKey, result)
    return result
  }
}
