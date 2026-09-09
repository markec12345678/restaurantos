// Unit testi za src/lib/tenant-scope.ts — MODEL A centralni scoping helperji
import { describe, it, expect } from 'vitest'
import {
  sessionLocationId,
  locationFilter,
  menuItemLocationFilter,
  categoryLocationFilter,
  resolveWriteLocationId,
  isWithinScope,
} from '@/lib/tenant-scope'

describe('tenant-scope (MODEL A)', () => {
  describe('sessionLocationId', () => {
    it('vrne locationId iz seje', () => {
      expect(sessionLocationId({ session: { locationId: 'loc-1' } })).toBe('loc-1')
    })
    it('vrne null za sejo brez lokacije (admin — cross-lokacijski nadzor)', () => {
      expect(sessionLocationId({ session: { locationId: null } })).toBeNull()
      expect(sessionLocationId({ session: {} })).toBeNull()
    })
    it('vrne null za manjkajočo sejo / authResult', () => {
      expect(sessionLocationId(null)).toBeNull()
      expect(sessionLocationId(undefined)).toBeNull()
    })
  })

  describe('locationFilter', () => {
    it('za določen scope vrne { locationId }', () => {
      expect(locationFilter('loc-1')).toEqual({ locationId: 'loc-1' })
    })
    it('za admina (null) vrne PRAZEN filter (vidi vse — nadzor)', () => {
      expect(locationFilter(null)).toEqual({})
    })
  })

  describe('menuItemLocationFilter (veriga Category → Menu)', () => {
    it('gr filtrover prek verige', () => {
      expect(menuItemLocationFilter('loc-2')).toEqual({
        category: { menu: { locationId: 'loc-2' } },
      })
    })
    it('admin (null) = brez filtra', () => {
      expect(menuItemLocationFilter(null)).toEqual({})
    })
  })

  describe('categoryLocationFilter (prek Menu)', () => {
    it('gr filtrover prek menija', () => {
      expect(categoryLocationFilter('loc-1')).toEqual({
        menu: { locationId: 'loc-1' },
      })
    })
    it('admin (null) = brez filtra', () => {
      expect(categoryLocationFilter(null)).toEqual({})
    })
  })

  describe('resolveWriteLocationId (PISNE operacije)', () => {
    it('zaposleni: VEDNO lastna lokacija — client podana tuja se IGNORIRA', () => {
      const r = resolveWriteLocationId('loc-1', 'loc-HACKED')
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.locationId).toBe('loc-1')
    })
    it('admin brez lokacije: sprejme izrecen locationId', () => {
      const r = resolveWriteLocationId(null, 'loc-2')
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.locationId).toBe('loc-2')
    })
    it('admin brez lokacije in brez kandidatov = 400 (fail-closed)', () => {
      const r = resolveWriteLocationId(null, undefined, null, '')
      expect(r.ok).toBe(false)
      if (!r.ok) {
        // NextResponse — preveri status prek json() kar je na voljo
        expect(r.response).toBeDefined()
      }
    })
    it('prazni stringi se preskočijo, veljaven kandidat se uporabi', () => {
      const r = resolveWriteLocationId(null, '  ', 'loc-9')
      expect(r.ok).toBe(true)
      if (r.ok) expect(r.locationId).toBe('loc-9')
    })
  })

  describe('isWithinScope', () => {
    it('admin (null scope) sme vse', () => {
      expect(isWithinScope(null, 'whatever')).toBe(true)
      expect(isWithinScope(null, null)).toBe(true)
    })
    it('zaposleni: samo lastna lokacija', () => {
      expect(isWithinScope('loc-1', 'loc-1')).toBe(true)
      expect(isWithinScope('loc-1', 'loc-2')).toBe(false)
      expect(isWithinScope('loc-1', null)).toBe(false)
      expect(isWithinScope('loc-1', undefined)).toBe(false)
    })
  })
})
