// ============================================
// R131 / EPIC #115 P1-13 — PACK-SIZE KONVERZIJSKI KANON (čiste funkcije)
// ============================================
// Kanon P1-13: dobavitelj prodaja v PAKETIH (vrečka 25 kg, sod 50 L), zaloga
// se vodi v OSNOVNIH enotah (kg, L, kos). Testira '@/lib/procurement/pack-size':
//   - isValidPack: jedro vseh guardov (0/negativno/NaN/Infinity/null → false)
//   - packsToBaseQty: round3(packs × packQty) — zaloga Decimal(12,3)
//   - baseUnitPrice: round4(pricePerPack / packQty) — price history Decimal(12,4)
//   - packsForBaseQty: ceil(baseQty / packQty), MIN 1 — naroči cele pakete
//   - describePack: "vrečka po 25 kg" (UI/faktorji/opombe)
// VSI guardi: NaN/Infinity/negativno → varno vedenje, NIKOLI throw.
// ============================================
import { describe, it, expect } from 'vitest'
import {
  isValidPack,
  packsToBaseQty,
  baseUnitPrice,
  packsForBaseQty,
  describePack,
} from '@/lib/procurement/pack-size'

describe('R131 pack-size kanon — isValidPack', () => {
  it('veljavne velikosti paketov (pozitivna finite števila)', () => {
    expect(isValidPack(25)).toBe(true)
    expect(isValidPack(0.5)).toBe(true)
    expect(isValidPack(1)).toBe(true)
    expect(isValidPack(24.999)).toBe(true)
  })

  it('ničelna/negativna količina → false (legacy semantika)', () => {
    expect(isValidPack(0)).toBe(false)
    expect(isValidPack(-1)).toBe(false)
    expect(isValidPack(-0.001)).toBe(false)
  })

  it('NaN/Infinity/null/undefined → false (nikoli crash)', () => {
    expect(isValidPack(NaN)).toBe(false)
    expect(isValidPack(Infinity)).toBe(false)
    expect(isValidPack(-Infinity)).toBe(false)
    expect(isValidPack(null)).toBe(false)
    expect(isValidPack(undefined)).toBe(false)
  })
})

describe('R131 pack-size kanon — packsToBaseQty (round3)', () => {
  it('točna matematika: 2 × 25 = 50', () => {
    expect(packsToBaseQty(2, 25)).toBe(50)
    expect(packsToBaseQty(1, 25)).toBe(25)
    expect(packsToBaseQty(3, 16.667)).toBe(50.001) // round3
  })

  it('round3 na 3 decimalke (zaloga Decimal(12,3))', () => {
    // 0.1 + 0.2 float trap — decimal-exact prek Prisma.Decimal
    expect(packsToBaseQty(3, 0.1)).toBe(0.3)
    expect(packsToBaseQty(1, 1 / 3)).toBe(0.333)
  })

  it('guardi: ne-finite/negativni vhodi → 0, nikoli throw', () => {
    expect(packsToBaseQty(NaN, 25)).toBe(0)
    expect(packsToBaseQty(Infinity, 25)).toBe(0)
    expect(packsToBaseQty(-2, 25)).toBe(0)
    expect(packsToBaseQty(0, 25)).toBe(0)
    expect(packsToBaseQty(2, NaN)).toBe(0)
    expect(packsToBaseQty(2, 0)).toBe(0)
    expect(packsToBaseQty(2, -25)).toBe(0)
    expect(packsToBaseQty(NaN, NaN)).toBe(0)
  })
})

describe('R131 pack-size kanon — baseUnitPrice (round4)', () => {
  it('točna matematika: 45 / 25 = 1.8', () => {
    expect(baseUnitPrice(45, 25)).toBe(1.8)
    expect(baseUnitPrice(90, 50)).toBe(1.8)
    expect(baseUnitPrice(10, 12)).toBe(0.8333) // round4
  })

  it('round4 na 4 decimalke (price history Decimal(12,4))', () => {
    // 1/3 paketa — repeating decimal, round4 stvari
    expect(baseUnitPrice(1, 3)).toBe(0.3333)
    expect(baseUnitPrice(100, 3)).toBe(33.3333)
  })

  it('guardi: neveljaven packQty ali cena → 0, nikoli throw, nikoli negativno', () => {
    expect(baseUnitPrice(45, 0)).toBe(0)
    expect(baseUnitPrice(45, -25)).toBe(0)
    expect(baseUnitPrice(45, NaN)).toBe(0)
    expect(baseUnitPrice(45, Infinity)).toBe(0)
    expect(baseUnitPrice(NaN, 25)).toBe(0)
    expect(baseUnitPrice(Infinity, 25)).toBe(0)
    expect(baseUnitPrice(-5, 25)).toBe(0)
    expect(baseUnitPrice(0, 25)).toBe(0)
  })
})

describe('R131 pack-size kanon — packsForBaseQty (ceil, min 1)', () => {
  it('točno deljivo = natančno število paketov', () => {
    expect(packsForBaseQty(50, 25)).toBe(2)
    expect(packsForBaseQty(25, 25)).toBe(1)
    expect(packsForBaseQty(75, 25)).toBe(3)
  })

  it('ne-deljivo → ceil (NAROČI cele pakete)', () => {
    expect(packsForBaseQty(51, 25)).toBe(3)
    expect(packsForBaseQty(1, 25)).toBe(1)
    expect(packsForBaseQty(26, 25)).toBe(2)
    expect(packsForBaseQty(56, 25)).toBe(3)
  })

  it('minimum 1 — nikoli 0 paketov (advisory naročanje)', () => {
    expect(packsForBaseQty(0, 25)).toBe(1)
    expect(packsForBaseQty(-5, 25)).toBe(1)
    expect(packsForBaseQty(0.001, 25)).toBe(1)
  })

  it('guardi: ne-finite/neveljaven packQty → 1, nikoli throw', () => {
    expect(packsForBaseQty(NaN, 25)).toBe(1)
    expect(packsForBaseQty(Infinity, 25)).toBe(1)
    expect(packsForBaseQty(50, 0)).toBe(1)
    expect(packsForBaseQty(50, -25)).toBe(1)
    expect(packsForBaseQty(50, NaN)).toBe(1)
  })
})

describe('R131 pack-size kanon — describePack', () => {
  it('format "vrečka po 25 kg"', () => {
    expect(describePack(25, 'vrečka', 'kg')).toBe('vrečka po 25 kg')
    expect(describePack(50, 'sod', 'L')).toBe('sod po 50 L')
    expect(describePack(12, 'karton', 'kos')).toBe('karton po 12 kos')
  })

  it('decimalne velikosti brez trailing ničel (Decimal toString)', () => {
    expect(describePack(2.5, 'zavoj', 'kg')).toBe('zavoj po 2.5 kg')
    expect(describePack(25, 'vrečka', 'kg')).toBe('vrečka po 25 kg') // ne '25.000'
  })

  it('guardi: neveljaven packQty → prazen niz; prazen packUnit → default "paket"', () => {
    expect(describePack(0, 'vrečka', 'kg')).toBe('')
    expect(describePack(-1, 'vrečka', 'kg')).toBe('')
    expect(describePack(NaN, 'vrečka', 'kg')).toBe('')
    expect(describePack(25, '', 'kg')).toBe('paket po 25 kg')
    expect(describePack(25, '  ', 'kg')).toBe('paket po 25 kg')
    expect(describePack(25, 'vrečka', '')).toBe('vrečka po 25')
    expect(describePack(25, 'vrečka', undefined as unknown as string)).toBe('vrečka po 25')
  })
})
