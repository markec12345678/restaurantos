// ============================================
// MEMORY CACHE ADAPTER (default)
//
// Uporablja se ko:
//   - REDIS_URL env spremenljivka manjka
//   - V dev okolju (localhost)
//   - V single-instance production deploy-u (1 VPS, 1 Docker container, ...)
//
// Issue #39: v multi-replica deploymentu (Vercel/Render) NE deluje pravilno
// — vsaka replica ima svoj Map, ki je ne sinhroniziran.
// Za multi-replica konfiguracijo nastavi REDIS_URL in uporabi RedisCacheAdapter.
// ============================================

import type { CacheAdapter, CacheValue, RateLimitConfig } from './adapter'

interface Entry {
  value: CacheValue
  expiresAt: number
}

interface RateLimitEntry {
  count: number
  resetAt: number
}

interface IncrementResult {
  count: number
  retryAfterMs: number
  remaining: number
}

// Cleanup interval — odstrani potekle vnose da preprečimo memory leak
const CLEANUP_INTERVAL_MS = 60_000
const MAX_ENTRIES = 10_000 // cap da preprečimo memory exhaustion pod DDoS

export class MemoryCacheAdapter implements CacheAdapter {
  readonly name = 'memory'

  private store = new Map<string, Entry>()
  private rateLimitStore = new Map<string, RateLimitEntry>()
  private cleanupTimer: NodeJS.Timeout | null = null

  constructor() {
    this.startCleanup()
  }

  private startCleanup(): void {
    if (this.cleanupTimer) return
    if (typeof setInterval === 'undefined') return // Edge runtime

    this.cleanupTimer = setInterval(() => {
      const now = Date.now()
      for (const [key, entry] of this.store) {
        if (entry.expiresAt < now) this.store.delete(key)
      }
      for (const [key, entry] of this.rateLimitStore) {
        if (entry.resetAt <= now) this.rateLimitStore.delete(key)
      }
    }, CLEANUP_INTERVAL_MS)

    if (typeof this.cleanupTimer.unref === 'function') {
      this.cleanupTimer.unref()
    }
  }

  async set(key: string, value: CacheValue, ttlMs: number): Promise<void> {
    this.enforceCap()
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    })
  }

  async take(key: string): Promise<CacheValue | null> {
    const entry = this.store.get(key)
    // Vedno izbriši — tudi če je potekel (one-shot semantics)
    this.store.delete(key)
    if (!entry) return null
    if (entry.expiresAt < Date.now()) return null
    return entry.value
  }

  async get(key: string): Promise<CacheValue | null> {
    const entry = this.store.get(key)
    if (!entry) return null
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key)
      return null
    }
    return entry.value
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key)
  }

  async increment(
    key: string,
    windowMs: number,
    maxRequests: number,
  ): Promise<IncrementResult> {
    const now = Date.now()
    let entry = this.rateLimitStore.get(key)

    // Reset če je potekel
    if (entry && entry.resetAt <= now) {
      this.rateLimitStore.delete(key)
      entry = undefined
    }

    if (!entry) {
      // Prvi zahtevek v oknu
      this.enforceRateLimitCap()
      this.rateLimitStore.set(key, {
        count: 1,
        resetAt: now + windowMs,
      })
      return {
        count: 1,
        retryAfterMs: windowMs,
        remaining: maxRequests - 1,
      }
    }

    // Inkrementiraj
    entry.count++
    return {
      count: entry.count,
      retryAfterMs: entry.resetAt - now,
      remaining: Math.max(0, maxRequests - entry.count),
    }
  }

  async clear(): Promise<void> {
    this.store.clear()
    this.rateLimitStore.clear()
  }

  async size(): Promise<number> {
    return this.store.size + this.rateLimitStore.size
  }

  /**
   * Prepreči memory exhaustion — če presežemo MAX_ENTRIES, izbrišemo najstarejše.
   * Map ohrani insertion order, tako da je first() najstarejši.
   */
  private enforceCap(): void {
    if (this.store.size >= MAX_ENTRIES) {
      const firstKey = this.store.keys().next().value
      if (firstKey) this.store.delete(firstKey)
    }
  }

  private enforceRateLimitCap(): void {
    if (this.rateLimitStore.size >= MAX_ENTRIES) {
      const firstKey = this.rateLimitStore.keys().next().value
      if (firstKey) this.rateLimitStore.delete(firstKey)
    }
  }
}
