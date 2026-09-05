// ============================================
// ISSUE #31 — Multi-tenant Accounting Tests
//
// Testiramo da accounting poročila podpirajo `locationId` filter.
// Mock Prisma client ker ne rabimo pravega DB-ja za unit teste.
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock @/lib/db preden importamo generator — vi.hoisted zaradi vitest hoisting-a
const { mockJournalLineFindMany, mockJournalEntryFindMany, mockStockTransactionAggregate } = vi.hoisted(() => ({
  mockJournalLineFindMany: vi.fn(),
  mockJournalEntryFindMany: vi.fn(),
  mockStockTransactionAggregate: vi.fn().mockResolvedValue({ _sum: { totalCost: 0 } }),
}))

vi.mock('@/lib/db', () => ({
  db: {
    journalLine: { findMany: mockJournalLineFindMany },
    journalEntry: { findMany: mockJournalEntryFindMany },
    stockTransaction: { aggregate: mockStockTransactionAggregate },
  },
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}))

// Mock logger da preprečimo console noise
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

// Mock @/lib/decimal
vi.mock('@/lib/decimal', () => ({
  toNum: (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0),
  deepToNumbers: <T>(v: T): T => v,
}))

import {
  generateTrialBalance,
  generateProfitLoss,
  generateBalanceSheet,
  generateGeneralLedger,
} from '@/lib/accounting/journal-generator'

describe('Issue #31 — Multi-tenant Accounting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generateTrialBalance — locationId filter', () => {
    it('brez locationId: ne filtrira po lokaciji', async () => {
      mockJournalLineFindMany.mockResolvedValue([])
      await generateTrialBalance(new Date('2026-01-01'), new Date('2026-12-31'))

      const callArg = mockJournalLineFindMany.mock.calls[0][0]
      expect(callArg.where.journalEntry.status).toBe('posted')
      expect(callArg.where.journalEntry.date).toBeDefined()
      expect(callArg.where.journalEntry.locationId).toBeUndefined()
    })

    it('z locationId: filtrira po specifični lokaciji', async () => {
      mockJournalLineFindMany.mockResolvedValue([])
      await generateTrialBalance(
        new Date('2026-01-01'),
        new Date('2026-12-31'),
        'location-123',
      )

      const callArg = mockJournalLineFindMany.mock.calls[0][0]
      expect(callArg.where.journalEntry.locationId).toBe('location-123')
    })

    it('z undefined locationId: enako kot brez filtra', async () => {
      mockJournalLineFindMany.mockResolvedValue([])
      await generateTrialBalance(undefined, undefined, undefined)

      const callArg = mockJournalLineFindMany.mock.calls[0][0]
      expect(callArg.where.journalEntry.locationId).toBeUndefined()
    })
  })

  describe('generateProfitLoss — locationId filter', () => {
    it('filtrira po lokaciji', async () => {
      mockJournalLineFindMany.mockResolvedValue([])
      await generateProfitLoss(
        new Date('2026-01-01'),
        new Date('2026-12-31'),
        'loc-abc',
      )

      const callArg = mockJournalLineFindMany.mock.calls[0][0]
      expect(callArg.where.journalEntry.locationId).toBe('loc-abc')
    })
  })

  describe('generateBalanceSheet — locationId filter', () => {
    it('filtrira po lokaciji', async () => {
      mockJournalLineFindMany.mockResolvedValue([])
      await generateBalanceSheet(new Date('2026-12-31'), 'loc-balance')

      const callArg = mockJournalLineFindMany.mock.calls[0][0]
      expect(callArg.where.journalEntry.locationId).toBe('loc-balance')
    })
  })

  describe('generateGeneralLedger — locationId filter', () => {
    it('filtrira po lokaciji', async () => {
      mockJournalEntryFindMany.mockResolvedValue([])
      await generateGeneralLedger(
        new Date('2026-01-01'),
        new Date('2026-12-31'),
        'loc-gl',
      )

      const callArg = mockJournalEntryFindMany.mock.calls[0][0]
      expect(callArg.where.locationId).toBe('loc-gl')
    })

    it('brez locationId: ne filtrira', async () => {
      mockJournalEntryFindMany.mockResolvedValue([])
      await generateGeneralLedger(undefined, undefined, undefined)

      const callArg = mockJournalEntryFindMany.mock.calls[0][0]
      expect(callArg.where.locationId).toBeUndefined()
    })
  })

  describe('Izolacija med lokacijami', () => {
    it('posamezna lokacija vidi samo svoje vnose (kombinacija datum + location)', async () => {
      mockJournalLineFindMany.mockResolvedValue([])
      await generateTrialBalance(
        new Date('2026-08-01'),
        new Date('2026-08-31'),
        'loc-aug-2026',
      )

      const callArg = mockJournalLineFindMany.mock.calls[0][0]
      expect(callArg.where.journalEntry.date.gte).toEqual(new Date('2026-08-01'))
      expect(callArg.where.journalEntry.date.lte).toEqual(new Date('2026-08-31'))
      expect(callArg.where.journalEntry.locationId).toBe('loc-aug-2026')
      expect(callArg.where.journalEntry.status).toBe('posted')
    })

    it('dve lokaciji imata neodvisne vrednosti (mock simulacija)', async () => {
      // Lokacija A: 1000€ prometa
      mockJournalLineFindMany.mockResolvedValueOnce([
        { accountCode: '7000', accountName: 'Promet', accountType: 'revenue', debit: 0, credit: 1000 },
      ])
      const resultA = await generateTrialBalance(undefined, undefined, 'loc-A')

      // Lokacija B: 500€ prometa
      mockJournalLineFindMany.mockResolvedValueOnce([
        { accountCode: '7000', accountName: 'Promet', accountType: 'revenue', debit: 0, credit: 500 },
      ])
      const resultB = await generateTrialBalance(undefined, undefined, 'loc-B')

      // Vsaka lokacija vidi samo svoje številke
      expect(resultA.totalCredit).toBe(1000)
      expect(resultB.totalCredit).toBe(500)
    })
  })
})
