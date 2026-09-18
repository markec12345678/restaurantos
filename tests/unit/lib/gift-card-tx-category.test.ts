import { describe, it, expect } from 'vitest'
import {
  giftCardTxCategory,
  presentGiftCardTxCategories,
  giftCardTxSummary,
  GIFT_CARD_TX_CATEGORY_ORDER,
  GIFT_CARD_TX_CATEGORY_META,
} from '@/lib/gift-card-tx-category'

describe('giftCardTxCategory', () => {
  // --- osnovni tipi (shema: load, redeem, adjust, transfer) ---
  it('vsi znani tipi se preslikajo 1:1', () => {
    expect(giftCardTxCategory({ type: 'load' })).toBe('load')
    expect(giftCardTxCategory({ type: 'redeem' })).toBe('redeem')
    expect(giftCardTxCategory({ type: 'adjust' })).toBe('adjust')
    expect(giftCardTxCategory({ type: 'transfer' })).toBe('transfer')
  })

  // --- varnostni pad za neznane/pokvarjene podatke ---
  it('neznan tip → adjust (isti fallback kot prejšnji dialog)', () => {
    expect(giftCardTxCategory({ type: 'mystery' })).toBe('adjust')
    expect(giftCardTxCategory({ type: '' })).toBe('adjust')
  })

  it('manjkajoči/neveljaven type → adjust (null-safety)', () => {
    // @ts-expect-error — namenoma pokvarjeni podatki iz API-ja
    expect(giftCardTxCategory({})).toBe('adjust')
    // @ts-expect-error — null type
    expect(giftCardTxCategory({ type: null })).toBe('adjust')
    // @ts-expect-error — manjkajoči argument
    expect(giftCardTxCategory(undefined)).toBe('adjust')
  })

  it('meta obstaja za VSAKO kategorijo (label + chip + accent)', () => {
    for (const cat of GIFT_CARD_TX_CATEGORY_ORDER) {
      expect(GIFT_CARD_TX_CATEGORY_META[cat].label, `label za ${cat}`).toBeTruthy()
      expect(GIFT_CARD_TX_CATEGORY_META[cat].chip, `chip za ${cat}`).toContain('bg-')
      expect(GIFT_CARD_TX_CATEGORY_META[cat].accent, `accent za ${cat}`).toContain('border-t-')
    }
  })
})

describe('presentGiftCardTxCategories', () => {
  it('prazna množica → prazen seznam', () => {
    expect(presentGiftCardTxCategories([])).toEqual([])
  })

  it('kanonični vrstni red ne glede na vrstni red vhoda', () => {
    const order = presentGiftCardTxCategories([
      { type: 'adjust' },
      { type: 'transfer' },
      { type: 'redeem' },
      { type: 'load' },
    ])
    expect(order).toEqual(['load', 'redeem', 'transfer', 'adjust'])
  })

  it('samo prisotne kategorije, brez duplikatov', () => {
    expect(presentGiftCardTxCategories([{ type: 'load' }, { type: 'load' }])).toEqual(['load'])
    expect(presentGiftCardTxCategories([{ type: 'redeem' }, { type: 'load' }])).toEqual(['load', 'redeem'])
  })

  it('neznan tip prispe kategorijo adjust', () => {
    expect(presentGiftCardTxCategories([{ type: 'mystery' }])).toEqual(['adjust'])
  })

  it('kanonični vrstni red je konstanten z vsemi 4 kategorijami', () => {
    expect(GIFT_CARD_TX_CATEGORY_ORDER).toEqual(['load', 'redeem', 'transfer', 'adjust'])
  })
})

describe('giftCardTxSummary', () => {
  it('prazna množica → vse 0', () => {
    expect(giftCardTxSummary([])).toEqual({ loaded: 0, spent: 0, net: 0, count: 0 })
  })

  it('mešana množica: nalaganja +, poraba −, neto = razlika', () => {
    const s = giftCardTxSummary([
      { amount: 50 },
      { amount: -20 },
      { amount: 10.5 },
      { amount: -0.5 },
    ])
    expect(s.loaded).toBeCloseTo(60.5)
    expect(s.spent).toBeCloseTo(20.5)
    expect(s.net).toBeCloseTo(40)
    expect(s.count).toBe(4)
  })

  it('samo nalaganja → spent 0', () => {
    const s = giftCardTxSummary([{ amount: 10 }, { amount: 25 }])
    expect(s).toEqual({ loaded: 35, spent: 0, net: 35, count: 2 })
  })

  it('samo poraba → loaded 0, net negativen', () => {
    const s = giftCardTxSummary([{ amount: -8.9 }, { amount: -1.1 }])
    expect(s).toEqual({ loaded: 0, spent: 10, net: -10, count: 2 })
  })

  it('izenačena množica → net točno 0 (float varnost)', () => {
    const s = giftCardTxSummary([{ amount: 0.1 }, { amount: 0.2 }, { amount: -0.3 }])
    expect(s.net).toBeCloseTo(0, 10)
    expect(Object.is(s.net, -0)).toBe(false) // −0 ni veljaven prikaz neto
  })

  it('NaN/Infinity zneski so zaščiteni kot 0 (pokvarjeni podatki ne razbijejo KPI)', () => {
    const s = giftCardTxSummary([
      { amount: Number.NaN },
      { amount: Number.POSITIVE_INFINITY },
      { amount: Number.NEGATIVE_INFINITY },
      { amount: 5 },
    ])
    expect(s.loaded).toBe(5)
    expect(s.spent).toBe(0)
    expect(s.net).toBe(5)
    expect(Number.isFinite(s.net)).toBe(true)
  })

  it('invarianta net = loaded − spent na 200 naključnih množicah', () => {
    for (let i = 0; i < 200; i++) {
      const n = 1 + (i % 7)
      const txs = Array.from({ length: n }, (_, j) => {
        const cents = ((i * 37 + j * 13) % 4000) - 2000 // −20 € .. +20 €
        return { amount: cents / 100 }
      })
      const s = giftCardTxSummary(txs)
      expect(s.count).toBe(n)
      expect(s.net).toBeCloseTo(s.loaded - s.spent, 8)
      expect(s.loaded).toBeGreaterThanOrEqual(0)
      expect(s.spent).toBeGreaterThanOrEqual(0)
    }
  })
})
