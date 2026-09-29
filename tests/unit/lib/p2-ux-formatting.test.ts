// ============================================
// P2-UX TESTI — formatiranje denarja (sl-SI), vnos z vejico,
// časovni pas ljubljanskih poslovnih dni, prevodi napak
// ============================================

import { describe, it, expect } from 'vitest'
import { formatEUR, formatNumberSl, parseDecimalInput, safeToFixed, safeNum } from '@/lib/safe-format'
import { ljubljanaDayBounds, ljubljanaTodayStr, ljubljanaDateTimeParts, ljubljanaYesterdayStr, ljubljanaDayOfWeek } from '@/lib/timezone-sl'
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

  // ── R159 (R158-4): letnica UTC → LJ poslovni dan (year-boundary pin) ──
  it('LETNICA: bounds 2025-01-01 = [2024-12-31T23:00Z, 2025-01-01T23:00Z) — plačilo 30 min po UTC polnoči je LJ dan 2025-01-01', () => {
    const { start, end } = ljubljanaDayBounds('2025-01-01')
    expect(start.toISOString()).toBe('2024-12-31T23:00:00.000Z')
    expect(end.toISOString()).toBe('2025-01-01T23:00:00.000Z')
    expect(ljubljanaDateTimeParts('2024-12-31T23:30:00.000Z')).toEqual({ date: '2025-01-01', time: '00:30' })
    expect(ljubljanaDateTimeParts('2025-01-01T00:30:00.000Z')).toEqual({ date: '2025-01-01', time: '01:30' })
  })

  // ── R159: DST-konec (2024: preklop 03:00 CEST → 02:00 CET) — 25-h dan ──
  it('DST-konec: 2024-10-27 je 25 h dan (start 2024-10-26T22:00Z CEST, end 2024-10-27T23:00Z CET); isti LJ dan na obeh straneh preklopa', () => {
    const { start, end } = ljubljanaDayBounds('2024-10-27')
    expect(start.toISOString()).toBe('2024-10-26T22:00:00.000Z')
    expect(end.toISOString()).toBe('2024-10-27T23:00:00.000Z')
    expect(end.getTime() - start.getTime()).toBe(25 * 3600 * 1000)
    // 22:30Z 26.10. je še CEST (+2) → LJ 00:30 27.10. (začetek 25-h dneva)
    expect(ljubljanaDateTimeParts('2024-10-26T22:30:00.000Z')).toEqual({ date: '2024-10-27', time: '00:30' })
    // 23:30Z 27.10. je že CET (+1) → LJ 00:30 NASLEDNJEGA dne (28.10.)
    expect(ljubljanaDateTimeParts('2024-10-27T23:30:00.000Z')).toEqual({ date: '2024-10-28', time: '00:30' })
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

  // R48: ljubljanaYesterdayStr — ENOTEN vir digest semantike (delili prej
  // duplicirane lokalne kopije v /reports/digest in EmailTab izbirnik)
  it('ljubljanaYesterdayStr: včeraj po LJ, četudi je UTC že naslednji dan', () => {
    // 23:30 UTC 15.1. = 00:30 LJ 16.1. → LJ danes 16.1., LJ včeraj = 15.1.
    const earlyMorningUTC = new Date('2026-01-15T23:30:00Z')
    expect(ljubljanaYesterdayStr(earlyMorningUTC)).toBe('2026-01-15')
    const noonUTC = new Date('2026-01-15T12:00:00Z') // LJ 15.1. → včeraj 14.1.
    expect(ljubljanaYesterdayStr(noonUTC)).toBe('2026-01-14')
  })

  it('ljubljanaYesterdayStr: mesečno/letno mejo (1. januar → 31. december) in prestopno leto', () => {
    const newYear = new Date('2026-01-01T12:00:00Z') // LJ 1.1.2026 → včeraj 31.12.2025
    expect(ljubljanaYesterdayStr(newYear)).toBe('2025-12-31')
    const leapEve = new Date('2024-03-01T12:00:00Z') // LJ 1.3.2024 (prestopno) → včeraj 29.2.2024
    expect(ljubljanaYesterdayStr(leapEve)).toBe('2024-02-29')
  })
})

// ─────────────────────────────────────────────
// ljubljanaDateTimeParts (FIX R43) — rezervacije: UTC ISO → LJ datum + 'HH:mm'
// ─────────────────────────────────────────────
describe('P2-UX: ljubljanaDateTimeParts (Europe/Ljubljana)', () => {
  it('zimski čas (CET, UTC+1): 19:00 UTC → 20:00 isti dan', () => {
    const out = ljubljanaDateTimeParts('2026-01-15T19:00:00.000Z')
    expect(out).toEqual({ date: '2026-01-15', time: '20:00' })
  })

  it('letni čas (CEST, UTC+2): 19:00 UTC → 21:00 isti dan', () => {
    const out = ljubljanaDateTimeParts('2026-07-15T19:00:00.000Z')
    expect(out).toEqual({ date: '2026-07-15', time: '21:00' })
  })

  it('POLNOČNI PREHOD: 23:00 UTC pozimi → NASLEDNJI koledarski dan po LJ (razlog za FIX R43)', () => {
    // Rezervacija "18. januar ob 24:00" ne obstaja; 19:00 UTC 18.1. je 20:00 18.1.,
    // ampak pozni večerni UTC časi drsijo v naslednji LJ dan:
    const out = ljubljanaDateTimeParts('2026-01-18T23:30:00.000Z') // 00:30 LJ 19.1.
    expect(out.date).toBe('2026-01-19')
    expect(out.time).toBe('00:30')
  })

  it('prazen/napačen vhod: varno vrne prazen datum (ne Invalid Date)', () => {
    expect(ljubljanaDateTimeParts(null)).toEqual({ date: '', time: '' })
    expect(ljubljanaDateTimeParts(undefined)).toEqual({ date: '', time: '' })
    expect(ljubljanaDateTimeParts('')).toEqual({ date: '', time: '' })
  })

  it("ne-ISO vhod s surovim rezom: 'YYYY-MM-DDTHH:mm' → prebere rez", () => {
    const out = ljubljanaDateTimeParts('2026-01-15T19:00')
    expect(out.date).toBe('2026-01-15')
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

// ─────────────────────────────────────────────
// R172: ljubljanaDayOfWeek — kanon za openingHours.dayOfWeek
// (r135 IT lekcija: new Date().getDay() na UTC stroju ob LJ polnoči
// vrne prejšnji dan; kanon mora biti izpeljan iz LJ koledarskega dneva)
// ─────────────────────────────────────────────
describe('P2-UX R172: ljubljanaDayOfWeek', () => {
  it('sobota 2026-10-03 00:30 UTC (sobota 02:30 LJ) → 6', () => {
    // 2026-10-03 je sobota; 00:30 UTC = 02:30 LJ — isti LJ dan
    expect(ljubljanaDayOfWeek(new Date('2026-10-03T00:30:00Z'))).toBe(6)
  })

  it('nedelja 00:30 UTC (01:30/02:30 LJ) → 0 (LJ dan, ne UTC petek)', () => {
    // 2026-10-04 je nedelja; 00:30 UTC je po LJ polnoči → LJ dan je že nedelja
    expect(ljubljanaDayOfWeek(new Date('2026-10-04T00:30:00Z'))).toBe(0)
  })

  it('ponedeljek 21:30 UTC (23:30 LJ ponedeljek, CEST) → 1 (ne torek)', () => {
    // 2026-10-05 je ponedeljek; 21:30 UTC = 23:30 LJ — še ponedeljek po LJ
    expect(ljubljanaDayOfWeek(new Date('2026-10-05T21:30:00Z'))).toBe(1)
  })

  it('torek 22:30 UTC (00:30 LJ sreda) → 3 (LJ dan je že sreda — zgreši v1 bug)', () => {
    // 2026-10-06 je torek; 22:30 UTC = 00:30 LJ SREDA (2026-10-07) → getDay() na
    // UTC stroju bi vrnil 2 (torek), kanon mora vrniti 3 (sreda)
    expect(ljubljanaDayOfWeek(new Date('2026-10-06T22:30:00Z'))).toBe(3)
  })

  it('izpeljan iz ljubljanaTodayStr (ist kanon kot loyalty todayKey)', () => {
    const now = new Date('2026-10-06T22:30:00Z')
    const ymd = ljubljanaTodayStr(now)
    expect(ymd).toBe('2026-10-07')
    expect(ljubljanaDayOfWeek(now)).toBe(new Date(`${ymd}T00:00:00Z`).getUTCDay())
  })
})
