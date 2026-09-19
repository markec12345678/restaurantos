import { describe, it, expect } from 'vitest'
import { dedupeIds, attachmentScopeDecision } from '@/lib/modifier-attach'
import { createModifierGroupSchema, updateModifierGroupSchema } from '@/lib/validations'

// ============================================
// RUNDA 70: vezave dodatkov — čisti kontrakti (dedupeIds + attachmentScopeDecision)
// Kontrakti so fail-safe: ne-veljavni vnosi NIKOLI odobrijo vezavo.
// ============================================

describe('dedupeIds', () => {
  it('ohrani vrstni red prve pojavitve in odstrani duplikate', () => {
    expect(dedupeIds(['b', 'a', 'b', 'c', 'a'])).toEqual(['b', 'a', 'c'])
  })

  it('odstrani prazne nize in whitespace', () => {
    expect(dedupeIds(['a', '', '   ', 'b'])).toEqual(['a', 'b'])
  })

  it('odstrani ne-nizovne vnose (števila, objekti, null)', () => {
    expect(dedupeIds(['a', 42 as unknown as string, null, { x: 1 } as unknown as string, 'a'])).toEqual(['a'])
  })

  it('ne-arrays vrača prazno polje (fail-safe)', () => {
    expect(dedupeIds(undefined)).toEqual([])
    expect(dedupeIds(null)).toEqual([])
    expect(dedupeIds('abc' as unknown as string[])).toEqual([])
    expect(dedupeIds(123 as unknown as string[])).toEqual([])
  })

  it('prazno polje → prazno polje', () => {
    expect(dedupeIds([])).toEqual([])
  })

  it('en sam id ostane enak', () => {
    expect(dedupeIds(['cmx123'])).toEqual(['cmx123'])
  })
})

describe('attachmentScopeDecision', () => {
  it('dovoljeno ko se števili ujemata (0 = prazna vezava)', () => {
    const d = attachmentScopeDecision(0, 0)
    expect(d.allowed).toBe(true)
    expect(d.status).toBe(200)
  })

  it('dovoljeno ko se števili ujemata (3 == 3)', () => {
    const d = attachmentScopeDecision(3, 3)
    expect(d.allowed).toBe(true)
    expect(d.status).toBe(200)
  })

  it('zavrnjeno ko je najdenih manj kot zahtevanih (tuja lokacija / neobstoječ id)', () => {
    const d = attachmentScopeDecision(3, 2)
    expect(d.allowed).toBe(false)
    expect(d.status).toBe(404)
    expect(d.messageSl).toContain('ne pripadajo tej lokaciji')
  })

  it('zavrnjeno ko je najdenih več kot zahtevanih (neveljavna kombinacija)', () => {
    const d = attachmentScopeDecision(1, 5)
    expect(d.allowed).toBe(false)
    expect(d.status).toBe(404)
  })

  it('fail-safe: NaN → blokada 400', () => {
    expect(attachmentScopeDecision(NaN, 0).allowed).toBe(false)
    expect(attachmentScopeDecision(NaN, 0).status).toBe(400)
    expect(attachmentScopeDecision(0, NaN).allowed).toBe(false)
  })

  it('fail-safe: Infinity → blokada 400', () => {
    expect(attachmentScopeDecision(Infinity, 0).allowed).toBe(false)
    expect(attachmentScopeDecision(0, -Infinity).allowed).toBe(false)
  })

  it('fail-safe: negativne vrednosti → blokada 400', () => {
    expect(attachmentScopeDecision(-1, 0).allowed).toBe(false)
    expect(attachmentScopeDecision(0, -1).allowed).toBe(false)
  })

  it('fail-safe: necelovrednostne vrednosti → blokada 400', () => {
    expect(attachmentScopeDecision(1.5, 1.5).allowed).toBe(false)
  })
})

describe('modifier-group schemas menuItemIds (RUNDA 70: group-side attach)', () => {
  const baseGroup = {
    name: 'Priloge',
    required: false,
    minSelect: 0,
    modifiers: [{ name: 'Pomfrit', price: 2.5, sortOrder: 0 }],
  }

  it('createModifierGroupSchema sprejme menuItemIds', () => {
    const parsed = createModifierGroupSchema.parse({ ...baseGroup, menuItemIds: ['cmx1', 'cmx2'] })
    expect(parsed.menuItemIds).toEqual(['cmx1', 'cmx2'])
  })

  it('createModifierGroupSchema: menuItemIds opcijsko (privzeto ni)', () => {
    const parsed = createModifierGroupSchema.parse(baseGroup)
    expect(parsed.menuItemIds).toBeUndefined()
  })

  it('updateModifierGroupSchema sprejme prazno menuItemIds (odstrani vse vezave)', () => {
    const parsed = updateModifierGroupSchema.parse({ name: 'Priloge', menuItemIds: [] })
    expect(parsed.menuItemIds).toEqual([])
  })

  it('menuItemIds nad 200 zavrnjena (max 200 — varnostna meja payloada)', () => {
    const many = Array.from({ length: 201 }, (_, i) => `id-${i}`)
    const result = createModifierGroupSchema.safeParse({ ...baseGroup, menuItemIds: many })
    expect(result.success).toBe(false)
  })
})
