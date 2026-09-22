// ============================================
// P1-16: parsePaginationParams — Unit testi
// Centralna pagination/search validacija za vse API rute
// ============================================
import { describe, it, expect } from 'vitest'
import {
  parsePaginationParams,
  PAGINATION_MAX_LIMIT,
  MAX_SEARCH_LENGTH,
  BULK_MAX_LIMIT,
} from '@/lib/api-utils/pagination'

function sp(params: Record<string, string>): URLSearchParams {
  return new URLSearchParams(params)
}

describe('parsePaginationParams — limit', () => {
  it('brez limit parametra → default 100', () => {
    const { limit } = parsePaginationParams(new URLSearchParams())
    expect(limit).toBe(100)
  })

  it('veljaven limit se ohrani (≤ 100)', () => {
    const { limit } = parsePaginationParams(sp({ limit: '25' }))
    expect(limit).toBe(25)
  })

  it('limit > 100 se clampa na PAGINATION_MAX_LIMIT (100)', () => {
    const { limit } = parsePaginationParams(sp({ limit: '500' }))
    expect(limit).toBe(PAGINATION_MAX_LIMIT)
    expect(limit).toBe(100)
  })

  it('limit = 1000000 (DoS poskus) se clampa na 100', () => {
    const { limit } = parsePaginationParams(sp({ limit: '1000000' }))
    expect(limit).toBe(100)
  })

  it('ne-številčni limit (NaN) → default 100', () => {
    const { limit } = parsePaginationParams(sp({ limit: 'abc' }))
    expect(limit).toBe(100)
  })

  it('negativen limit → default 100', () => {
    const { limit } = parsePaginationParams(sp({ limit: '-5' }))
    expect(limit).toBe(100)
  })

  it('limit = 0 → default 100 (0 zapisov nima smisla)', () => {
    const { limit } = parsePaginationParams(sp({ limit: '0' }))
    expect(limit).toBe(100)
  })

  it('custom defaultLimit se upošteva', () => {
    const { limit } = parsePaginationParams(new URLSearchParams(), { defaultLimit: 50 })
    expect(limit).toBe(50)
  })

  it('custom maxLimit (bulk rute) dovoli do 500', () => {
    const { limit } = parsePaginationParams(sp({ limit: '500' }), { maxLimit: BULK_MAX_LIMIT })
    expect(limit).toBe(500)
  })

  it('maxLimit > BULK_MAX_LIMIT (500) se clampa na 500 (hard cap)', () => {
    // tudi če bi ruta poskusila podati maxLimit: 2000
    const { limit } = parsePaginationParams(sp({ limit: '2000' }), { maxLimit: 2000 })
    expect(limit).toBe(BULK_MAX_LIMIT)
  })

  it('custom defaultLimit > maxLimit: default se clampa', () => {
    // npr. inventory prej default 500, max 2000 — sedaj max 500
    const { limit } = parsePaginationParams(new URLSearchParams(), {
      defaultLimit: 500,
      maxLimit: 500,
    })
    expect(limit).toBe(500)
  })
})

describe('parsePaginationParams — offset', () => {
  it('brez offset → 0', () => {
    const { offset } = parsePaginationParams(new URLSearchParams())
    expect(offset).toBe(0)
  })

  it('veljaven offset se ohrani', () => {
    const { offset } = parsePaginationParams(sp({ offset: '40' }))
    expect(offset).toBe(40)
  })

  it('negativen offset → 0', () => {
    const { offset } = parsePaginationParams(sp({ offset: '-10' }))
    expect(offset).toBe(0)
  })

  it('NaN offset → 0', () => {
    const { offset } = parsePaginationParams(sp({ offset: 'x' }))
    expect(offset).toBe(0)
  })

  it('velik offset ostaja (deep pagination je nadzorovan prek limit)', () => {
    const { offset } = parsePaginationParams(sp({ offset: '10000' }))
    expect(offset).toBe(10000)
  })
})

describe('parsePaginationParams — search (max 100 znakov)', () => {
  it('kratek search se ohrani', () => {
    const { search } = parsePaginationParams(sp({ search: 'Pizza Margherita' }))
    expect(search).toBe('Pizza Margherita')
  })

  it('search daljši od 100 znakov se REŽE na 100', () => {
    const long = 'a'.repeat(500)
    const { search } = parsePaginationParams(sp({ search: long }))
    expect(search.length).toBe(MAX_SEARCH_LENGTH)
    expect(search).toBe('a'.repeat(100))
  })

  it('search točno 100 znakov ostane nespremenjen', () => {
    const exact = 'b'.repeat(100)
    const { search } = parsePaginationParams(sp({ search: exact }))
    expect(search).toBe(exact)
  })

  it('manjkajoč search → prazen niz', () => {
    const { search } = parsePaginationParams(new URLSearchParams())
    expect(search).toBe('')
  })
})

describe('parsePaginationParams — konstante specifikacije', () => {
  it('PAGINATION_MAX_LIMIT = 100 (spec P1-16)', () => {
    expect(PAGINATION_MAX_LIMIT).toBe(100)
  })

  it('MAX_SEARCH_LENGTH = 100 (spec P1-16)', () => {
    expect(MAX_SEARCH_LENGTH).toBe(100)
  })

  it('BULK_MAX_LIMIT = 500 (utemeljene bulk rute)', () => {
    expect(BULK_MAX_LIMIT).toBe(500)
  })
})
