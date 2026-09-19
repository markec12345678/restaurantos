import { describe, it, expect } from 'vitest'
import { canDeleteModifierGroup } from '@/lib/modifier-guard'
import { OPCIJA_FORMS, slCount, slPluralWord } from '@/lib/sl-plural'

// ============================================
// RUNDA 68: canDeleteModifierGroup — zaščita brisanja skupine dodatkov
// Schema: MenuItemModifierGroup.modifierGroup onDelete: Cascade — gol delete
// bi TIHO odstranil vezavo dodatkov z vseh pripetih artiklov (isti vzorec
// tihe izgude kot kategorije R66 / meniji R67).
// Kontrakt: FAIL-SAFE (NaN/Infinity/negativno → BLOKADA), 0 → dovoljeno,
// N > 0 → 409 s slovenskim sporočilom in pravilno sklanjatvijo.
// ============================================

describe('canDeleteModifierGroup', () => {
  it('pripeta artikli → BLOKADA 409 s števcem in nasvetom', () => {
    const d = canDeleteModifierGroup(12)
    expect(d.allowed).toBe(false)
    expect(d.status).toBe(409)
    expect(d.messageSl).toContain('12 artiklov')
    expect(d.messageSl).toContain('odveži')
  })

  it('1 pripet artikel → pravilna EDNINA', () => {
    const d = canDeleteModifierGroup(1)
    expect(d.allowed).toBe(false)
    expect(d.messageSl).toContain('1 artikel')
  })

  it('2 pripeta artikla → pravilna DVOJINA', () => {
    const d = canDeleteModifierGroup(2)
    expect(d.messageSl).toContain('2 artikla')
  })

  it('nepripeta skupina (0) → dovoljeno', () => {
    const d = canDeleteModifierGroup(0)
    expect(d.allowed).toBe(true)
    expect(d.status).toBe(200)
    expect(d.messageSl).toContain('ni pripeta')
  })

  it('FAIL-SAFE: NaN → BLOKADA (ne zaupamo pokvarjenemu števcu)', () => {
    const d = canDeleteModifierGroup(NaN)
    expect(d.allowed).toBe(false)
    expect(d.status).toBe(409)
    expect(d.messageSl).toContain('blokirano')
  })

  it('FAIL-SAFE: negativno število → BLOKADA', () => {
    expect(canDeleteModifierGroup(-3).allowed).toBe(false)
  })

  it('FAIL-SAFE: Infinity → BLOKADA', () => {
    expect(canDeleteModifierGroup(Infinity).allowed).toBe(false)
  })

  it('necelen števec se varno obreže (12.7 ≈ 12 artiklov → blokada)', () => {
    const d = canDeleteModifierGroup(12.7)
    expect(d.allowed).toBe(false)
    expect(d.messageSl).toContain('12 artiklov')
  })
})

describe('OPCIJA_FORMS (RUNDA 68)', () => {
  it('prave sklanjatve: 1 opcija · 2 opciji · 3 opcije · 5 opcij', () => {
    expect(slCount(1, OPCIJA_FORMS)).toBe('1 opcija')
    expect(slCount(2, OPCIJA_FORMS)).toBe('2 opciji')
    expect(slCount(3, OPCIJA_FORMS)).toBe('3 opcije')
    expect(slCount(5, OPCIJA_FORMS)).toBe('5 opcij')
  })

  it('sklop 11–14 vedno rodilnik množine', () => {
    expect(slPluralWord(11, OPCIJA_FORMS)).toBe('opcij')
    expect(slPluralWord(14, OPCIJA_FORMS)).toBe('opcij')
    expect(slCount(21, OPCIJA_FORMS)).toBe('21 opcija')
  })
})
