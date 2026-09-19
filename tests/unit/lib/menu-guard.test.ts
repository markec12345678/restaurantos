import { describe, it, expect } from 'vitest'
import { canDeleteMenu } from '@/lib/menu-guard'
import { MENI_FORMS, slCount } from '@/lib/sl-plural'

// ============================================
// RUNDA 67: canDeleteMenu — zaščita brisanja menija
// Schema: menu → categories (Cascade), menuItems blokirajo FK (RESTRICT).
// Gol delete je bil: artikli → P2003 generični 500; prazne kategorije → tiha kaskada.
// ============================================

describe('canDeleteMenu', () => {
  it('meni z artikli → BLOKADA 409 s števcem kategorij in artiklov', () => {
    const d = canDeleteMenu(5, 37)
    expect(d.allowed).toBe(false)
    expect(d.status).toBe(409)
    expect(d.messageSl).toContain('37 artiklov')
    expect(d.messageSl).toContain('5 kategorij')
    expect(d.messageSl).toContain('najprej premakni')
  })

  it('1 artikel v 1 kategoriji → pravilna ednina obeh', () => {
    const d = canDeleteMenu(1, 1)
    expect(d.messageSl).toContain('1 artikel')
    expect(d.messageSl).toContain('1 kategorija')
  })

  it('2 artikla / 2 kategoriji → DVOJINA (slovnično pravilno)', () => {
    expect(canDeleteMenu(2, 2).messageSl).toContain('2 artikla')
    expect(canDeleteMenu(2, 2).messageSl).toContain('2 kategoriji')
  })

  it('meni s praznimi kategorijami → dovoljeno + OPOMOŽILO o kaskadi', () => {
    const d = canDeleteMenu(3, 0)
    expect(d.allowed).toBe(true)
    expect(d.cascadeWarning).toBe(true)
    expect(d.confirmSl).toContain('3 kategorije')
    expect(d.confirmSl).toContain('prazne kategorije gredo z menijem')
  })

  it('prazen meni → dovoljeno, brez opozorila o kaskadi', () => {
    const d = canDeleteMenu(0, 0)
    expect(d.allowed).toBe(true)
    expect(d.cascadeWarning).toBe(false)
    expect(d.confirmSl).toContain('prazen')
    expect(d.confirmSl).toContain('trajno')
  })

  it('pokvarjeni števci (NaN, negativno, Infinity) → FAIL-SAFE blokada', () => {
    expect(canDeleteMenu(NaN, 0).allowed).toBe(false)
    expect(canDeleteMenu(0, NaN).allowed).toBe(false)
    expect(canDeleteMenu(-1, 0).allowed).toBe(false)
    expect(canDeleteMenu(0, -5).allowed).toBe(false)
    expect(canDeleteMenu(Infinity, 0).allowed).toBe(false)
    // decimalke obrezane: 2.9 kategorij → 2
    expect(canDeleteMenu(2.9, 0).confirmSl).toContain('2 kategoriji')
  })

  it('mejne kombinacije: veliko kategorij brez artiklov ostane dovoljeno', () => {
    const d = canDeleteMenu(100, 0)
    expect(d.allowed).toBe(true)
    expect(d.confirmSl).toContain('100 kategorij')
  })

  it('MENI_FORMS + slCount integracija (enoten vir)', () => {
    expect(slCount(1, MENI_FORMS)).toBe('1 meni')
    expect(slCount(2, MENI_FORMS)).toBe('2 menija')
    expect(slCount(5, MENI_FORMS)).toBe('5 menijev')
  })
})
