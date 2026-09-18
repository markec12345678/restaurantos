import { describe, expect, it } from 'vitest'
import { splitAmountBreakdown } from '@/lib/split-math'
import { redeemPointsNeeded } from '@/lib/loyalty-tiers'

// ============================================
// RUNDA 49 — deljeno plačilo: razdelitev zneskov + unovčenje točk
// ============================================

describe('splitAmountBreakdown', () => {
  it('razdeli 100 € na 4 enake dele (25,00 vsak)', () => {
    expect(splitAmountBreakdown(100, 4)).toEqual([25, 25, 25, 25])
  })

  it('razdeli 10 € na 3 dele — zadnji absorbira razliko zaokroževanja', () => {
    const parts = splitAmountBreakdown(10, 3)
    // base = floor(10/3 × 100)/100 = 3.33; zadnji = 10 − 3.33×2 = 3.34
    expect(parts).toEqual([3.33, 3.33, 3.34])
    expect(parts.reduce((s, p) => s + p, 0)).toBeCloseTo(10, 2)
  })

  it('razdeli neenakomeren centni znesek (61.65 € na 3)', () => {
    const parts = splitAmountBreakdown(61.65, 3)
    expect(parts).toEqual([20.55, 20.55, 20.55])
    expect(parts.reduce((s, p) => s + p, 0)).toBeCloseTo(61.65, 2)
  })

  it('razdelitev z zaokroževanjem navzdol (0.10 na 3 → 0.03/0.03/0.04)', () => {
    const parts = splitAmountBreakdown(0.1, 3)
    expect(parts).toEqual([0.03, 0.03, 0.04])
  })

  it('count = 1 → en sam del, enak totalu', () => {
    expect(splitAmountBreakdown(42.42, 1)).toEqual([42.42])
  })

  it('guardi: total 0 / negativen / NaN → [0]', () => {
    expect(splitAmountBreakdown(0, 3)).toEqual([0])
    expect(splitAmountBreakdown(-5, 3)).toEqual([0])
    expect(splitAmountBreakdown(NaN, 3)).toEqual([0])
  })

  it('guardi: count 0 / negativen / ne-cel število → normaliziran', () => {
    // count 0/negativen → 1 del
    expect(splitAmountBreakdown(10, 0)).toEqual([10])
    expect(splitAmountBreakdown(10, -2)).toEqual([10])
    // necel count → floor (2.9 → 2)
    expect(splitAmountBreakdown(10, 2.9)).toEqual([5, 5])
  })

  it('vsota delov je ZMERaj enaka totalu (centna natančnost) — 100 naključnih primerov', () => {
    for (let i = 0; i < 100; i++) {
      const total = Math.round(Math.random() * 50000) / 100 // 0–500 €, centna natančnost
      const count = 2 + Math.floor(Math.random() * 5) // 2–6
      const parts = splitAmountBreakdown(total, count)
      expect(parts).toHaveLength(count)
      expect(parts.reduce((s, p) => s + p, 0)).toBeCloseTo(total, 2)
    }
  })
})

describe('redeemPointsNeeded', () => {
  it('osnovni izračun: 61.65 € pri 0.01 €/točko → 6165 točk', () => {
    expect(redeemPointsNeeded(61.65, 0.01)).toBe(6165)
  })

  it('ceil zaokrožuje navzgor: 0.015 € pri 0.01 → 2 točki (1001 × 0.01 == 10.01 točno pokrije)', () => {
    expect(redeemPointsNeeded(10.01, 0.01)).toBe(1001)
    expect(redeemPointsNeeded(0.015, 0.01)).toBe(2)
  })

  it('točke vedno pokrijejo znesek (fraud-check kontrakt: amount <= points × value)', () => {
    for (let i = 0; i < 200; i++) {
      const amount = Math.round(Math.random() * 100000) / 100
      const points = redeemPointsNeeded(amount, 0.01)
      expect(points * 0.01).toBeGreaterThanOrEqual(amount - 1e-9)
    }
  })

  it('float prah: kvantizacija prepreči lažni +1 točki', () => {
    // 0.29 / 0.01 = 28.999999999999996 v float — goli ceil bi dal 29 (prav),
    // a 8.9 / 0.01 = 890.0000000000001 → goli ceil bi dal 891 (NAPAKA)
    expect(redeemPointsNeeded(8.9, 0.01)).toBe(890)
    expect(redeemPointsNeeded(0.29, 0.01)).toBe(29)
    expect(redeemPointsNeeded(4.35, 0.05)).toBe(87)
  })

  it('večja vrednost točke: 25 € pri 0.25 €/točko → 100 točk', () => {
    expect(redeemPointsNeeded(25, 0.25)).toBe(100)
  })

  it('guardi: znesek <= 0 ali NaN → 0 točk', () => {
    expect(redeemPointsNeeded(0, 0.01)).toBe(0)
    expect(redeemPointsNeeded(-5, 0.01)).toBe(0)
    expect(redeemPointsNeeded(NaN, 0.01)).toBe(0)
    expect(redeemPointsNeeded(Infinity, 0.01)).toBe(0)
  })

  it('guardi: pointsValue <= 0 ali NaN → 0 točk (nikoli deljenje z 0)', () => {
    expect(redeemPointsNeeded(10, 0)).toBe(0)
    expect(redeemPointsNeeded(10, -0.01)).toBe(0)
    expect(redeemPointsNeeded(10, NaN)).toBe(0)
    expect(redeemPointsNeeded(10, Infinity)).toBe(0)
  })

  it('minimalni znesek > 0 vedno zahteva vsaj 1 točko', () => {
    expect(redeemPointsNeeded(0.001, 0.01)).toBe(1)
    expect(redeemPointsNeeded(0.0001, 1)).toBe(1)
  })
})
