// ============================================
// RATE LIMIT TESTS — Issue #39
//
// 3 ključni testi:
// 1. MemoryCacheAdapter normal → rate limit deluje
// 2. Cache failure → FAIL-CLOSED (request rejected, ne dovoljen)
// 3. Concurrent requests → atomic limit
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { checkRateLimitAsync } from '@/lib/rate-limit/core'
import type { RateLimitConfig } from '@/lib/rate-limit/presets'

const TEST_CONFIG: RateLimitConfig = {
  windowMs: 60_000, // 1 min
  maxRequests: 3, // 3 req/min
}

describe('Issue #39: Rate Limit Fail-Closed', () => {
  describe('Test 1: Normal operation (Memory adapter)', () => {
    it('should allow requests under limit', async () => {
      const ip = '192.168.1.100-test1'

      const r1 = await checkRateLimitAsync('test', ip, TEST_CONFIG)
      expect(r1.allowed).toBe(true)
      expect(r1.remaining).toBe(2)

      const r2 = await checkRateLimitAsync('test', ip, TEST_CONFIG)
      expect(r2.allowed).toBe(true)
      expect(r2.remaining).toBe(1)

      const r3 = await checkRateLimitAsync('test', ip, TEST_CONFIG)
      expect(r3.allowed).toBe(true)
      expect(r3.remaining).toBe(0)
    })

    it('should reject requests over limit', async () => {
      const ip = '192.168.1.101-test1'

      // Use up all 3 requests
      await checkRateLimitAsync('test', ip, TEST_CONFIG)
      await checkRateLimitAsync('test', ip, TEST_CONFIG)
      await checkRateLimitAsync('test', ip, TEST_CONFIG)

      // 4th request should be rejected
      const r4 = await checkRateLimitAsync('test', ip, TEST_CONFIG)
      expect(r4.allowed).toBe(false)
      expect(r4.remaining).toBe(0)
      expect(r4.retryAfterMs).toBeGreaterThan(0)
    })
  })

  describe('Test 2: Cache failure → FAIL-CLOSED', () => {
    it('should REJECT request when cache.increment() throws (Redis down)', async () => {
      // FIX: Reset module cache before mocking so dynamic import gets fresh module
      vi.resetModules()
      // Mock getCacheAdapter to return a broken adapter
      vi.doMock('@/lib/cache', () => ({
        getCacheAdapter: () => ({
          name: 'redis-broken',
          increment: async () => {
            throw new Error('ECONNREFUSED 127.0.0.1:6379')
          },
          get: async () => null,
          set: async () => {},
          delete: async () => {},
        }),
      }))

      // Re-import with mock
      const { checkRateLimitAsync: mockedCheck } = await import('@/lib/rate-limit/core')

      const result = await mockedCheck('test', '192.168.1.200-test2', TEST_CONFIG)

      // 🔴 FAIL-CLOSED: request must be REJECTED, not allowed
      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
      expect(result.retryAfterMs).toBe(TEST_CONFIG.windowMs)

      vi.doUnmock('@/lib/cache')
    })

    it('should NOT allow brute-force when Redis is down', async () => {
      vi.resetModules()
      vi.doMock('@/lib/cache', () => ({
        getCacheAdapter: () => ({
          name: 'redis-broken',
          increment: async () => {
            throw new Error('Redis timeout')
          },
          get: async () => null,
          set: async () => {},
          delete: async () => {},
        }),
      }))

      const { checkRateLimitAsync: mockedCheck } = await import('@/lib/rate-limit/core')

      // Simulate 100 rapid requests with Redis down
      for (let i = 0; i < 100; i++) {
        const result = await mockedCheck('brute-force', '10.0.0.1', {
          windowMs: 60_000,
          maxRequests: 5,
        })
        // Every single request must be rejected
        expect(result.allowed).toBe(false)
      }

      vi.doUnmock('@/lib/cache')
    })
  })

  describe('Test 3: Concurrent requests → atomic limit', () => {
    it('should enforce limit atomically across concurrent requests', async () => {
      const ip = '192.168.1.300-test3'
      const config: RateLimitConfig = { windowMs: 60_000, maxRequests: 5 }

      // Fire 10 concurrent requests
      const results = await Promise.all(
        Array.from({ length: 10 }, () =>
          checkRateLimitAsync('concurrent-test', ip, config)
        )
      )

      const allowed = results.filter((r) => r.allowed)
      const rejected = results.filter((r) => !r.allowed)

      // Exactly 5 should be allowed, 5 rejected (atomic limit)
      // Note: with MemoryCacheAdapter, increment is synchronous so this should work
      expect(allowed.length).toBeLessThanOrEqual(5)
      expect(rejected.length).toBeGreaterThanOrEqual(5)
    })

    it('should not allow more than maxRequests even with race condition', async () => {
      const ip = '192.168.1.301-test3b'
      const config: RateLimitConfig = { windowMs: 60_000, maxRequests: 3 }

      // Fire 50 concurrent requests
      const results = await Promise.all(
        Array.from({ length: 50 }, () =>
          checkRateLimitAsync('race-test', ip, config)
        )
      )

      const allowed = results.filter((r) => r.allowed)

      // Must not allow more than 3 (the limit)
      expect(allowed.length).toBeLessThanOrEqual(3)
    })
  })
})
