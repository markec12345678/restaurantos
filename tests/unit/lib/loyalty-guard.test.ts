import { describe, expect, it } from 'vitest'
import { canDeleteLoyaltyAccount } from '@/lib/loyalty-guard'

// RUNDA 69: kontrakt zaščite brisanja zvestobnega računa — ENOTEN VIR za API+UI.
// Račun z zgodovino (transakcije) ali točkami je BLOKIRAN (predlagaj
// deaktivacijo); prazen račun brez zgodovine je dovoljen. Fail-safe: blokada.

describe('canDeleteLoyaltyAccount', () => {
  it('blokira račun s transakcijami (18 → rodilnik "18 transakcij")', () => {
    const d = canDeleteLoyaltyAccount(18, 0)
    expect(d.allowed).toBe(false)
    expect(d.status).toBe(409)
    expect(d.suggestDeactivate).toBe(true)
    expect(d.messageSl).toContain('18 transakcij')
    expect(d.messageSl).toContain('Deaktivirajte')
  })

  it('ednina: "1 transakcijo" (tožilnik po "ima")', () => {
    expect(canDeleteLoyaltyAccount(1, 0).messageSl).toContain('1 transakcijo')
  })

  it('dvojina: "2 transakciji"', () => {
    expect(canDeleteLoyaltyAccount(2, 0).messageSl).toContain('2 transakciji')
  })

  it('blokira račun s točkami (brez transakcij) — tožilnik "točke"', () => {
    const d = canDeleteLoyaltyAccount(0, 120)
    expect(d.allowed).toBe(false)
    expect(d.status).toBe(409)
    expect(d.suggestDeactivate).toBe(true)
    expect(d.messageSl).toContain('120 točk')
    expect(d.messageSl).toContain('Deaktivirajte')
  })

  it('ednina točk: "1 točko" (tožilnik)', () => {
    expect(canDeleteLoyaltyAccount(0, 1).messageSl).toContain('1 točko')
  })

  it('dvojina točk: "2 točki"', () => {
    expect(canDeleteLoyaltyAccount(0, 2).messageSl).toContain('2 točki')
  })

  it('malo množina točk: "3 točke"', () => {
    expect(canDeleteLoyaltyAccount(0, 3).messageSl).toContain('3 točke')
  })

  it('dovoli prazen račun (0 transakcij, 0 točk)', () => {
    const d = canDeleteLoyaltyAccount(0, 0)
    expect(d.allowed).toBe(true)
    expect(d.status).toBe(200)
    expect(d.suggestDeactivate).toBe(false)
  })

  // FAIL-SAFE: pokvarjeni števci → BLOKADA (vzorec category-guard R66)
  it('fail-safe: NaN transakcije → blokada', () => {
    const d = canDeleteLoyaltyAccount(Number.NaN, 0)
    expect(d.allowed).toBe(false)
    expect(d.suggestDeactivate).toBe(false)
  })

  it('fail-safe: NaN točke → blokada', () => {
    expect(canDeleteLoyaltyAccount(0, Number.NaN).allowed).toBe(false)
  })

  it('fail-safe: negativne točke → blokada', () => {
    expect(canDeleteLoyaltyAccount(0, -10).allowed).toBe(false)
  })

  it('fail-safe: negativne transakcije → blokada', () => {
    expect(canDeleteLoyaltyAccount(-3, 0).allowed).toBe(false)
  })

  it('fail-safe: Infinity točke → blokada', () => {
    expect(canDeleteLoyaltyAccount(0, Number.POSITIVE_INFINITY).allowed).toBe(false)
  })
})
