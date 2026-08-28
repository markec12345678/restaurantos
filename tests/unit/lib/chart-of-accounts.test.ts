// ============================================
// CHART OF ACCOUNTS — Unit testi (Issue #38)
//
// Preverjamo:
// - validateAccountCode: preveri ali koda obstaja v ChartOfAccount
// - lookupAccount: vrne denormalizirana polja (name, type)
// - resolveAccountCode: vrne pripravljena polja za JournalLine (FK + denorm)
// - validateAccountCodes: bulk validacija
// - Legacy mode: če koda ne obstaja, isValid=false in chartOfAccountCode=null
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const mockFindUnique = vi.fn()
  const mockFindMany = vi.fn()
  return { mockFindUnique, mockFindMany }
})

vi.mock('@/lib/db', () => ({
  db: {
    chartOfAccount: {
      findUnique: mocks.mockFindUnique,
      findMany: mocks.mockFindMany,
    },
  },
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}))

import {
  validateAccountCode,
  lookupAccount,
  resolveAccountCode,
  validateAccountCodes,
} from '@/lib/accounting/chart-of-accounts'

describe('validateAccountCode — Issue #38', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('vrne true če koda obstaja v ChartOfAccount', async () => {
    mocks.mockFindUnique.mockResolvedValue({ code: '7000' })
    const result = await validateAccountCode('7000')
    expect(result).toBe(true)
    expect(mocks.mockFindUnique).toHaveBeenCalledWith({
      where: { code: '7000' },
      select: { code: true },
    })
  })

  it('vrne false če koda ne obstaja', async () => {
    mocks.mockFindUnique.mockResolvedValue(null)
    const result = await validateAccountCode('NEOBSTOJECA')
    expect(result).toBe(false)
  })
})

describe('lookupAccount — Issue #38', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('vrne account če obstaja', async () => {
    mocks.mockFindUnique.mockResolvedValue({
      code: '7000',
      name: 'Promet — na mestu',
      accountType: 'revenue',
      isActive: true,
    })

    const result = await lookupAccount('7000')
    expect(result).toEqual({
      code: '7000',
      name: 'Promet — na mestu',
      accountType: 'revenue',
      isActive: true,
    })
  })

  it('vrne null če koda ne obstaja', async () => {
    mocks.mockFindUnique.mockResolvedValue(null)
    const result = await lookupAccount('INVALID')
    expect(result).toBeNull()
  })
})

describe('resolveAccountCode — Issue #38', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('veljavna koda: chartOfAccountCode nastavljen, isValid=true', async () => {
    mocks.mockFindUnique.mockResolvedValue({
      code: '7000',
      name: 'Promet — na mestu',
      accountType: 'revenue',
      isActive: true,
    })

    const result = await resolveAccountCode('7000')

    expect(result).toEqual({
      accountCode: '7000',
      chartOfAccountCode: '7000',
      accountName: 'Promet — na mestu',
      accountType: 'revenue',
      isValid: true,
    })
  })

  it('neveljavna koda: chartOfAccountCode=null (legacy mode), isValid=false', async () => {
    mocks.mockFindUnique.mockResolvedValue(null)

    const result = await resolveAccountCode('NEOZNANA_KODA')

    expect(result).toEqual({
      accountCode: 'NEOZNANA_KODA',
      chartOfAccountCode: null,
      accountName: 'NEOZNANA_KODA', // placeholder
      accountType: 'unknown',
      isValid: false,
    })
  })

  it('neveljavna koda ohrani originalno kodo v accountCode (backward compat)', async () => {
    mocks.mockFindUnique.mockResolvedValue(null)
    const result = await resolveAccountCode('CUSTOM_CODE')
    expect(result.accountCode).toBe('CUSTOM_CODE')
  })
})

describe('validateAccountCodes — bulk validacija', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('prazna tabela → prazna rezultata', async () => {
    const result = await validateAccountCodes([])
    expect(result).toEqual({ valid: [], invalid: [] })
    expect(mocks.mockFindMany).not.toHaveBeenCalled()
  })

  it('loči veljavne od neveljavnih', async () => {
    mocks.mockFindMany.mockResolvedValue([
      { code: '7000' },
      { code: '2600' },
    ])

    const result = await validateAccountCodes(['7000', '2600', 'INVALID', '7000'])

    expect(result.valid).toEqual(['7000', '2600'])
    expect(result.invalid).toEqual(['INVALID'])
    // Edinstvene kode — 7000 se ne podvoji v poizvedbi
    expect(mocks.mockFindMany).toHaveBeenCalledWith({
      where: { code: { in: ['7000', '2600', 'INVALID'] } },
      select: { code: true },
    })
  })

  it('vse veljavne', async () => {
    mocks.mockFindMany.mockResolvedValue([
      { code: '7000' },
      { code: '7010' },
    ])
    const result = await validateAccountCodes(['7000', '7010'])
    expect(result.valid.sort()).toEqual(['7000', '7010'])
    expect(result.invalid).toEqual([])
  })

  it('vse neveljavne', async () => {
    mocks.mockFindMany.mockResolvedValue([])
    const result = await validateAccountCodes(['A', 'B', 'C'])
    expect(result.valid).toEqual([])
    expect(result.invalid.sort()).toEqual(['A', 'B', 'C'])
  })

  it('deduplicira input kode', async () => {
    mocks.mockFindMany.mockResolvedValue([{ code: '7000' }])
    const result = await validateAccountCodes(['7000', '7000', '7000'])
    expect(result.valid).toEqual(['7000'])
    expect(result.invalid).toEqual([])
  })
})
