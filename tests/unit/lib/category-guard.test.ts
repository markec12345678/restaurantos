import { describe, it, expect } from 'vitest'
import { canDeleteCategory } from '@/lib/category-guard'
import { ARTIKEL_FORMS, slCount, slPluralWord } from '@/lib/sl-plural'

// ============================================
// RUNDA 66: canDeleteCategory — odločitev brisanja kategorije
// ============================================

describe('canDeleteCategory', () => {
  it('prazna kategorija (0) → dovoljeno, status 200, slovensko sporočilo', () => {
    const d = canDeleteCategory(0)
    expect(d.allowed).toBe(true)
    expect(d.status).toBe(200)
    expect(d.messageSl).toContain('prazna')
  })

  it('1 artikel → blokirano 409, EDNINA "1 artikel"', () => {
    const d = canDeleteCategory(1)
    expect(d.allowed).toBe(false)
    expect(d.status).toBe(409)
    expect(d.messageSl).toContain('1 artikel')
    expect(d.messageSl).toContain('najprej premakni')
  })

  it('2 artikla → DVOJINA (slovnično pravilna dvojina, ne "2 artiklov")', () => {
    expect(canDeleteCategory(2).messageSl).toContain('2 artikla')
  })

  it('3 in 4 artikli → malo množina', () => {
    expect(canDeleteCategory(3).messageSl).toContain('3 artikli')
    expect(canDeleteCategory(4).messageSl).toContain('4 artikli')
  })

  it('5, 12, 100 artiklov → rodilnik "artiklov"', () => {
    expect(canDeleteCategory(5).messageSl).toContain('5 artiklov')
    expect(canDeleteCategory(12).messageSl).toContain('12 artiklov')
    expect(canDeleteCategory(100).messageSl).toContain('100 artiklov')
  })

  it('11–14 → VEDNO rodilnik (izjema sklopa)', () => {
    expect(canDeleteCategory(11).messageSl).toContain('11 artiklov')
    expect(canDeleteCategory(14).messageSl).toContain('14 artiklov')
  })

  it('pokvarjeni števec (NaN, negativno, Infinity) → FAIL-SAFE blokada 409', () => {
    // Kontrakta: kadar števila artiklov ni mogoče ugotoviti, kategorija NE
    // sme biti izbrisana (db.count() tovraja >= 0 — ta veja ščiti refaktor).
    const nan = canDeleteCategory(NaN)
    expect(nan.allowed).toBe(false)
    expect(nan.status).toBe(409)
    expect(canDeleteCategory(-3).allowed).toBe(false)
    expect(canDeleteCategory(Infinity).allowed).toBe(false)
    expect(canDeleteCategory(-Infinity).allowed).toBe(false)
    // decimalke se obrežejo: 2.9 → 2 artikla (blokada s pravilno dvojino)
    expect(canDeleteCategory(2.9).allowed).toBe(false)
    expect(canDeleteCategory(2.9).messageSl).toContain('2 artikla')
    // 0.4 → obreže na 0 → prazna → dovoljeno (mejni primer)
    expect(canDeleteCategory(0.4).allowed).toBe(true)
  })

  it('ARTIKEL_FORMS + slCount integracija (enoten vir)', () => {
    expect(slCount(21, ARTIKEL_FORMS)).toBe('21 artikel')
    expect(slPluralWord(22, ARTIKEL_FORMS)).toBe('artikla')
  })
})
