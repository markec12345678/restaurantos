// ============================================
// Rate Limiter — Unit testi
// Preverja in-memory rate limiting logiko (Edge-compatible)
// ============================================
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  checkMiddlewareRateLimit,
  API_RATE_LIMITS,
  type RateLimitConfig,
} from '@/lib/middleware/rate-limit'

describe('checkMiddlewareRateLimit', () => {
  const CONFIG: RateLimitConfig = { maxRequests: 3, windowMs: 1000 }

  beforeEach(() => {
    // Reset interni store s ponovno import-anjem modula
    vi.resetModules()
  })

  it('dovoli prvi zahtevek', () => {
    const result = checkMiddlewareRateLimit('test', '1.2.3.4', CONFIG)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(2) // maxRequests - 1
  })

  it('pravilno šteje do maxRequests', () => {
    expect(checkMiddlewareRateLimit('test', '1.1.1.1', CONFIG).remaining).toBe(2)
    expect(checkMiddlewareRateLimit('test', '1.1.1.1', CONFIG).remaining).toBe(1)
    expect(checkMiddlewareRateLimit('test', '1.1.1.1', CONFIG).remaining).toBe(0)
  })

  it('zavrne 4. zahtevek, ko je maxRequests=3', () => {
    checkMiddlewareRateLimit('test', '2.2.2.2', CONFIG)
    checkMiddlewareRateLimit('test', '2.2.2.2', CONFIG)
    checkMiddlewareRateLimit('test', '2.2.2.2', CONFIG)
    const result = checkMiddlewareRateLimit('test', '2.2.2.2', CONFIG)
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
    expect(result.retryAfterMs).toBeGreaterThan(0)
  })

  it('ločuje različne IP-je', () => {
    // IP A porabi 3 zahtevke
    checkMiddlewareRateLimit('test', '3.3.3.3', CONFIG)
    checkMiddlewareRateLimit('test', '3.3.3.3', CONFIG)
    checkMiddlewareRateLimit('test', '3.3.3.3', CONFIG)
    // IP B mora imeti še vedno vse zahtevke na voljo
    const result = checkMiddlewareRateLimit('test', '4.4.4.4', CONFIG)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(2)
  })

  it('ločuje različne storeKey (endpointe)', () => {
    // auth endpoint
    checkMiddlewareRateLimit('auth-login', '5.5.5.5', CONFIG)
    checkMiddlewareRateLimit('auth-login', '5.5.5.5', CONFIG)
    checkMiddlewareRateLimit('auth-login', '5.5.5.5', CONFIG)
    // drug endpoint — isti IP, mora delovati
    const result = checkMiddlewareRateLimit('public-order', '5.5.5.5', CONFIG)
    expect(result.allowed).toBe(true)
  })

  it('retryAfterMs je smiseln (<= windowMs)', () => {
    checkMiddlewareRateLimit('test', '6.6.6.6', CONFIG)
    checkMiddlewareRateLimit('test', '6.6.6.6', CONFIG)
    checkMiddlewareRateLimit('test', '6.6.6.6', CONFIG)
    const blocked = checkMiddlewareRateLimit('test', '6.6.6.6', CONFIG)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterMs).toBeGreaterThan(0)
    expect(blocked.retryAfterMs).toBeLessThanOrEqual(CONFIG.windowMs)
  })

  it('reset-a števec po poteku okna (mock time)', () => {
    const now = Date.now()
    vi.spyOn(Date, 'now').mockReturnValue(now)
    // Porabi 3 zahtevke
    checkMiddlewareRateLimit('test', '7.7.7.7', CONFIG)
    checkMiddlewareRateLimit('test', '7.7.7.7', CONFIG)
    checkMiddlewareRateLimit('test', '7.7.7.7', CONFIG)
    expect(checkMiddlewareRateLimit('test', '7.7.7.7', CONFIG).allowed).toBe(false)
    // Premakni uro za 1001ms (preko okna)
    vi.spyOn(Date, 'now').mockReturnValue(now + 1001)
    // Zdaj bi moralo spet delovati
    const result = checkMiddlewareRateLimit('test', '7.7.7.7', CONFIG)
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(2)
    vi.restoreAllMocks()
  })

  it('ne vrže napake z unknown IP-jem', () => {
    const result = checkMiddlewareRateLimit('test', 'unknown', CONFIG)
    expect(result.allowed).toBe(true)
  })

  it('ne vrže napake s praznim IP-jem', () => {
    const result = checkMiddlewareRateLimit('test', '', CONFIG)
    expect(result.allowed).toBe(true)
  })
})

describe('API_RATE_LIMITS konfiguracija', () => {
  it('vsebuje pravila za javne endpointe', () => {
    const names = API_RATE_LIMITS.map(r => r.name)
    expect(names).toContain('auth-login')
    expect(names).toContain('public-order')
    expect(names).toContain('qr-menu')
    expect(names).toContain('feedback-public')
  })

  it('auth-login je najbolj omejen (5 poskusov / 15 min)', () => {
    const authRule = API_RATE_LIMITS.find(r => r.name === 'auth-login')
    expect(authRule).toBeTruthy()
    expect(authRule!.config.maxRequests).toBeLessThanOrEqual(5)
    expect(authRule!.config.windowMs).toBeGreaterThanOrEqual(15 * 60 * 1000)
  })

  it('catch-all pravilo obstaja za /api/', () => {
    const generalRule = API_RATE_LIMITS.find(r => r.name === 'api-general')
    expect(generalRule).toBeTruthy()
    expect(generalRule!.pattern.test('/api/anything')).toBe(true)
  })

  it('specifična pravila so PRED catch-all (vrstni red pomemben)', () => {
    const generalIndex = API_RATE_LIMITS.findIndex(r => r.name === 'api-general')
    const authIndex = API_RATE_LIMITS.findIndex(r => r.name === 'auth-login')
    expect(authIndex).toBeLessThan(generalIndex)
  })

  it('vsako pravilo ima veljaven RegExp pattern', () => {
    for (const rule of API_RATE_LIMITS) {
      expect(rule.pattern).toBeInstanceOf(RegExp)
      expect(rule.config.maxRequests).toBeGreaterThan(0)
      expect(rule.config.windowMs).toBeGreaterThan(0)
    }
  })

  it('destruktivni endpointi (seed) so zelo omejeni', () => {
    const seedRule = API_RATE_LIMITS.find(r => r.name === 'seed')
    expect(seedRule).toBeTruthy()
    // Seed operacije so redke — limit naj bo <= 10/h
    expect(seedRule!.config.maxRequests).toBeLessThanOrEqual(10)
    expect(seedRule!.config.windowMs).toBeGreaterThanOrEqual(60 * 60 * 1000)
  })
})
