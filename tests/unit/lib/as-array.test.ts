import { describe, expect, it } from 'vitest'
import { asArray } from '@/lib/as-array'

// R71: QA-vojen fix — produkcija crash "(m || []).map is not a function"
// (POS:configuration 2026-09-19). `(x || [])` ne ščiti pred truthy non-array
// (objekt `{ priceGroups: [...] }` — R69 Happy Hour crash, paginiran
// odgovor, string). asArray preveri Array.isArray, ne samo falseness.

describe('asArray', () => {
  it('veljaven array pade skozi (ista referenca semantika — vsebina ohranjena)', () => {
    const input = [1, 2, 3]
    expect(asArray(input)).toEqual([1, 2, 3])
  })

  it('prazen array ostane prazen array', () => {
    expect(asArray([])).toEqual([])
  })

  it('truthy OBJEKT (R69 crash vzorec!) → prazen array', () => {
    // API je vrnil { priceGroups: [...] } kjer je koda pričakovala [...]
    expect(asArray({ priceGroups: [1] })).toEqual([])
    expect(asArray({ data: [], total: 5 })).toEqual([])
  })

  it('string (truthy non-array) → prazen array', () => {
    expect(asArray('abc')).toEqual([])
    expect(asArray('')).toEqual([])
  })

  it('null / undefined / NaN → prazen array', () => {
    expect(asArray(null)).toEqual([])
    expect(asArray(undefined)).toEqual([])
    expect(asArray(NaN)).toEqual([])
  })

  it('številka / boolean → prazen array', () => {
    expect(asArray(42)).toEqual([])
    expect(asArray(true)).toEqual([])
  })

  it('generik ohrani tip za TS (runtime obnašanje enako)', () => {
    const rows = [{ name: 'Kava' }, { name: 'Sok' }]
    expect(asArray<{ name: string }>(rows).map(r => r.name)).toEqual(['Kava', 'Sok'])
  })
})
