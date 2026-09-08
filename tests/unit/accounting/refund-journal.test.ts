// ============================================
// P1-18: generateJournalForRefund — Unit testi
// Refund + accounting reversal v ISTI transakciji + idempotenca
// ============================================
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock @/lib/db — journal-generator importa db za generateJournalForPayment;
// refund funkcija dobi tx eksplicitno (ISTI transakcijski klient kot refund)
const { mockResolveAccountCode, mockDbJournalEntry, mockDbPaymentFindUnique } = vi.hoisted(() => ({
  mockResolveAccountCode: vi.fn().mockImplementation(async (code: string) => ({
    accountCode: code,
    chartOfAccountCode: code,
    accountName: `Konto ${code}`,
    accountType: 'revenue',
    isValid: true,
  })),
  mockDbJournalEntry: {
    count: vi.fn().mockResolvedValue(0),
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: 'je-new', lines: [] }),
  },
  mockDbPaymentFindUnique: vi.fn().mockResolvedValue({
    id: 'pay-2',
    amount: 50,
    tipAmount: 0,
    type: 'cash',
    check: { order: { id: 'o1', orderNumber: 7, type: 'dine-in', customerName: 'G', locationId: 'loc-2' } },
  }),
}))

vi.mock('@/lib/db', () => ({
  db: {
    journalEntry: mockDbJournalEntry,
    payment: { findUnique: mockDbPaymentFindUnique },
  },
}))

vi.mock('@/lib/accounting/chart-of-accounts', () => ({
  resolveAccountCode: mockResolveAccountCode,
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/lib/decimal', () => ({
  toNum: (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0),
}))

// import PO mockih!
import { generateJournalForRefund, generateJournalForPayment } from '@/lib/accounting/journal-generator'

// Lažni Prisma tx klient — beleži klice
function createMockTx() {
  const calls = {
    journalEntryFindFirst: [] as Array<Record<string, unknown>>,
    journalEntryCount: 0,
    journalEntryCreate: [] as Array<Record<string, unknown>>,
  }
  const tx = {
    journalEntry: {
      findFirst: vi.fn().mockImplementation(async (args: Record<string, unknown>) => {
        calls.journalEntryFindFirst.push(args)
        return null // privzeto: obstoječi vnos NI najden
      }),
      count: vi.fn().mockImplementation(async () => {
        calls.journalEntryCount++
        return 3
      }),
      create: vi.fn().mockImplementation(async (args: Record<string, unknown>) => {
        calls.journalEntryCreate.push(args)
        return {
          id: `je-new-${calls.journalEntryCreate.length}`,
          ...((args.data as Record<string, unknown>) ?? {}),
          lines: [],
        }
      }),
    },
  }
  return { tx, calls }
}

const baseInput = {
  paymentId: 'pay-1',
  refundAmount: 10,
  cumulativeRefundAmount: 10,
  tipPortion: 0,
  orderType: 'dine-in',
  orderNumber: 42,
  customerName: 'Test Gost',
  paymentType: 'cash',
  locationId: 'loc-1',
  employeeId: 'emp-1',
  reason: 'Test vračilo',
}

describe('generateJournalForRefund — P1-18', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ustvari reversal vnos (referenceType refund, source auto-refund, posted)', async () => {
    const { tx, calls } = createMockTx()
    const id = await generateJournalForRefund(tx as never, baseInput)

    expect(id).toBeTruthy()
    expect(calls.journalEntryCreate.length).toBe(1)

    const createArgs = calls.journalEntryCreate[0] as {
      data: Record<string, unknown>
    }
    expect(createArgs.data.referenceType).toBe('refund')
    expect(createArgs.data.source).toBe('auto-refund')
    expect(createArgs.data.status).toBe('posted')
    expect(createArgs.data.reference).toBe('refund:pay-1:10.00')
    expect(createArgs.data.locationId).toBe('loc-1')
    expect(createArgs.data.postedBy).toBe('emp-1')
  })

  it('double-entry reverza: debet promet, kredit blagajna (za cash)', async () => {
    const { tx, calls } = createMockTx()
    await generateJournalForRefund(tx as never, baseInput)

    const createArgs = calls.journalEntryCreate[0] as {
      data: { lines: { create: Array<Record<string, unknown>> } }
    }
    const lines = createArgs.data.lines.create

    // Reverza vračila 10 EUR (brez napitnine): 2 vrstici
    expect(lines.length).toBe(2)

    const salesLine = lines.find(l => String(l.description).includes('Reverza prometa'))
    const paymentLine = lines.find(l => String(l.description).includes('Izplačilo vračila'))
    expect(salesLine).toBeDefined()
    expect(paymentLine).toBeDefined()

    // Debet promet (razveljavitev prihodka)
    expect(salesLine!.debit).toBe(10)
    expect(salesLine!.credit).toBe(0)
    // Kredit blagajna (izplačilo)
    expect(paymentLine!.debit).toBe(0)
    expect(paymentLine!.credit).toBe(10)
  })

  it('z napitnino: 3 vrstice (promet + napitnina + blagajna)', async () => {
    const { tx, calls } = createMockTx()
    await generateJournalForRefund(tx as never, {
      ...baseInput,
      refundAmount: 12,
      tipPortion: 2,
      cumulativeRefundAmount: 12,
    })

    const createArgs = calls.journalEntryCreate[0] as {
      data: { lines: { create: Array<Record<string, unknown>> } }
    }
    const lines = createArgs.data.lines.create
    expect(lines.length).toBe(3)

    const tipLine = lines.find(l => String(l.description).includes('Reverza napitnine'))
    expect(tipLine).toBeDefined()
    expect(tipLine!.debit).toBe(2)
    expect(tipLine!.credit).toBe(0)
  })

  it('IDEMPOTENTEN: obstoječi vnos z isto referenco → preskoči create, vrne obstoječi ID', async () => {
    const { tx, calls } = createMockTx()
    tx.journalEntry.findFirst.mockResolvedValueOnce({ id: 'je-existing-1' })

    const id = await generateJournalForRefund(tx as never, baseInput)

    expect(id).toBe('je-existing-1')
    // create NI bil klican
    expect(calls.journalEntryCreate.length).toBe(0)
  })

  it('različna kumulativa = različna referenca (2 refunda po 5 EUR)', async () => {
    const { tx, calls } = createMockTx()
    await generateJournalForRefund(tx as never, { ...baseInput, refundAmount: 5, cumulativeRefundAmount: 5 })
    await generateJournalForRefund(tx as never, { ...baseInput, refundAmount: 5, cumulativeRefundAmount: 10 })

    expect(calls.journalEntryCreate.length).toBe(2)
    const ref1 = (calls.journalEntryCreate[0] as { data: { reference: string } }).data.reference
    const ref2 = (calls.journalEntryCreate[1] as { data: { reference: string } }).data.reference
    expect(ref1).toBe('refund:pay-1:5.00')
    expect(ref2).toBe('refund:pay-1:10.00')
  })

  it('napaka create-a NE vrže — vrne null (refund denarja je prioriteta)', async () => {
    const { tx } = createMockTx()
    tx.journalEntry.create.mockRejectedValueOnce(new Error('DB constraint'))

    const id = await generateJournalForRefund(tx as never, baseInput)
    expect(id).toBeNull()
  })

  it('orderType dostava → konto 7020 (SALES_DELIVERY)', async () => {
    const { tx } = createMockTx()
    await generateJournalForRefund(tx as never, { ...baseInput, orderType: 'delivery' })

    // resolveAccountCode je bil klican s prometnim kontom dostave
    const calledCodes = mockResolveAccountCode.mock.calls.map(c => c[0])
    expect(calledCodes).toContain('7020')
  })

  it('card plačilo → konto 1000 (BANK), ne 1010', async () => {
    const { tx } = createMockTx()
    await generateJournalForRefund(tx as never, { ...baseInput, paymentType: 'card' })

    const calledCodes = mockResolveAccountCode.mock.calls.map(c => c[0])
    expect(calledCodes).toContain('1000')
    expect(calledCodes).not.toContain('1010')
  })
})

describe('generateJournalForPayment — idempotenca (P1-18)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDbPaymentFindUnique.mockResolvedValue({
      id: 'pay-2',
      amount: 50,
      tipAmount: 0,
      type: 'cash',
      check: { order: { id: 'o1', orderNumber: 7, type: 'dine-in', customerName: 'G', locationId: 'loc-2' } },
    })
  })

  it('obstoječi vnos z reference=paymentId → vrne obstoječi ID brez create', async () => {
    mockDbJournalEntry.findFirst.mockResolvedValueOnce({ id: 'je-existing-99' })

    const id = await generateJournalForPayment('o1', 'pay-2', 'emp-2')

    expect(id).toBe('je-existing-99')
    expect(mockDbJournalEntry.create).not.toHaveBeenCalled()
  })
})
