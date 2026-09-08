// ============================================
// P1-12: PIN LOCKOUT — unit testi
// ============================================
// Preverjamo:
// - 5 neuspelih poskusov → zaklep (PIN_LOCKOUT_THRESHOLD)
// - 4 poskusi → še ni zaklepa
// - uspešna prijava (clearPinFailures) ponastavi števec
// - zaklep poteče po PIN_LOCKOUT_MS
// - progresivni delay: count*250ms, max 4s
// - ključ je HMAC-determinističen (isti PIN → isti ključ)
// - prazen PIN se ne sledi
// ============================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  isPinLocked,
  pinLockoutRemainingMs,
  recordPinFailure,
  clearPinFailures,
  progressiveDelayMs,
  resetPinLockoutForTests,
  _pinLockoutKeyForTests,
} from '@/lib/auth-middleware/pin-lockout'
import { PIN_LOCKOUT_THRESHOLD, PIN_LOCKOUT_MS, PIN_PROGRESSIVE_DELAY_MAX_MS } from '@/lib/auth-middleware/constants'

describe('P1-12: PIN lockout — prag in zaklep', () => {
  beforeEach(() => {
    resetPinLockoutForTests()
    process.env.NEXTAUTH_SECRET = 'test-secret-pin-lockout'
  })

  afterEach(() => {
    resetPinLockoutForTests()
    vi.useRealTimers()
  })

  it('4 zaporedne napake NE zaklenejo PIN-a', () => {
    for (let i = 0; i < PIN_LOCKOUT_THRESHOLD - 1; i++) {
      recordPinFailure('987654')
    }
    expect(isPinLocked('987654')).toBe(false)
  })

  it(`${PIN_LOCKOUT_THRESHOLD}. zaporedna napaka ZAKLENE PIN`, () => {
    for (let i = 0; i < PIN_LOCKOUT_THRESHOLD; i++) {
      recordPinFailure('987654')
    }
    expect(isPinLocked('987654')).toBe(true)
  })

  it('zaklep ima pozitiven preostali čas (pinLockoutRemainingMs)', () => {
    for (let i = 0; i < PIN_LOCKOUT_THRESHOLD; i++) {
      recordPinFailure('987654')
    }
    const remaining = pinLockoutRemainingMs('987654')
    expect(remaining).toBeGreaterThan(0)
    expect(remaining).toBeLessThanOrEqual(PIN_LOCKOUT_MS)
  })

  it('drugačen PIN ni prizadet (per-PIN sledenje, ne globalno)', () => {
    for (let i = 0; i < PIN_LOCKOUT_THRESHOLD; i++) {
      recordPinFailure('987654')
    }
    expect(isPinLocked('987654')).toBe(true)
    expect(isPinLocked('111222')).toBe(false)
  })

  it('recordPinFailure poroča locked=true na pragovnem poskusu', () => {
    let last = { count: 0, locked: false, lockedForMs: 0 }
    for (let i = 0; i < PIN_LOCKOUT_THRESHOLD; i++) {
      last = recordPinFailure('987654')
    }
    expect(last.count).toBe(PIN_LOCKOUT_THRESHOLD)
    expect(last.locked).toBe(true)
    expect(last.lockedForMs).toBe(PIN_LOCKOUT_MS)
  })

  it('uspešna prijava (clearPinFailures) ponastavi števec', () => {
    for (let i = 0; i < PIN_LOCKOUT_THRESHOLD - 1; i++) {
      recordPinFailure('987654')
    }
    clearPinFailures('987654')
    // Po clear je spet trela 5 napak do zaklepa
    for (let i = 0; i < PIN_LOCKOUT_THRESHOLD - 1; i++) {
      recordPinFailure('987654')
    }
    expect(isPinLocked('987654')).toBe(false)
  })

  it('zaklep poteče po PIN_LOCKOUT_MS (fake timers)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-09T10:00:00Z'))
    for (let i = 0; i < PIN_LOCKOUT_THRESHOLD; i++) {
      recordPinFailure('987654')
    }
    expect(isPinLocked('987654')).toBe(true)

    // 1 minuto pred potekom je še zaklenjen
    vi.setSystemTime(new Date('2026-09-09T10:14:00Z'))
    expect(isPinLocked('987654')).toBe(true)

    // Po poteku se odblokira
    vi.setSystemTime(new Date('2026-09-09T10:16:00Z'))
    expect(isPinLocked('987654')).toBe(false)
  })

  it('po poteku zaklepa se števec PONASTAVI (kazen odslužena, čist list)', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-09T10:00:00Z'))
    for (let i = 0; i < PIN_LOCKOUT_THRESHOLD; i++) {
      recordPinFailure('987654')
    }
    vi.setSystemTime(new Date('2026-09-09T10:16:00Z'))
    expect(isPinLocked('987654')).toBe(false)

    // isPinLocked ob poteku pobriše zapis → naslednja napaka začne s count=1
    // (kazen je odslužena; ni večnostnega ban-a)
    const r = recordPinFailure('987654')
    expect(r.count).toBe(1)
    expect(r.locked).toBe(false)
  })

  it('neveljaven/prazen PIN se ne sledi (nizek locking dosledno)', () => {
    for (let i = 0; i < 20; i++) {
      recordPinFailure('')
    }
    expect(isPinLocked('')).toBe(false)
  })
})

describe('P1-12: progresivni delay', () => {
  it('prva napaka = brez zamika', () => {
    expect(progressiveDelayMs(0)).toBe(0)
    expect(progressiveDelayMs(1)).toBe(0)
  })

  it('vsaka dodatna napaka +250ms', () => {
    expect(progressiveDelayMs(2)).toBe(500)
    expect(progressiveDelayMs(3)).toBe(750)
    expect(progressiveDelayMs(4)).toBe(1000)
  })

  it('največ PIN_PROGRESSIVE_DELAY_MAX_MS (4s)', () => {
    expect(progressiveDelayMs(17)).toBe(PIN_PROGRESSIVE_DELAY_MAX_MS)
    expect(progressiveDelayMs(100)).toBe(PIN_PROGRESSIVE_DELAY_MAX_MS)
  })
})

describe('P1-12: HMAC ključ sledenja', () => {
  it('isti PIN → isti ključ (determinizem brez razkritja PIN-a)', () => {
    const k1 = _pinLockoutKeyForTests('987654')
    const k2 = _pinLockoutKeyForTests('987654')
    expect(k1).toBe(k2)
    expect(k1).toMatch(/^[a-f0-9]{64}$/) // SHA-256 hex — PIN ni reverzibilen iz ključa
  })

  it('različna PIN-a → različna ključa', () => {
    expect(_pinLockoutKeyForTests('987654')).not.toBe(_pinLockoutKeyForTests('987655'))
  })

  it('ključ se spremeni z drugačnim NEXTAUTH_SECRET', () => {
    const k1 = _pinLockoutKeyForTests('987654')
    process.env.NEXTAUTH_SECRET = 'druga-skrivnost'
    const k2 = _pinLockoutKeyForTests('987654')
    expect(k1).not.toBe(k2)
  })
})
