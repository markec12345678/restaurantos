// ─── RUNDA 57: značka opomnika s časovnim žigom ───
// reminderSent (R54) pove SAMO DA je opomnik odšel; reminderSentAt (R57)
// pove KDY. reminderBadgeLabel združi obe: "Opomnik poslan ob 19:00"
// (LJ cona), fallback "Opomnik poslan" za starejše vrstice brez žiga ali
// pokvarjen datum, null ko opomnik ni poslan (klicatelj ne izriše značke).
import { describe, it, expect } from 'vitest'
import { reminderBadgeLabel } from '@/lib/reservation-timeline'

describe('reminderBadgeLabel', () => {
  it('reminderSent=false → null (značka se ne izriše)', () => {
    expect(reminderBadgeLabel(false, '2026-09-19T17:00:00.000Z')).toBeNull()
    expect(reminderBadgeLabel(false, null)).toBeNull()
    expect(reminderBadgeLabel(false, undefined)).toBeNull()
  })

  it('flag brez žiga (starejše vrstice R54) → suho "Opomnik poslan"', () => {
    expect(reminderBadgeLabel(true, null)).toBe('Opomnik poslan')
    expect(reminderBadgeLabel(true, undefined)).toBe('Opomnik poslan')
  })

  it('z žigom poletni čas: → "Opomnik poslan ob 19:00" (CEST)', () => {
    expect(reminderBadgeLabel(true, '2026-09-19T17:00:00.000Z')).toBe('Opomnik poslan ob 19:00')
  })

  it('z žigom zimski čas: → "Opomnik poslan ob 18:00" (CET) — DST iz datuma', () => {
    expect(reminderBadgeLabel(true, '2026-01-19T17:00:00.000Z')).toBe('Opomnik poslan ob 18:00')
  })

  it('sprejme Date objekt in epoch milisekunde', () => {
    expect(reminderBadgeLabel(true, new Date('2026-09-19T17:00:00.000Z'))).toBe('Opomnik poslan ob 19:00')
    expect(reminderBadgeLabel(true, Date.parse('2026-09-19T17:00:00.000Z'))).toBe('Opomnik poslan ob 19:00')
  })

  it('pokvarjen žig → fallback na suho oznako (ne "Invalid Date" smeti)', () => {
    expect(reminderBadgeLabel(true, 'not-a-date')).toBe('Opomnik poslan')
    expect(reminderBadgeLabel(true, new Date('Invalid'))).toBe('Opomnik poslan')
  })

  it('sekunde niso del značke (šum)', () => {
    const label = reminderBadgeLabel(true, '2026-09-19T17:00:37.000Z')
    expect(label).toBe('Opomnik poslan ob 19:00')
    expect(label).not.toContain('37')
  })
})
