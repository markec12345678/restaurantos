// ============================================
// PIN Lookup — HMAC-SHA256 za O(1) iskanje PIN-a
// Unit testi za hashPinLookup in pinLookupEnabled
// ============================================
import { describe, it, expect, beforeEach, vi, afterAll } from 'vitest'

const ORIGINAL_SECRET = process.env.NEXTAUTH_SECRET

describe('pin-lookup', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  describe('hashPinLookup', () => {
    it('vrne prazen string če NEXTAUTH_SECRET manjka', async () => {
      delete process.env.NEXTAUTH_SECRET
      const { hashPinLookup } = await import('@/lib/pin-lookup')
      expect(hashPinLookup('1234')).toBe('')
      expect(hashPinLookup('0000')).toBe('')
    })

    it('vrne prazen string za prazen PIN', async () => {
      process.env.NEXTAUTH_SECRET = 'test-secret'
      const { hashPinLookup } = await import('@/lib/pin-lookup')
      expect(hashPinLookup('')).toBe('')
    })

    it('vrne HMAC-SHA256 hex string (64 znakov) ko je secret nastavljen', async () => {
      process.env.NEXTAUTH_SECRET = 'test-secret-12345'
      const { hashPinLookup } = await import('@/lib/pin-lookup')
      const result = hashPinLookup('1234')
      expect(result).toMatch(/^[a-f0-9]{64}$/)
      expect(result).not.toBe('')
    })

    it('je determinističen — isti PIN + isti secret = isti hash', async () => {
      process.env.NEXTAUTH_SECRET = 'deterministic-secret'
      const { hashPinLookup } = await import('@/lib/pin-lookup')
      const h1 = hashPinLookup('1234')
      const h2 = hashPinLookup('1234')
      expect(h1).toBe(h2)
    })

    it('različni PIN-i dajo različne hashe', async () => {
      process.env.NEXTAUTH_SECRET = 'test-secret'
      const { hashPinLookup } = await import('@/lib/pin-lookup')
      const h1 = hashPinLookup('1234')
      const h2 = hashPinLookup('5678')
      expect(h1).not.toBe(h2)
    })

    it('različni secret-i dajejo različne hashe za isti PIN', async () => {
      process.env.NEXTAUTH_SECRET = 'secret-A'
      const { hashPinLookup: hashA } = await import('@/lib/pin-lookup')
      const hA = hashA('1234')

      process.env.NEXTAUTH_SECRET = 'secret-B'
      vi.resetModules()
      const { hashPinLookup: hashB } = await import('@/lib/pin-lookup')
      const hB = hashB('1234')

      expect(hA).not.toBe(hB)
    })

    it('vsi 10.000 4-mestnih PINov (0000-9999) dajejo unikatne hashe (brez kolizij)', async () => {
      process.env.NEXTAUTH_SECRET = 'collision-test-secret'
      const { hashPinLookup } = await import('@/lib/pin-lookup')
      const hashes = new Set<string>()
      for (let i = 0; i < 10000; i++) {
        hashes.add(hashPinLookup(String(i).padStart(4, '0')))
      }
      // No collisions — HMAC-SHA256 has 2^256 output space, 10K inputs is trivial
      expect(hashes.size).toBe(10000)
    })
  })

  describe('pinLookupEnabled', () => {
    it('vrne false če NEXTAUTH_SECRET manjka', async () => {
      delete process.env.NEXTAUTH_SECRET
      const { pinLookupEnabled } = await import('@/lib/pin-lookup')
      expect(pinLookupEnabled()).toBe(false)
    })

    it('vrne true če je NEXTAUTH_SECRET nastavljen', async () => {
      process.env.NEXTAUTH_SECRET = 'any-non-empty-string'
      const { pinLookupEnabled } = await import('@/lib/pin-lookup')
      expect(pinLookupEnabled()).toBe(true)
    })

    it('vrne false če je NEXTAUTH_SECRET prazen string', async () => {
      process.env.NEXTAUTH_SECRET = ''
      const { pinLookupEnabled } = await import('@/lib/pin-lookup')
      expect(pinLookupEnabled()).toBe(false)
    })
  })
})

afterAll(() => {
  if (ORIGINAL_SECRET !== undefined) {
    process.env.NEXTAUTH_SECRET = ORIGINAL_SECRET
  } else {
    delete process.env.NEXTAUTH_SECRET
  }
})
