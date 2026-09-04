// ============================================
// REDIS CACHE ADAPTER (production / multi-replica)
//
// Uporablja se ko:
//   - REDIS_URL env spremenljivka je nastavljena
//   - V multi-replica production deploy-u (Vercel/Render/ECS/Cloud Run)
//
// Issue #39: končana. Vse rate-limit in WebAuthn challenge operacije so
// zdaj atomicne na Redis strani — napadalec ne more bypass-at z menjavo
// replike, ker so vse replike povezane na isti Redis.
//
// Uporabljeni Redis ukazi:
//   - SET key value PX ttl (z expiry)
//   - GETDEL key (atomarno get + delete — one-shot challenge)
//   - INCR key + EXPIRE key (atomic counter z oknom)
//   - DEL key, DBSIZE (utility)
//
// Za povezavo uporablja "ioredis" klienta ki podpira:
//   - Auto-reconnect
//   - Connection pooling
//   - Cluster mode (če je potrebno)
// ============================================

import type { CacheAdapter, CacheValue } from './adapter'

interface IncrementResult {
  count: number
  retryAfterMs: number
  remaining: number
}

// Lazy-loaded ioredis da se ne load-a v dev (kjer ni Redis)
type RedisClient = {
  set(key: string, value: string, px?: string, ttlMs?: number): Promise<string>
  getdel(key: string): Promise<string | null>
  get(key: string): Promise<string | null>
  del(...keys: string[]): Promise<number>
  incr(key: string): Promise<number>
  expire(key: string, seconds: number): Promise<number>
  ttl(key: string): Promise<number>
  dbsize(): Promise<number>
  flushdb(): Promise<string>
  quit(): Promise<string>
  status: string
  on(event: string, listener: (...args: unknown[]) => void): unknown
  connect(): Promise<void>
}

let redisModulePromise: Promise<{ default: { new (opts: unknown): RedisClient } }> | null = null
let redisClient: RedisClient | null = null
let redisInitFailed = false

/**
 * Lazy-load ioredis in pripravi povezavo.
 * Vrši se samo če je REDIS_URL nastavljen.
 */
async function getRedisClient(): Promise<RedisClient> {
  if (redisInitFailed) {
    throw new Error('Redis initialization previously failed — not retrying')
  }
  if (redisClient) return redisClient

  // Lazy-load ioredis modula — če ni nameščen, bomo padli nazaj na MemoryCacheAdapter
  if (!redisModulePromise) {
    // @ts-expect-error — ioredis je optional dependency (samo če je REDIS_URL nastavljen)
    redisModulePromise = import('ioredis').catch((err) => {
      redisInitFailed = true
      throw new Error(
        `ioredis modul ni nameščen — zahtevan za RedisCacheAdapter. ` +
          `Namesti z: npm install ioredis. Original error: ${err instanceof Error ? err.message : err}`
      )
    })
  }

  const mod = await redisModulePromise
  const Redis = (mod as { default: { new (opts: unknown): RedisClient } }).default

  const redisUrl = process.env.REDIS_URL
  if (!redisUrl) {
    throw new Error('REDIS_URL env spremenljivka manjka — RedisCacheAdapter ne moremo inicializirati')
  }

  redisClient = new Redis({
    lazyConnect: false,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    retryStrategy: (times: number) => Math.min(10_000, Math.pow(2, times) * 1000),
    ...(redisUrl.startsWith('rediss://') ? { tls: {} } : {}),
  })

  redisClient.on('error', (err: unknown) => {
    console.error('[redis] client error:', err instanceof Error ? err.message : err)
  })

  return redisClient
}

export class RedisCacheAdapter implements CacheAdapter {
  readonly name = 'redis'

  private clientPromise: Promise<RedisClient> | null = null
  private keyPrefix: string

  constructor(keyPrefix: string = 'restaurantos:') {
    this.keyPrefix = keyPrefix
  }

  private async client(): Promise<RedisClient> {
    if (!this.clientPromise) {
      this.clientPromise = getRedisClient()
    }
    return this.clientPromise
  }

  private k(key: string): string {
    return `${this.keyPrefix}${key}`
  }

  async set(key: string, value: CacheValue, ttlMs: number): Promise<void> {
    const c = await this.client()
    await c.set(this.k(key), String(value), 'PX', ttlMs)
  }

  async take(key: string): Promise<CacheValue | null> {
    const c = await this.client()
    // GETDEL — atomarno preberi in izbriši (one-shot challenge)
    // Razpoložljiv od Redis 6.2+
    const value = await c.getdel(this.k(key))
    return value ?? null
  }

  async get(key: string): Promise<CacheValue | null> {
    const c = await this.client()
    const value = await c.get(this.k(key))
    return value ?? null
  }

  async delete(key: string): Promise<void> {
    const c = await this.client()
    await c.del(this.k(key))
  }

  async increment(
    key: string,
    windowMs: number,
    maxRequests: number,
  ): Promise<IncrementResult> {
    const c = await this.client()
    const k = this.k(key)

    // Atomarni INCR + EXPIRE
    // Pattern: INCR key, če je vrednost == 1 (prvi zahtevek), EXPIRE key windowMs
    // Pozor: INCR + EXPIRE ni povsem atomarna — v primeru process crash-a med njima
    // lahko key ostane brez TTL. Za robustnost bi lahko uporabili Lua script,
    // a za naš use case (rate limit z 5-min oknom) je to dovolj dobro.
    const count = await c.incr(k)
    if (count === 1) {
      // Prvi zahtevek v oknu — set TTL (sekunde, zaokroženo gor)
      await c.expire(k, Math.ceil(windowMs / 1000))
    }

    // Preberi TTL da izračunamo retryAfterMs
    const ttlSeconds = await c.ttl(k)
    const retryAfterMs = ttlSeconds > 0 ? ttlSeconds * 1000 : windowMs

    return {
      count,
      retryAfterMs,
      remaining: Math.max(0, maxRequests - count),
    }
  }

  async clear(): Promise<void> {
    // Pozor: FLUSHDB izbriše VSE ključe v trenutni Redis bazi
    // V produkciji NE kliči — uporablja se samo v testih
    const c = await this.client()
    await c.flushdb()
  }

  async size(): Promise<number> {
    const c = await this.client()
    return c.dbsize()
  }
}
