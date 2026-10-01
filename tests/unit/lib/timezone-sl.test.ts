// ============================================
// #148 korak 2 (R204) — TIMEZONE TEST GATES (issue #148 §7)
// ============================================
// Regresijsko pokritje kanona Europe/Ljubljana (src/lib/timezone-sl.ts):
//   1. zima / CET (UTC+1)
//   2. poletje / CEST (UTC+2)
//   3. spomladanski DST prehod (2025-03-30: 23h dan, 02:00→03:00 preskok)
//   4. jesenski DST prehod (2025-10-26: 25h dan, 03:00→02:00 dvakrat)
//   5. letna meja (2024-12-31 → 2025-01-01)
//   6. Ljubljana 00:00–02:00 rob (UTC 22:00–24:00 = NASLEDNJI LJ dan!)
//   7. rezervacija UTC → Ljubljana lokalni prikaz (R43 lekcija: dan se lahko
//      prelomi — 22:30 UTC poleti = 00:30 NASLEDNJI dan)
//
// Kanon uporablja Intl z eksplicitnim timeZone — testi so NEODVISNI od
// strežniške TZ (vsi primerjani datumi so ISO 'Z' stringi, brez lokalnih
// Date konstruktorjev — to je TOČKA testa: browser/strežnik TZ ne sme
// spremeniti pomena poslovnega dne, issue #148 §6/§21 "Time" kriteriji).
// Ni NOVE timezone implementacije — samo regresijska vrata nad obstoječim
// kanonom (issue #148 §7: "Do not implement a second timezone utility").
// ============================================

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import {
  ljubljanaDateTimeParts,
  ljubljanaDayBounds,
  ljubljanaDayOfWeek,
  ljubljanaTodayStr,
  ljubljanaYesterdayStr,
} from '@/lib/timezone-sl'

const repo = (p: string) => resolve(process.cwd(), p)
const read = (p: string) => readFileSync(repo(p), 'utf8')

const H = 3600 * 1000

// — 1+2. Zima (CET) / poletje (CEST) —

describe('ljubljanaDayBounds — CET/CEST (#148 §7)', () => {
  it('zima / CET (UTC+1): LJ polnoč = 23:00Z prejšnjega dne', () => {
    const { start, end } = ljubljanaDayBounds('2025-01-15')
    expect(start.toISOString()).toBe('2025-01-14T23:00:00.000Z')
    expect(end.toISOString()).toBe('2025-01-15T23:00:00.000Z')
    expect(end.getTime() - start.getTime()).toBe(24 * H)
  })

  it('poletje / CEST (UTC+2): LJ polnoč = 22:00Z prejšnjega dne', () => {
    const { start, end } = ljubljanaDayBounds('2025-07-15')
    expect(start.toISOString()).toBe('2025-07-14T22:00:00.000Z')
    expect(end.toISOString()).toBe('2025-07-15T22:00:00.000Z')
    expect(end.getTime() - start.getTime()).toBe(24 * H)
  })
})

// — 3+4. DST prehoda —

describe('ljubljanaDayBounds — DST prehoda (#148 §7)', () => {
  it('spomladanski prehod 2025-03-30: 23h dan (02:00 CET → 03:00 CEST preskok)', () => {
    const { start, end } = ljubljanaDayBounds('2025-03-30')
    expect(start.toISOString()).toBe('2025-03-29T23:00:00.000Z')
    expect(end.toISOString()).toBe('2025-03-30T22:00:00.000Z')
    // NE fiksno 24h — konec je izračunan NEODVISNO (kanon komentar)
    expect(end.getTime() - start.getTime()).toBe(23 * H)
  })

  it('jesenski prehod 2025-10-26: 25h dan (03:00 CEST → 02:00 CET ponovitev)', () => {
    const { start, end } = ljubljanaDayBounds('2025-10-26')
    expect(start.toISOString()).toBe('2025-10-25T22:00:00.000Z')
    expect(end.toISOString()).toBe('2025-10-26T23:00:00.000Z')
    expect(end.getTime() - start.getTime()).toBe(25 * H)
  })

  it('DST meje NE zameščata prejšnjega/naslednjega dne (sosednji dnevi se stikajo čisto)', () => {
    // Dan PRED spomladanskim prehodom (zadnji CET dan, 24h)
    const before = ljubljanaDayBounds('2025-03-29')
    expect(before.start.toISOString()).toBe('2025-03-28T23:00:00.000Z')
    expect(before.end.toISOString()).toBe('2025-03-29T23:00:00.000Z')
    // Stik: end(29.3.) === start(30.3.) — brez vrzeli in brez prekrivanja
    const spring = ljubljanaDayBounds('2025-03-30')
    expect(before.end.getTime()).toBe(spring.start.getTime())
    // Jesen: start(27.10.) === end(26.10.)
    const autumn = ljubljanaDayBounds('2025-10-26')
    const after = ljubljanaDayBounds('2025-10-27')
    expect(after.start.getTime()).toBe(autumn.end.getTime())
  })
})

// — 5. Letna meja —

describe('ljubljanaDayBounds / TodayStr / YesterdayStr — letna meja (#148 §7)', () => {
  it('1.1.2025 LJ dan se začne 31.12.2024 23:00Z', () => {
    const { start, end } = ljubljanaDayBounds('2025-01-01')
    expect(start.toISOString()).toBe('2024-12-31T23:00:00.000Z')
    expect(end.toISOString()).toBe('2025-01-01T23:00:00.000Z')
  })

  it('ljubljanaTodayStr: 31.12.2024 23:30Z je po Ljubljani ŽE 1.1.2025', () => {
    expect(ljubljanaTodayStr(new Date('2024-12-31T23:30:00Z'))).toBe('2025-01-01')
    // in še 1h prej (22:30Z = 23:30 LJ) je še stari dan
    expect(ljubljanaTodayStr(new Date('2024-12-31T22:30:00Z'))).toBe('2024-12-31')
  })

  it('ljubljanaYesterdayStr: včeraj za 1.1.2025 LJ = 31.12.2024 (čist koledarski subtract)', () => {
    expect(ljubljanaYesterdayStr(new Date('2025-01-01T00:30:00Z'))).toBe('2024-12-31')
    // poletje: 1.7.2025 22:30Z = 2.7.2025 00:30 CEST → včeraj = 1.7.2025
    expect(ljubljanaYesterdayStr(new Date('2025-07-01T22:30:00Z'))).toBe('2025-07-01')
  })
})

// — 6. Ljubljana 00:00–02:00 rob —

describe('Ljubljana 00:00–02:00 rob (#148 §7; R172 lekcija r135 IT)', () => {
  it('ljubljanaTodayStr ob 00:30 LJ = NASLEDNJI koledarski dan (ne UTC dan!)', () => {
    // zima: 15.1. 23:30Z = 16.1. 00:30 CET (CET = UTC+1)
    expect(ljubljanaTodayStr(new Date('2025-01-15T23:30:00Z'))).toBe('2025-01-16')
    // poletje: 15.7. 22:30Z = 16.7. 00:30 CEST (CEST = UTC+2)
    expect(ljubljanaTodayStr(new Date('2025-07-15T22:30:00Z'))).toBe('2025-07-16')
    // natanko LJ polnoč (roba vključena v novi dan)
    expect(ljubljanaTodayStr(new Date('2025-07-15T22:00:00Z'))).toBe('2025-07-16')
    expect(ljubljanaTodayStr(new Date('2025-01-15T23:00:00Z'))).toBe('2025-01-16')
  })

  it('ljubljanaDayOfWeek ob LJ polnoči vrne pravi dan (getDay() na UTC stroju bi vrnil PREJŠNJI)', () => {
    // 16.1.2025 = četrtek (4). 15.1. 23:30Z je po LJ ŽE 16.1. → 4.
    expect(ljubljanaDayOfWeek(new Date('2025-01-15T23:30:00Z'))).toBe(4)
    // 17.7.2025 = četrtek (4); 16.7. 22:30Z = 17.7. 00:30 LJ → 4
    expect(ljubljanaDayOfWeek(new Date('2025-07-16T22:30:00Z'))).toBe(4)
    // referenca: sredi dneva seveda isti dan (15.1.2025 = sreda = 3)
    expect(ljubljanaDayOfWeek(new Date('2025-01-15T12:00:00Z'))).toBe(3)
  })
})

// — 7. Rezervacija UTC → Ljubljana prikaz (R43 lekcija) —

describe('ljubljanaDateTimeParts — rezervacija UTC → LJ lokal (#148 §7)', () => {
  it('poletje (CEST): 22:30 UTC = 00:30 NASLEDNJI LJ dan (dan se prelomi!)', () => {
    expect(ljubljanaDateTimeParts('2025-07-15T22:30:00Z')).toEqual({ date: '2025-07-16', time: '00:30' })
  })

  it('zima (CET): 23:30 UTC = 00:30 NASLEDNJI LJ dan', () => {
    expect(ljubljanaDateTimeParts('2025-01-15T23:30:00Z')).toEqual({ date: '2025-01-16', time: '00:30' })
  })

  it('sredi dneva: 19:00 UTC poleti = 21:00 LJ isti dan', () => {
    expect(ljubljanaDateTimeParts('2025-07-15T19:00:00Z')).toEqual({ date: '2025-07-15', time: '21:00' })
    expect(ljubljanaDateTimeParts('2025-01-15T19:00:00Z')).toEqual({ date: '2025-01-15', time: '20:00' })
  })

  it('spomladanski DST prehod: 00:30Z = 01:30 CET, 01:30Z = ŽE 03:30 CEST (preskok 02:xx)', () => {
    expect(ljubljanaDateTimeParts('2025-03-30T00:30:00Z')).toEqual({ date: '2025-03-30', time: '01:30' })
    expect(ljubljanaDateTimeParts('2025-03-30T01:30:00Z')).toEqual({ date: '2025-03-30', time: '03:30' })
  })

  it('neveljaven ISO → surov rez fallback (prazen čas), null/undefined → prazno', () => {
    expect(ljubljanaDateTimeParts('ni-datum')).toEqual({ date: 'ni-datum', time: '' })
    expect(ljubljanaDateTimeParts(null)).toEqual({ date: '', time: '' })
    expect(ljubljanaDateTimeParts(undefined)).toEqual({ date: '', time: '' })
  })
})

// — Kanon fs-pini (drift-gate: kokpit viri RABIJO kanon, strežniška TZ prepovedana) —

describe('#148 §6 fs-pini — kokpit viri uporabljajo kanon (drift-gate)', () => {
  it('operational-alerts: "danes" meja = ljubljanaDayBounds(ljubljanaTodayStr(now)), NE strežniška TZ', () => {
    const src = read('src/app/api/operational-alerts/route.ts')
    expect(src).toContain('ljubljanaDayBounds(ljubljanaTodayStr(now))')
    // negativen pin: server-lokalna polnoč (defekt #148 §6) odstranjena
    expect(src).not.toContain('new Date(now.getFullYear()')
  })

  it('dashboard (2. dan-bucketed kokpit vir) že uporablja kanon', () => {
    const src = read('src/app/api/dashboard/route.ts')
    expect(src).toContain('ljubljanaDayBounds')
    expect(src).toContain('ljubljanaTodayStr')
    expect(src).not.toContain('new Date(now.getFullYear()')
  })

  it('DanesCockpit: rezervacijski čas + glava prek kanona, browser-TZ formatiranje odstranjeno', () => {
    const src = read('src/components/pos/danes/DanesCockpit.tsx')
    // kanon v komponenti
    expect(src).toContain('ljubljanaDateTimeParts(')
    expect(src).toContain('ljubljanaTodayStr()')
    // negativen pin: browser-TZ čas (defekt #148 §6) odstranjen —
    // toLocaleTimeString brez timeZone pina se ne sme več pojaviti
    expect(src).not.toContain('toLocaleTimeString(')
  })

  it('timezone kanon je enoten (#148 §11 — ni druge implementacije)', () => {
    // kanon obstaja natanko enkrat; kokpit/route ga konzumirajo (ni lokalnega tzOffsetMs klonov)
    const cockpit = read('src/lib/danes/cockpit-state.ts')
    expect(cockpit).not.toContain('Intl.DateTimeFormat')
    expect(cockpit).not.toContain('Europe/Ljubljana')
  })
})
