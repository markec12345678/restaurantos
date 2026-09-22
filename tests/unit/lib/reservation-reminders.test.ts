// ─── RUNDA 54: opomniki gostom + LJ-časovni žig ───
// 1) formatLjubljanaTime — API konfliktno sporočilo je ŽIVELO z UTC časom
//    (Vercel strežnik): "17:00:00" namesto "19:00" po ljubljanskem času.
//    Testi zaklenejo eksplicitno cono (zimski/letni prehod!) in null
//    pri pokvarjenem vnosu.
// 2) OPOMNIK_FORMS — nova besedna družina v sl-plural (KPI čip "N brez
//    opomnika"): 1 opomnik · 2 opomnika · 3 opomniki · 5 opomnikov,
//    izjema 11–14 vedno rodilnik.
import { describe, it, expect } from 'vitest'
import { formatLjubljanaTime } from '@/lib/reservation-timeline'
import { slCount, slPluralWord, OPOMNIK_FORMS } from '@/lib/sl-plural'

describe('formatLjubljanaTime', () => {
  it('poletni čas: 17:00Z → 19:00 (CEST, UTC+2)', () => {
    // Sep = CEST
    expect(formatLjubljanaTime('2026-09-19T17:00:00.000Z')).toBe('19:00')
  })

  it('zimski čas: 17:00Z → 18:00 (CET, UTC+1) — prehod je iz datuma', () => {
    // Jan = CET
    expect(formatLjubljanaTime('2026-01-19T17:00:00.000Z')).toBe('18:00')
  })

  it('sprejme Date objekt (ne samo ISO niz)', () => {
    expect(formatLjubljanaTime(new Date('2026-09-19T17:00:00.000Z'))).toBe('19:00')
  })

  it('sprejme epoch milisekunde', () => {
    expect(formatLjubljanaTime(Date.parse('2026-09-19T17:00:00.000Z'))).toBe('19:00')
  })

  it('sekunde so odrezane (šum v toastu — prej "17:00:00")', () => {
    const out = formatLjubljanaTime('2026-09-19T17:00:37.000Z')
    expect(out).toBe('19:00')
    expect(out).not.toContain(':37')
    expect(out).not.toContain('00:00')
  })

  it('polnoč čez mejo dneva: 22:30Z poletje → 00:30 naslednji dan', () => {
    expect(formatLjubljanaTime('2026-09-19T22:30:00.000Z')).toBe('00:30')
  })

  it('neveljaven datum → null (ne "Invalid Date")', () => {
    expect(formatLjubljanaTime('not-a-date')).toBeNull()
    expect(formatLjubljanaTime(new Date('Invalid'))).toBeNull()
  })

  it('konfliktno sporočilo končno prikaže LJ čas: 17:00Z sestavi "(Ime, 19:00)"', () => {
    // Integracijski kontrakt za PUT /api/reservations/[id] 409 sporočilo
    const hm = formatLjubljanaTime('2026-09-19T17:00:00.000Z')
    const msg = `Miza je že rezervirana ob tem času (QA R54 Zasedena${hm ? `, ${hm}` : ''})`
    expect(msg).toBe('Miza je že rezervirana ob tem času (QA R54 Zasedena, 19:00)')
  })
})

describe('OPOMNIK_FORMS (sl-plural besedna družina)', () => {
  it('osnovne oblike: 1 opomnik · 2 opomnika · 3 opomniki · 5 opomnikov', () => {
    expect(slCount(1, OPOMNIK_FORMS)).toBe('1 opomnik')
    expect(slCount(2, OPOMNIK_FORMS)).toBe('2 opomnika')
    expect(slCount(3, OPOMNIK_FORMS)).toBe('3 opomniki')
    expect(slCount(5, OPOMNIK_FORMS)).toBe('5 opomnikov')
  })

  it('izjema 11–14: vedno rodilnik (11 opomnikov)', () => {
    expect(slCount(11, OPOMNIK_FORMS)).toBe('11 opomnikov')
    expect(slCount(12, OPOMNIK_FORMS)).toBe('12 opomnikov')
    expect(slCount(14, OPOMNIK_FORMS)).toBe('14 opomnikov')
  })

  it('zadnja številka norma: 21 → ednina, 22 → dvojina, 23 → malo mn.', () => {
    expect(slCount(21, OPOMNIK_FORMS)).toBe('21 opomnik')
    expect(slCount(22, OPOMNIK_FORMS)).toBe('22 opomnika')
    expect(slCount(23, OPOMNIK_FORMS)).toBe('23 opomniki')
  })

  it('0 → rodilnik (chip se tudi ne prikaže, a kontrakt ostane)', () => {
    expect(slCount(0, OPOMNIK_FORMS)).toBe('0 opomnikov')
  })

  it('samo beseda: slPluralWord brez števca', () => {
    expect(slPluralWord(1, OPOMNIK_FORMS)).toBe('opomnik')
    expect(slPluralWord(101, OPOMNIK_FORMS)).toBe('opomnik')
    expect(slPluralWord(111, OPOMNIK_FORMS)).toBe('opomnikov')
  })
})
