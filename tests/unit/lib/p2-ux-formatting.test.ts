// ============================================
// P2-UX TESTI — formatiranje denarja (sl-SI), vnos z vejico,
// časovni pas ljubljanskih poslovnih dni, prevodi napak
// ============================================

import { describe, it, expect } from 'vitest'
import { formatEUR, formatNumberSl, parseDecimalInput, safeToFixed, safeNum } from '@/lib/safe-format'
import { ljubljanaDayBounds, ljubljanaTodayStr } from '@/lib/timezone-sl'
import { errorSl } from '@/lib/error-messages'

// ─────────────────────────────────────────────
// formatEUR / formatNumberSl — slovenska decimalna vejica
// ─────────────────────────────────────────────
describe('P2-UX: formatEUR (sl-SI)', () => {
  it('formatira 12.5 kot "12,50 €" (vejica, ne pika)', () => {
    const out = formatEUR(12.5)
    expect(out).toContain('12,50')
    expect(out).not.toContain('12.50')
    expect(out).toContain('€')
  })

  it('formatira ločila tisočic za velike zneske (1.234,56 €)', () => {
    const out = formatEUR(1234.56)
    expect(out).toContain('1.234,56')
  })

  it('deluje z null/undefined/string/objektom s toNumber (safeNum pot)', () => {
    expect(formatEUR(null)).toBe('0,00 €')
    expect(formatEUR(undefined)).toBe('0,00 €')
    // safeNum('12,5') = parseFloat('12,5') = 12 — dokumentirano vedenje;
    // za vnosne polja uporabljaj parseDecimalInput
    expect(formatEUR('12,5')).toBe('12,00 €')
    expect(formatEUR({ toNumber: () => 7.25 } as unknown)).toBe('7,25 €')
  })

  it('formatNumberSl izpiše brez simbola valute', () => {
    expect(formatNumberSl(1234.56)).toBe('1.234,56')
  })

  it('negativni zneski (storno/popusti) — ASCII minus, ne tipografskega (−)', () => {
    expect(formatNumberSl(-45.5)).toBe('-45,50')
    expect(formatEUR(-45.5)).toBe('-45,50 €')
  })

  it('determinističen IZPIS neodvisen od Node ICU (small-ICU Docker/CI)', () => {
    // 1234.56 → vedno "1.234,56" tudi na Node small-ICU (kjer Intl('sl-SI')
    // ne bi ločil tisočic in bi dal tipografski minus)
    expect(formatEUR(1234.56)).toBe('1.234,56 €')
    expect(formatEUR(1234567.89)).toBe('1.234.567,89 €')
  })
})

// ─────────────────────────────────────────────
// parseDecimalInput — vnos z vejico (slovenska tipkovnica)
// ─────────────────────────────────────────────
describe('P2-UX: parseDecimalInput', () => {
  it('sprejme slovenski zapis z vejico: "12,50" → 12.5 (prej parseFloat → 12!)', () => {
    expect(parseDecimalInput('12,50')).toBe(12.5)
  })

  it('sprejme angleški zapis s piko: "12.50" → 12.5', () => {
    expect(parseDecimalInput('12.50')).toBe(12.5)
  })

  it('ločila tisočic z vejico: "1.234,56" → 1234.56', () => {
    expect(parseDecimalInput('1.234,56')).toBe(1234.56)
  })

  it('ločila tisočic s presledki: "1 234,56" → 1234.56', () => {
    expect(parseDecimalInput('1 234,56')).toBe(1234.56)
  })

  it('več pik brez vejice = ločila tisočic: "1.234.567" → 1234567', () => {
    expect(parseDecimalInput('1.234.567')).toBe(1234567)
  })

  it('neveljavni vnosi → 0 (ne NaN)', () => {
    expect(parseDecimalInput('')).toBe(0)
    expect(parseDecimalInput('abc')).toBe(0)
    expect(parseDecimalInput(null)).toBe(0)
  })

  it('number gre naravnost skozi, presledki se odstranijo', () => {
    expect(parseDecimalInput(7.5)).toBe(7.5)
    expect(parseDecimalInput(' 12,50 ')).toBe(12.5)
  })

  it('ROUND-TRIP: vnos "12,50" → parseDecimalInput → formatEUR → "12,50 €"', () => {
    const parsed = parseDecimalInput('12,50')
    expect(formatEUR(parsed)).toContain('12,50')
  })
})

// ─────────────────────────────────────────────
// ljubljanaDayBounds / ljubljanaTodayStr — pravilen timezone
// ─────────────────────────────────────────────
describe('P2-UX: ljubljanaDayBounds (Europe/Ljubljana)', () => {
  it('zimski čas (CET, UTC+1): 2026-01-15 se začne ob 23:00 UTC prejšnjega dne', () => {
    const { start, end } = ljubljanaDayBounds('2026-01-15')
    expect(start.toISOString()).toBe('2026-01-14T23:00:00.000Z')
    expect(end.toISOString()).toBe('2026-01-15T23:00:00.000Z')
  })

  it('letni čas (CEST, UTC+2): 2026-07-15 se začne ob 22:00 UTC prejšnjega dne', () => {
    const { start, end } = ljubljanaDayBounds('2026-07-15')
    expect(start.toISOString()).toBe('2026-07-14T22:00:00.000Z')
    expect(end.toISOString()).toBe('2026-07-15T22:00:00.000Z')
  })

  it('preklop na poletni čas: 2026-03-29 (CEST začetek 02:00 → 03:00) ima 23 h', () => {
    const { start, end } = ljubljanaDayBounds('2026-03-29')
    // 2026-03-29: preklop ob 01:00 UTC → dan je 23 ur dolg
    expect(end.getTime() - start.getTime()).toBe(23 * 3600 * 1000)
    expect(start.toISOString()).toBe('2026-03-28T23:00:00.000Z')
  })

  it('preklop na zimski čas: 2026-10-25 ima 25 h', () => {
    const { start, end } = ljubljanaDayBounds('2026-10-25')
    expect(end.getTime() - start.getTime()).toBe(25 * 3600 * 1000)
  })

  it('zahteva format YYYY-MM-DD — drugače vrže (varovalka pred tiho napačno mejo)', () => {
    expect(() => ljubljanaDayBounds('15.01.2026')).toThrow()
    expect(() => ljubljanaDayBounds('')).toThrow()
  })

  it('ljubljanaTodayStr vrača YYYY-MM-DD v ljubljanskem času (ne UTC)', () => {
    // 2026-01-15 00:30 UTC = 01:30 ljubljansko → UTC "datum" bi bil še 15.,
    // a ob 23:30 UTC (00:30 ljubljansko naslednji dan) se razlikujeta:
    const earlyMorningUTC = new Date('2026-01-15T23:30:00Z') // 00:30 LJ 16.1.
    expect(ljubljanaTodayStr(earlyMorningUTC)).toBe('2026-01-16')
    const noonUTC = new Date('2026-01-15T12:00:00Z') // 13:00 LJ 15.1.
    expect(ljubljanaTodayStr(noonUTC)).toBe('2026-01-15')
  })
})

// ─────────────────────────────────────────────
// errorSl — prevodi znanih angleških napak
// ─────────────────────────────────────────────
describe('P2-UX: errorSl', () => {
  it('"Failed to fetch" → slovensko (browser network napaka)', () => {
    expect(errorSl(new Error('Failed to fetch'))).toBe('Ni povezave s strežnikom — preverite omrežje')
  })

  it('"Order not found" → slovensko', () => {
    expect(errorSl(new Error('Order not found'))).toBe('Naročilo ni najdeno')
  })

  it('slovenska sporočila iz backend-a ostanejo nespremenjena', () => {
    expect(errorSl(new Error('Naročilo je bilo spremenjeno s strani drugega uporabnika.')))
      .toBe('Naročilo je bilo spremenjeno s strani drugega uporabnika.')
  })

  it('prazna/neznana napada → fallback', () => {
    expect(errorSl(null, 'Moj fallback')).toBe('Moj fallback')
    expect(errorSl(new Error(''))).toBe('Prišlo je do napake')
    expect(errorSl(undefined, 'X')).toBe('X')
  })

  it('NE izpostavi stack-a ali ogromnih tehničnih sporočil (>300 znakov → fallback)', () => {
    const huge = 'x'.repeat(301)
    expect(errorSl(new Error(huge), 'Fallback')).toBe('Fallback')
  })

  it('string napake delujejo', () => {
    expect(errorSl('timeout')).toBe('Zahteva je potekla — poskusite znova')
  })

  it('Error-objekt s status 409: sporočilo se podaljsa (409/napaka med obdelavo)', () => {
    const e = new Error('Ček je že popolnoma plačan')
    Object.defineProperty(e, 'status', { value: 409 })
    expect(errorSl(e)).toBe('Ček je že popolnoma plačan')
  })
})

// ─────────────────────────────────────────────
// Regresija: safeToFixed / safeNum ostajata nestična
// (574 obstoječih klicev ne sme pasti)
// ─────────────────────────────────────────────
describe('P2-UX regresija: safeToFixed/safeNum', () => {
  it('safeToFixed še vedno deluje (pika — interno/pravljivo)', () => {
    expect(safeToFixed(12.5)).toBe('12.50')
    expect(safeToFixed(null)).toBe('0.00')
  })
  it('safeNum še vedno deluje', () => {
    expect(safeNum('7.25')).toBe(7.25)
    expect(safeNum(null)).toBe(0)
  })
})
