// ============================================
// CACHE FACTORY — singleton accessor
//
// Enostopenjski factory ki vrne MemoryCacheAdapter ali RedisCacheAdapter
// glede na REDIS_URL env spremenljivko.
//
// Uporaba:
//   import { getCacheAdapter } from '@/lib/cache'
//   const cache = getCacheAdapter()
//   await cache.set('key', 'value', 60_000)
//
// V dev okolju (brez REDIS_URL): MemoryCacheAdapter (default)
// V produkciji z REDIS_URL: RedisCacheAdapter (multi-replica safe)
//
// Issue #39 FIXED: checkRateLimitAsync() je fail-closed (Redis down → reject)
// WebAuthn challenge store + rate limit sta sedaj environment-aware.
// ============================================

import type { CacheAdapter } from './adapter'
import { MemoryCacheAdapter } from './memory-adapter'

let cachedAdapter: CacheAdapter | null = null
let useRedisLogShown = false

/**
 * Vrni cache adapter singleton.
 *
 * Logika:
 *   1. Če je REDIS_URL nastavljen → RedisCacheAdapter (multi-replica safe)
 *   2. Sicer → MemoryCacheAdapter (default, single-instance safe)
 *
 * Lazy-import: ioredis se ne load-a v dev (tree-shaking).
 */
/**
 * Vrni cache adapter singleton (sinhrono — za MemoryCacheAdapter).
 *
 * Za RedisCacheAdapter uporabi getCacheAdapterAsync() — require/import ioredis
 * je async operacija.
 */
export function getCacheAdapter(): CacheAdapter {
  if (cachedAdapter) return cachedAdapter

  if (!process.env.REDIS_URL) {
    // Default: MemoryCacheAdapter (sync init)
    cachedAdapter = new MemoryCacheAdapter()
    return cachedAdapter
  }

  // Če je REDIS_URL nastavljen, kliči async verzijo — vendar sinhrono inicializacijo
  // povzročimo preko global cache da lazy-import na prvi set/get/incr klic
  if (!useRedisLogShown && typeof console !== 'undefined') {
    console.info('[cache] Will use RedisCacheAdapter (REDIS_URL set) — multi-replica safe. Initializing...')
    useRedisLogShown = true
  }
  // Lazy-init: ustvarimo wrapper adapter ki na prvi klic naloži RedisCacheAdapter
  cachedAdapter = createLazyRedisAdapter()
  return cachedAdapter
}

/**
 * Async verzija za eksplicitno inicializacijo RedisCacheAdapter.
 * Uporablja se v testih in v boot scripti.
 */
export async function getCacheAdapterAsync(): Promise<CacheAdapter> {
  if (cachedAdapter) return cachedAdapter

  if (!process.env.REDIS_URL) {
    cachedAdapter = new MemoryCacheAdapter()
    return cachedAdapter
  }

  const { RedisCacheAdapter } = await import('./redis-adapter')
  cachedAdapter = new RedisCacheAdapter('restaurantos:')
  return cachedAdapter
}

/**
 * Lazy Redis adapter — na prvi async operaciji naloži pravi RedisCacheAdapter.
 * Sync operacije (ki jih kliče checkRateLimit sync wrapper) bodo padle
 * v MemoryCacheAdapter fallback dokler async init ne konča.
 */
function createLazyRedisAdapter(): CacheAdapter {
  let redisAdapterPromise: Promise<CacheAdapter> | null = null
  let redisAdapter: CacheAdapter | null = null
  let memoryFallback = new MemoryCacheAdapter()

  const ensureRedis = async (): Promise<CacheAdapter> => {
    if (redisAdapter) return redisAdapter
    if (!redisAdapterPromise) {
      redisAdapterPromise = import('./redis-adapter').then(({ RedisCacheAdapter }) => {
        redisAdapter = new RedisCacheAdapter('restaurantos:')
        return redisAdapter
      })
    }
    return redisAdapterPromise
  }

  // Vrni Proxy ki preusmerja vse klice na ustrezen adapter
  return {
    name: 'redis-lazy',
    async set(key, value, ttlMs) {
      const adapter = await ensureRedis()
      await adapter.set(key, value, ttlMs)
    },
    async take(key) {
      const adapter = await ensureRedis()
      return adapter.take(key)
    },
    async get(key) {
      const adapter = await ensureRedis()
      return adapter.get(key)
    },
    async delete(key) {
      const adapter = await ensureRedis()
      await adapter.delete(key)
    },
    async increment(key, windowMs, maxRequests) {
      const adapter = await ensureRedis()
      return adapter.increment(key, windowMs, maxRequests)
    },
    async clear() {
      const adapter = await ensureRedis()
      await adapter.clear()
    },
    async size() {
      const adapter = await ensureRedis()
      return adapter.size()
    },
  }
}

/**
 * Reset singleton (samo za teste).
 * Pomembno: če hočeš testirati MemoryCacheAdapter, najprej unset REDIS_URL
 * nato pokliči to funkcijo.
 */
export function resetCacheAdapterForTesting(): void {
  cachedAdapter = null
  useRedisLogShown = false
}

export type { CacheAdapter, CacheValue, RateLimitConfig, RateLimitResult } from './adapter'
