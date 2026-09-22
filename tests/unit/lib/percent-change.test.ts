import { describe, expect, it } from 'vitest'
import { pctChange } from '@/lib/percent-change'

// R65: enoten vir za "sprememba v %" (digest primerjava z prejšnjim dnem).
// Pravila prevzeta iz obstoječe revenueChangePct logike (daily-digest.ts):
// zaokroževanje na 1 decimalko + null, ko prejšnja vrednost ni primerljiva.

describe('pctChange', () => {
  it('osnovni rast: 480 iz 400 → +20', () => {
    expect(pctChange(480, 400)).toBe(20)
  })

  it('padec: 320 iz 400 → −20', () => {
    expect(pctChange(320, 400)).toBe(-20)
  })

  it('zaokroži na 1 decimalko: 105,45 iz 88,00 → +19,8', () => {
    // (105.45 - 88) / 88 = 0.19829… → 19.829… → 19.8
    expect(pctChange(105.45, 88)).toBe(19.8)
  })

  it('nič spremembe: 400 iz 400 → 0', () => {
    expect(pctChange(400, 400)).toBe(0)
  })

  it('prejšnja vrednost 0 → null ("ni primerjave", NE neskončnost)', () => {
    expect(pctChange(105.45, 0)).toBeNull()
  })

  it('negativna prejšnja vrednost → null (ni smiselna baza)', () => {
    expect(pctChange(50, -10)).toBeNull()
  })

  it('ne-finitne vrednosti → null (NaN / Infinity)', () => {
    expect(pctChange(Number.NaN, 100)).toBeNull()
    expect(pctChange(100, Number.NaN)).toBeNull()
    expect(pctChange(Number.POSITIVE_INFINITY, 100)).toBeNull()
  })

  it('nemalštevilski vhodi (string) → null — ne vreči', () => {
    // Number('abc') = NaN → zaščiteno; klicatelji ne morejo porušiti UI
    expect(pctChange('abc' as unknown as number, 100)).toBeNull()
    expect(pctChange(100, undefined as unknown as number)).toBeNull()
  })
})
