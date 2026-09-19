import { describe, expect, it } from 'vitest'
import { canDeleteGiftCard } from '@/lib/gift-card-guard'

// RUNDA 69: kontrakt zaščite brisanja darilne kartice — ENOTEN VIR za API+UI.
// Kartica z zgodovino (transakcije) ali stanjem (> 0 €) je BLOKIRANA; prazna
// kartica brez zgodovine je dovoljena. Fail-safe: pokvarjeni števci → blokada.

describe('canDeleteGiftCard', () => {
  it('blokira kartico s transakcijami (26 → rodilnik "26 transakcij")', () => {
    const d = canDeleteGiftCard(26, 0)
    expect(d.allowed).toBe(false)
    expect(d.status).toBe(409)
    expect(d.suggestSuspend).toBe(true)
    expect(d.messageSl).toContain('26 transakcij')
    expect(d.messageSl).toContain('Suspendirajte')
  })

  it('ednina: 1 transakcija → "1 transakcijo" (tožilnik po "ima")', () => {
    const d = canDeleteGiftCard(1, 0)
    expect(d.messageSl).toContain('1 transakcijo')
  })

  it('dvojina: 2 transakciji → "2 transakciji"', () => {
    expect(canDeleteGiftCard(2, 0).messageSl).toContain('2 transakciji')
  })

  it('malo množina: 3 transakcije → "3 transakcije"', () => {
    expect(canDeleteGiftCard(3, 0).messageSl).toContain('3 transakcije')
  })

  it('blokira kartico s stanjem (brez transakcij) — formatEUR v sporočilu', () => {
    const d = canDeleteGiftCard(0, 25.5)
    expect(d.allowed).toBe(false)
    expect(d.status).toBe(409)
    expect(d.suggestSuspend).toBe(true)
    expect(d.messageSl).toContain('25,50 €')
    expect(d.messageSl).toContain('Suspendirajte')
  })

  it('dovoli prazno kartico (0 transakcij, 0 € stanja)', () => {
    const d = canDeleteGiftCard(0, 0)
    expect(d.allowed).toBe(true)
    expect(d.status).toBe(200)
    expect(d.suggestSuspend).toBe(false)
  })

  it('transakcije tehtajo več kot stanje — 0 transakcij ampak stanje > 0 je še vedno blokada', () => {
    expect(canDeleteGiftCard(0, 0.01).allowed).toBe(false)
  })

  // FAIL-SAFE: pokvarjeni števci → BLOKADA (vzorec category-guard R66)
  it('fail-safe: NaN transakcije → blokada', () => {
    const d = canDeleteGiftCard(Number.NaN, 0)
    expect(d.allowed).toBe(false)
    expect(d.status).toBe(409)
    expect(d.suggestSuspend).toBe(false)
  })

  it('fail-safe: NaN stanje → blokada', () => {
    expect(canDeleteGiftCard(0, Number.NaN).allowed).toBe(false)
  })

  it('fail-safe: negativno stanje → blokada', () => {
    expect(canDeleteGiftCard(0, -5).allowed).toBe(false)
  })

  it('fail-safe: negativne transakcije → blokada', () => {
    expect(canDeleteGiftCard(-1, 0).allowed).toBe(false)
  })

  it('fail-safe: Infinity transakcije → blokada', () => {
    expect(canDeleteGiftCard(Number.POSITIVE_INFINITY, 0).allowed).toBe(false)
  })
})
