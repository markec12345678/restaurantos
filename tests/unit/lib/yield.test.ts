// ============================================
// R123 / EPIC #115 P0-05 — YIELD HELPER (čisti unit)
// ============================================
// Kanon (src/lib/recipes/yield.ts):
//
//   RAW potrebno   = usable / (yield / 100)
//   strošek linije = usable × cena / (yield / 100)
//
// yieldPercent = 100 (ali null/undefined/≤0) → IDENTITETA (back-compat:
// vse obstoječe vrstice brez yielda se obnašajo točno kot doslej).
//
// OPOMBA k specifikaciji: primer "(0.25, 8, 80) → 25" v nalogi ima tipkarsko
// napako — po kanonu je 0.25 × 8 / 0.8 = 2.5 (25 velja za 10× količino:
// 2.5 × 8 / 0.8 = 25). Oba primera sta testirana spodaj.
import { describe, it, expect } from 'vitest'
import {
  YIELD_DEFAULT_PERCENT,
  normalizeYieldPercent,
  rawFromUsable,
  yieldAdjustedLineCost,
} from '@/lib/recipes/yield'

describe('YIELD_DEFAULT_PERCENT', () => {
  it('kanon: privzeti yield je 100 (brez izgube priprave)', () => {
    expect(YIELD_DEFAULT_PERCENT).toBe(100)
  })
})

describe('normalizeYieldPercent', () => {
  it('veljavne vrednosti ostanejo nespremenjene (100, 85, 1, 99.5)', () => {
    expect(normalizeYieldPercent(100)).toBe(100)
    expect(normalizeYieldPercent(85)).toBe(85)
    expect(normalizeYieldPercent(1)).toBe(1)
    expect(normalizeYieldPercent(99.5)).toBe(99.5)
  })

  it('null / undefined → 100 (obrambno za legacy vrstice brez yielda)', () => {
    expect(normalizeYieldPercent(null)).toBe(100)
    expect(normalizeYieldPercent(undefined)).toBe(100)
  })

  it('NaN → 100 (neštevilka ne sme pokvariti aritmetike)', () => {
    expect(normalizeYieldPercent(NaN)).toBe(100)
  })

  it('0 / negativen → 100 (fail-open na "brez izgube", NIKOLI deljenje z 0)', () => {
    expect(normalizeYieldPercent(0)).toBe(100)
    expect(normalizeYieldPercent(-20)).toBe(100)
  })

  it('150 → clamp na 100 (yield nad 100 je fizično nemogoč)', () => {
    expect(normalizeYieldPercent(150)).toBe(100)
    expect(normalizeYieldPercent(1000)).toBe(100)
  })
})

describe('rawFromUsable', () => {
  it('yield 100 → identiteta (RAW == usable)', () => {
    expect(rawFromUsable(100, 100)).toBe(100)
  })

  it('yield 50 → RAW = 2× usable (kupiš 2 kg, dobiš 1 kg uporabnega)', () => {
    expect(rawFromUsable(100, 50)).toBe(200)
  })

  it('yield 80: 250 kg usable → 312.5 kg RAW', () => {
    expect(rawFromUsable(250, 80)).toBe(312.5)
  })

  it('decimalna količina: 0.3 kg usable @ 75% ≈ 0.4 kg RAW', () => {
    expect(rawFromUsable(0.3, 75)).toBeCloseTo(0.4, 10)
  })

  it('undefined yield → identiteta (legacy vrstica)', () => {
    expect(rawFromUsable(100, undefined)).toBe(100)
  })

  it('usable = 0 → RAW = 0 (ničesar ne porabi)', () => {
    expect(rawFromUsable(0, 50)).toBe(0)
  })
})

describe('yieldAdjustedLineCost', () => {
  it('100 kg × 10 € @ 50% → 2000 € (RAW × nabavna cena)', () => {
    expect(yieldAdjustedLineCost(100, 10, 50)).toBe(2000)
  })

  it('yield 100 → identiteta (usable × cena)', () => {
    expect(yieldAdjustedLineCost(100, 10, 100)).toBe(1000)
  })

  it('undefined yield → identiteta (legacy vrstica)', () => {
    expect(yieldAdjustedLineCost(100, 10, undefined)).toBe(1000)
  })

  it('decimalna količina: 0.25 × 8 € @ 80% → 2.5 € (kanon usable × cena / (yield/100))', () => {
    // 0.25 × 8 = 2;  2 / 0.8 = 2.5 — efektivni strošek raste z izgubo priprave
    expect(yieldAdjustedLineCost(0.25, 8, 80)).toBeCloseTo(2.5, 10)
    // ista izguba pri 10× količini: 2.5 × 8 / 0.8 = 25
    expect(yieldAdjustedLineCost(2.5, 8, 80)).toBeCloseTo(25, 10)
  })
})

describe('back-compat invarianta: yield = 100 ⟺ identiteta', () => {
  const qtys = [0.3, 0.5, 1, 3, 100]
  const prices = [0.5, 2.5, 8, 10]

  it('rawFromUsable(q, 100) === q — tudi za null / undefined yield', () => {
    for (const q of qtys) {
      expect(rawFromUsable(q, 100)).toBe(q)
      expect(rawFromUsable(q, null)).toBe(q)
      expect(rawFromUsable(q, undefined)).toBe(q)
    }
  })

  it('yieldAdjustedLineCost(q, c, 100) === q × c — tudi za null / undefined yield', () => {
    for (const q of qtys) {
      for (const c of prices) {
        expect(yieldAdjustedLineCost(q, c, 100)).toBe(q * c)
        expect(yieldAdjustedLineCost(q, c, null)).toBe(q * c)
        expect(yieldAdjustedLineCost(q, c, undefined)).toBe(q * c)
      }
    }
  })

  it('splošna formula: raw(q, y) === q × 100 / y (natančna decimalna aritmetika)', () => {
    for (const y of [50, 75, 80, 90, 99.5]) {
      for (const q of qtys) {
        expect(rawFromUsable(q, y)).toBeCloseTo((q * 100) / y, 10)
      }
    }
  })

  it('konsistenca: strošek linije == RAW × nabavna cena (isti yield)', () => {
    for (const y of [50, 75, 80, 90, 99.5]) {
      for (const q of qtys) {
        for (const c of prices) {
          expect(yieldAdjustedLineCost(q, c, y)).toBeCloseTo(rawFromUsable(q, y) * c, 8)
        }
      }
    }
  })
})
