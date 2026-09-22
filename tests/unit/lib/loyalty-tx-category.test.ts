import { describe, it, expect } from 'vitest'
import {
  loyaltyTxCategory,
  presentLoyaltyTxCategories,
  loyaltyTxSummary,
  LOYALTY_TX_CATEGORY_ORDER,
} from '@/lib/loyalty-tx-category'

describe('loyaltyTxCategory', () => {
  // --- osnovni tipi ---
  it('earn (navadne prislužene točke)', () => {
    expect(loyaltyTxCategory({ type: 'earn', reason: 'Točke za plačilo 43.80 EUR' })).toBe('earn')
    expect(loyaltyTxCategory({ type: 'earn', reason: 'Prislužene točke' })).toBe('earn')
    expect(loyaltyTxCategory({ type: 'earn', reason: null })).toBe('earn')
    expect(loyaltyTxCategory({ type: 'earn', reason: undefined })).toBe('earn')
  })

  it('redeem / adjust / expire po type', () => {
    expect(loyaltyTxCategory({ type: 'redeem', reason: 'Unovčenje točk' })).toBe('redeem')
    expect(loyaltyTxCategory({ type: 'adjust', reason: 'Ročna prilagoditev' })).toBe('adjust')
    expect(loyaltyTxCategory({ type: 'expire', reason: 'Potekle točke' })).toBe('expire')
    expect(loyaltyTxCategory({ type: 'expire', reason: null })).toBe('expire')
  })

  // --- razlog ima prednost pred type (R45 backend: bonus/povišanje = type earn) ---
  it('bonus: prefix "Bonus nivoa" nad type earn', () => {
    expect(loyaltyTxCategory({ type: 'earn', reason: 'Bonus nivoa Srebrni (+5 %)' })).toBe('bonus')
    expect(loyaltyTxCategory({ type: 'earn', reason: 'Bonus nivoa Zlati (+10 %)' })).toBe('bonus')
    expect(loyaltyTxCategory({ type: 'earn', reason: 'Bonus nivoa' })).toBe('bonus')
  })

  it('povišanje: prefix "Povišanje nivoa" nad type earn', () => {
    expect(loyaltyTxCategory({ type: 'earn', reason: 'Povišanje nivoa v Zlati' })).toBe('upgrade')
    expect(loyaltyTxCategory({ type: 'earn', reason: 'Povišanje nivoa v Platinasti' })).toBe('upgrade')
  })

  it('KONTRAKT prefix (ne substring): "Velik Bonus nivoa" NI bonus', () => {
    expect(loyaltyTxCategory({ type: 'earn', reason: 'Velik Bonus nivoa' })).toBe('earn')
    expect(loyaltyTxCategory({ type: 'earn', reason: 'Konec: Povišanje nivoa v Zlati' })).toBe('earn')
  })

  it('razlog ne prepriča če je type redeem — redeem ostane redeem', () => {
    // varnost: če bi backend kdaj zapisal redeem z dvomljivim razlogom
    expect(loyaltyTxCategory({ type: 'redeem', reason: 'Bonus nivoa X' })).toBe('redeem')
  })

  // --- fallbacki ---
  it('neznani type → adjust (isti fallback kot prej v dialogu)', () => {
    expect(loyaltyTxCategory({ type: 'mystery', reason: '?' })).toBe('adjust')
    expect(loyaltyTxCategory({ type: '', reason: '' })).toBe('adjust')
  })

  it('neveljavni vhodi ne crashajo', () => {
    expect(loyaltyTxCategory({ type: null as unknown as string, reason: null })).toBe('adjust')
    expect(loyaltyTxCategory(undefined as unknown as { type: string; reason?: string | null })).toBe('adjust')
    expect(loyaltyTxCategory({ type: 'earn', reason: 42 as unknown as string })).toBe('earn')
  })
})

describe('presentLoyaltyTxCategories', () => {
  it('prazna množica → prazen seznam', () => {
    expect(presentLoyaltyTxCategories([])).toEqual([])
    expect(presentLoyaltyTxCategories(undefined as unknown as never[])).toEqual([])
  })

  it('kanonični vrstni red ne glede na vrstni red vhoda', () => {
    const txs = [
      { type: 'redeem', points: -10, reason: null },
      { type: 'earn', points: 10, reason: 'x' },
      { type: 'expire', points: -5, reason: null },
      { type: 'earn', points: 1, reason: 'Bonus nivoa Srebrni (+5 %)' },
      { type: 'earn', points: 0, reason: 'Povišanje nivoa v Zlati' },
      { type: 'adjust', points: 2, reason: null },
    ]
    expect(presentLoyaltyTxCategories(txs)).toEqual(LOYALTY_TX_CATEGORY_ORDER)
  })

  it('samo prisotne kategorije, brez duplikatov', () => {
    const txs = [
      { type: 'earn', points: 5, reason: 'a' },
      { type: 'earn', points: 3, reason: 'Bonus nivoa Zlati (+10 %)' },
      { type: 'earn', points: 7, reason: 'b' },
    ]
    expect(presentLoyaltyTxCategories(txs)).toEqual(['earn', 'bonus'])
  })
})

describe('loyaltyTxSummary', () => {
  it('prazna množica → ničli', () => {
    expect(loyaltyTxSummary([])).toEqual({ earned: 0, spent: 0, net: 0, count: 0 })
  })

  it('earned / spent / net / count', () => {
    const txs = [
      { type: 'earn', points: 43, reason: 'x' },
      { type: 'earn', points: 500, reason: 'y' },
      { type: 'redeem', points: -100, reason: null },
      { type: 'adjust', points: -5, reason: null },
    ]
    expect(loyaltyTxSummary(txs)).toEqual({ earned: 543, spent: 105, net: 438, count: 4 })
  })

  it('0-točkovna povišanja ne vplivajo na earned/spent, a štejejo v count in net', () => {
    const txs = [
      { type: 'earn', points: 0, reason: 'Povišanje nivoa v Zlati' },
      { type: 'earn', points: 10, reason: 'x' },
    ]
    expect(loyaltyTxSummary(txs)).toEqual({ earned: 10, spent: 0, net: 10, count: 2 })
  })

  it('NaN/Infinity točke šteje kot 0 (varnost pred pokvarjenimi podatki)', () => {
    const txs = [
      { type: 'earn', points: Number.NaN, reason: null },
      { type: 'earn', points: Number.POSITIVE_INFINITY, reason: null },
      { type: 'earn', points: 8, reason: null },
    ]
    expect(loyaltyTxSummary(txs)).toEqual({ earned: 8, spent: 0, net: 8, count: 3 })
  })

  it('net je vedno earned - spent pri čistih podatkih', () => {
    const txs = [
      { type: 'earn', points: 100, reason: null },
      { type: 'redeem', points: -30, reason: null },
      { type: 'expire', points: -20, reason: null },
    ]
    const s = loyaltyTxSummary(txs)
    expect(s.net).toBe(s.earned - s.spent)
    expect(s.net).toBe(50)
  })
})
