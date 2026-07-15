// ============================================
// FURS VAT Breakdown parser — Unit testi
// Kritično za pravilno davčno poročanje FURS-u
// ============================================
import { describe, it, expect } from 'vitest'
import { parseVatBreakdown } from '@/app/api/furs/shared'

describe('parseVatBreakdown', () => {
  describe('z veljavnim JSON inputom', () => {
    it('pravilno razčleni 22% DDV postavko', () => {
      const input = JSON.stringify({ '22': { base: 100, vat: 22 } })
      const result = parseVatBreakdown(input)
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({ rate: 22, baseAmount: 100, vatAmount: 22 })
    })

    it('pravilno razčleni 9.5% DDV postavko', () => {
      const input = JSON.stringify({ '9.5': { base: 50, vat: 4.75 } })
      const result = parseVatBreakdown(input)
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({ rate: 9.5, baseAmount: 50, vatAmount: 4.75 })
    })

    it('pravilno razčleni več DDV stopenj hkrati', () => {
      const input = JSON.stringify({
        '22': { base: 100, vat: 22 },
        '9.5': { base: 50, vat: 4.75 },
        '0': { base: 20, vat: 0 },
      })
      const result = parseVatBreakdown(input)
      expect(result).toHaveLength(3)
      const rates = result.map(r => r.rate).sort((a, b) => a - b)
      expect(rates).toEqual([0, 9.5, 22])
    })

    it('obrne string key v number', () => {
      const input = JSON.stringify({ '22': { base: 10, vat: 2.2 } })
      const result = parseVatBreakdown(input)
      expect(typeof result[0].rate).toBe('number')
      expect(result[0].rate).toBe(22)
    })

    it('default-a manjkajoče base/vat na 0', () => {
      const input = JSON.stringify({ '22': {} })
      const result = parseVatBreakdown(input)
      expect(result[0].baseAmount).toBe(0)
      expect(result[0].vatAmount).toBe(0)
    })
  })

  describe('fallback behavior', () => {
    it('generira fallback 22% postavko, če je input prazen "{}"', () => {
      const result = parseVatBreakdown('{}', 122)
      expect(result).toHaveLength(1)
      expect(result[0].rate).toBe(22)
      expect(result[0].baseAmount).toBeCloseTo(100, 2) // 122 / 1.22 = 100
      expect(result[0].vatAmount).toBeCloseTo(22, 2)   // 122 - 100 = 22
    })

    it('generira fallback 9.5% postavko, ko je fallbackVatRate podan', () => {
      const result = parseVatBreakdown('{}', 109.5, 9.5)
      expect(result).toHaveLength(1)
      expect(result[0].rate).toBe(9.5)
      expect(result[0].baseAmount).toBeCloseTo(100, 2)
      expect(result[0].vatAmount).toBeCloseTo(9.5, 2)
    })

    it('generira fallback iz praznega stringa', () => {
      const result = parseVatBreakdown('', 122)
      expect(result).toHaveLength(1)
      expect(result[0].rate).toBe(22)
    })

    it('ne generira fallback-a, če fallbackTotal manjka', () => {
      const result = parseVatBreakdown('{}')
      expect(result).toHaveLength(0)
    })

    it('ne generira fallback-a, če je fallbackTotal 0', () => {
      const result = parseVatBreakdown('{}', 0)
      expect(result).toHaveLength(0)
    })

    it('ne generira fallback-a, če je fallbackTotal negativen', () => {
      const result = parseVatBreakdown('{}', -10)
      expect(result).toHaveLength(0)
    })
  })

  describe('z neveljavnim JSON inputom', () => {
    it('vrne fallback, ko JSON parse ne uspe', () => {
      const invalidJson = 'not-a-json{{{'
      const result = parseVatBreakdown(invalidJson, 122)
      expect(result).toHaveLength(1)
      expect(result[0].rate).toBe(22)
      expect(result[0].baseAmount).toBeCloseTo(100, 2)
    })

    it('vrne prazno array, če JSON neuspešen in fallbackTotal manjka', () => {
      const result = parseVatBreakdown('not-a-json')
      expect(result).toEqual([])
    })
  })

  describe('edge cases', () => {
    it('obrne prazno array za prazen objekt brez fallback', () => {
      expect(parseVatBreakdown('{}')).toEqual([])
    })

    it('pravilno obdela zelo majhne zneske', () => {
      const input = JSON.stringify({ '22': { base: 0.01, vat: 0.0022 } })
      const result = parseVatBreakdown(input)
      expect(result[0].baseAmount).toBeCloseTo(0.01, 4)
      expect(result[0].vatAmount).toBeCloseTo(0.0022, 4)
    })

    it('pravilno obdela zelo velike zneske', () => {
      const input = JSON.stringify({ '22': { base: 1000000, vat: 220000 } })
      const result = parseVatBreakdown(input)
      expect(result[0].baseAmount).toBe(1000000)
      expect(result[0].vatAmount).toBe(220000)
    })

    it('pravilno obdela 0% DDV stopnjo', () => {
      const input = JSON.stringify({ '0': { base: 50, vat: 0 } })
      const result = parseVatBreakdown(input)
      expect(result[0].rate).toBe(0)
      expect(result[0].vatAmount).toBe(0)
    })
  })
})
