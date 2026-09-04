// ============================================
// CACHE ADAPTER TESTS
//
// Testiramo MemoryCacheAdapter (default).
// RedisCacheAdapter je težko testirati brez pravega Redis-a —
// integracijski testi so v tests/integration/redis-cache.test.ts (TODO).
// ============================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MemoryCacheAdapter } from '@/lib/cache/memory-adapter'

// Helper: set/delete env v testih brez TS pritožb o read-only
const setEnv = (key: string, value: string | undefined) => {
  if (value === undefined) {
    delete (process.env as Record<string, string | undefined>)[key]
  } else {
    ;(process.env as Record<string, string | undefined>)[key] = value
  }
}

describe('MemoryCacheAdapter', () => {
  let adapter: MemoryCacheAdapter

  beforeEach(() => {
    adapter = new MemoryCacheAdapter()
  })

  describe('set / get / take', () => {
    it('set → get vrne vrednost', async () => {
      await adapter.set('key1', 'value1', 60_000)
      const v = await adapter.get('key1')
      expect(v).toBe('value1')
    })

    it('set → take vrne vrednost in BRIŠE', async () => {
      await adapter.set('key1', 'value1', 60_000)
      const taken = await adapter.take('key1')
      expect(taken).toBe('value1')
      // Drugi get → null (deleted)
      const after = await adapter.get('key1')
      expect(after).toBeNull()
    })

    it('get za neobstoječi ključ vrne null', async () => {
      expect(await adapter.get('nonexistent')).toBeNull()
    })

    it('take za neobstoječi ključ vrne null', async () => {
      expect(await adapter.take('nonexistent')).toBeNull()
    })

    it('delete je idempotentna', async () => {
      await adapter.delete('never-existed') // ne sme vrziti
      await adapter.set('key1', 'value1', 60_000)
      await adapter.delete('key1')
      expect(await adapter.get('key1')).toBeNull()
    })

    it('set z istim ključem overwrite-a prejšnjo vrednost', async () => {
      await adapter.set('key1', 'value1', 60_000)
      await adapter.set('key1', 'value2', 60_000)
      expect(await adapter.get('key1')).toBe('value2')
    })
  })

  describe('TTL', () => {
    it('set z custom TTL — preteče po TTL', async () => {
      await adapter.set('short-lived', 'val', 50)
      await new Promise((r) => setTimeout(r, 100))
      expect(await adapter.get('short-lived')).toBeNull()
    })

    it('set je še veljaven tik pred TTL-jem', async () => {
      await adapter.set('medium-lived', 'val', 200)
      await new Promise((r) => setTimeout(r, 100))
      expect(await adapter.get('medium-lived')).toBe('val')
    })

    it('take za potekel entry vrne null', async () => {
      await adapter.set('expired', 'val', 50)
      await new Promise((r) => setTimeout(r, 100))
      expect(await adapter.take('expired')).toBeNull()
    })
  })

  describe('increment (rate-limit)', () => {
    it('prvi inkrement: count=1, remaining=max-1', async () => {
      const result = await adapter.increment('rl:test', 60_000, 5)
      expect(result.count).toBe(1)
      expect(result.remaining).toBe(4)
      expect(result.retryAfterMs).toBe(60_000)
    })

    it('drugi inkrement: count=2', async () => {
      await adapter.increment('rl:test2', 60_000, 5)
      const result = await adapter.increment('rl:test2', 60_000, 5)
      expect(result.count).toBe(2)
      expect(result.remaining).toBe(3)
    })

    it('count > max: remaining=0', async () => {
      for (let i = 0; i < 5; i++) {
        await adapter.increment('rl:max', 60_000, 5)
      }
      const result = await adapter.increment('rl:max', 60_000, 5)
      expect(result.count).toBe(6)
      expect(result.remaining).toBe(0)
    })

    it('po TTL-ju se counter reset-a', async () => {
      await adapter.increment('rl:ttl', 50, 5)
      await new Promise((r) => setTimeout(r, 100))
      const result = await adapter.increment('rl:ttl', 50, 5)
      expect(result.count).toBe(1)
    })

    it('različni ključi so neodvisni', async () => {
      await adapter.increment('rl:key-a', 60_000, 5)
      await adapter.increment('rl:key-a', 60_000, 5)
      await adapter.increment('rl:key-b', 60_000, 5)
      const a = await adapter.increment('rl:key-a', 60_000, 5)
      const b = await adapter.increment('rl:key-b', 60_000, 5)
      expect(a.count).toBe(3)
      expect(b.count).toBe(2)
    })
  })

  describe('utility', () => {
    it('clear izprazni vse', async () => {
      await adapter.set('key1', 'val1', 60_000)
      await adapter.set('key2', 'val2', 60_000)
      await adapter.increment('rl:x', 60_000, 5)
      await adapter.clear()
      expect(await adapter.size()).toBe(0)
    })

    it('size vrne skupno število vnosov', async () => {
      await adapter.set('k1', 'v1', 60_000)
      await adapter.set('k2', 'v2', 60_000)
      await adapter.increment('rl:k1', 60_000, 5)
      expect(await adapter.size()).toBeGreaterThanOrEqual(3)
    })
  })
})

describe('getCacheAdapter factory', () => {
  beforeEach(() => {
    vi.resetModules()
    setEnv('REDIS_URL', undefined)
  })

  afterEach(() => {
    setEnv('REDIS_URL', undefined)
  })

  it('vrne MemoryCacheAdapter ko REDIS_URL manjka', async () => {
    setEnv('REDIS_URL', undefined)
    const { getCacheAdapter, resetCacheAdapterForTesting } = await import('@/lib/cache')
    resetCacheAdapterForTesting()
    const adapter = getCacheAdapter()
    expect(adapter.name).toBe('memory')
  })

  it('vrne RedisCacheAdapter ko je REDIS_URL nastavljen', async () => {
    setEnv('REDIS_URL', 'redis://localhost:6379')
    const { getCacheAdapterAsync, resetCacheAdapterForTesting } = await import('@/lib/cache')
    resetCacheAdapterForTesting()
    const adapter = await getCacheAdapterAsync()
    expect(adapter.name).toBe('redis')
  })

  it('caching — drugi klic vrne isti instance', async () => {
    const { getCacheAdapter, resetCacheAdapterForTesting } = await import('@/lib/cache')
    resetCacheAdapterForTesting()
    const a = getCacheAdapter()
    const b = getCacheAdapter()
    expect(a).toBe(b)
  })

  it('resetCacheAdapterForTesting počisti cache', async () => {
    const { getCacheAdapter, resetCacheAdapterForTesting } = await import('@/lib/cache')
    const a = getCacheAdapter()
    resetCacheAdapterForTesting()
    const b = getCacheAdapter()
    expect(a).not.toBe(b)
  })
})
