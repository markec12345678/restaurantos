// ============================================
// R166 — FURS TIMEZONE CET/CEST DST MATRIKA
// ============================================
// Audit §4.4 točka 5: toSlovenianDate/toSlovenianISO (BUG-HUNT fix 2026-09-19
// — prehod CEST→CET ob 01:00 UTC, prej off-by-one) NISTA imela namenskih testov.
// Matrika: poletje/zima + oba prehodna dneva 2026 (zadnja nedelja mar/okt).
// ============================================

import { describe, it, expect } from 'vitest'
import { toSlovenianDate, toSlovenianISO, getLastSunday } from '@/lib/furs/helpers/timezone'

describe('R166: FURS timezone DST matrika (CET/CEST)', () => {
  it('getLastSunday: marec 2026 → 29, oktober 2026 → 25', () => {
    expect(getLastSunday(2026, 2, 31)).toBe(29)
    expect(getLastSunday(2026, 9, 31)).toBe(25)
  })

  it('poletje (CEST +2): 12:00 UTC → 14:00 lokalno', () => {
    const d = toSlovenianDate(new Date('2026-06-15T12:00:00Z'))
    expect(d).toEqual({ year: 2026, month: 6, day: 15, hours: 14, minutes: 0, seconds: 0 })
    expect(toSlovenianISO(new Date('2026-06-15T12:00:00Z'))).toBe('2026-06-15T14:00:00+02:00')
  })

  it('zima (CET +1): 12:00 UTC → 13:00 lokalno', () => {
    const d = toSlovenianDate(new Date('2026-01-15T12:00:00Z'))
    expect(d).toEqual({ year: 2026, month: 1, day: 15, hours: 13, minutes: 0, seconds: 0 })
    expect(toSlovenianISO(new Date('2026-01-15T12:00:00Z'))).toBe('2026-01-15T13:00:00+01:00')
  })

  it('pomladanski prehod 29.3.2026: 00:30 UTC še CET, 01:00 UTC že CEST', () => {
    // 00:30 UTC + 1 h = 01:30 CET (praznik še zimski čas)
    expect(toSlovenianISO(new Date('2026-03-29T00:30:00Z'))).toBe('2026-03-29T01:30:00+01:00')
    // 01:00 UTC + 2 h = 03:00 CEST (ura se preskoči 02:00→03:00)
    expect(toSlovenianISO(new Date('2026-03-29T01:00:00Z'))).toBe('2026-03-29T03:00:00+02:00')
  })

  it('jesenski prehod 25.10.2026: 00:30 UTC še CEST (BUG-HUNT off-by-one pin), 01:00 UTC že CET', () => {
    // BUG-HUNT 2026-09-19: v oknu 00:00–01:00 UTC je lokalni čas ŠE CEST (+2)
    // → 00:30 + 2 h = 02:30 CEST (prej napačno +1 = 01:30)
    expect(toSlovenianISO(new Date('2026-10-25T00:30:00Z'))).toBe('2026-10-25T02:30:00+02:00')
    // 01:00 UTC + 1 h = 02:00 CET (ura se vrne 03:00→02:00)
    expect(toSlovenianISO(new Date('2026-10-25T01:00:00Z'))).toBe('2026-10-25T02:00:00+01:00')
  })
})
