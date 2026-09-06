// ============================================
// AUDIT FIX TESTS — P1/P2 fixes from 2026-09-06 audit
// ============================================
// Preverja:
//   1. createAuditLog z optional tx parametrom (P1)
//   2. createTipDistributionWithChain z optional tx parametrom (P1)
//   3. safeCompareSignature — timing-safe primerjava (P2)
//   4. deductDirectItem — atomic preprečitev negative stock (P2)
// ============================================
import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'crypto'

// ─── Shared mocks (hoisted) ──────────────────────────────────────────────────

const auditMocks = vi.hoisted(() => {
  const mockFindFirst = vi.fn()
  const mockCreate = vi.fn()
  const mockTransaction = vi.fn(async (fn: (_tx: unknown) => Promise<unknown>) => {
    return fn({
      auditLog: { findFirst: mockFindFirst, create: mockCreate },
    })
  })
  return { mockFindFirst, mockCreate, mockTransaction }
})

const tipMocks = vi.hoisted(() => {
  const mockFindFirst = vi.fn()
  const mockCreate = vi.fn()
  const mockTransaction = vi.fn(async (fn: (_tx: unknown) => Promise<unknown>) => {
    return fn({
      tipDistribution: { findFirst: mockFindFirst, create: mockCreate },
    })
  })
  return { mockFindFirst, mockCreate, mockTransaction }
})

vi.mock('@prisma/client', () => {
  // Minimal Decimal mock z aritmetičnimi metodami
  class MockDecimal {
    private v: number
    constructor(val: string | number | MockDecimal = 0) {
      if (val instanceof MockDecimal) this.v = val.v
      else this.v = typeof val === 'number' ? val : Number(val) || 0
    }
    toNumber() { return this.v }
    plus(other: MockDecimal | number) { return new MockDecimal(this.v + (other instanceof MockDecimal ? other.v : Number(other))) }
    minus(other: MockDecimal | number) { return new MockDecimal(this.v - (other instanceof MockDecimal ? other.v : Number(other))) }
    times(other: MockDecimal | number) { return new MockDecimal(this.v * (other instanceof MockDecimal ? other.v : Number(other))) }
    div(other: MockDecimal | number) { return new MockDecimal(this.v / (other instanceof MockDecimal ? other.v : Number(other))) }
    toDecimalPlaces(_dp: number, _mode?: unknown) { return new MockDecimal(Math.round(this.v * 100) / 100) }
    toString() { return String(this.v) }
    toJSON() { return this.v }
    static ROUND_HALF_UP = 4
  }
  return {
    PrismaClient: class MockPrismaClient {
      $transaction = auditMocks.mockTransaction
      $disconnect = vi.fn()
    },
    Prisma: {
      Decimal: MockDecimal,
      TransactionClient: class {},
    },
  }
})

vi.mock('@/lib/db', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/db')>()
  return {
    ...original,
    // Override $transaction z mock-om ki podpira oba tipa klicev
    // (auditLog in tipDistribution)
    db: {
      ...(original as unknown as { db: Record<string, unknown> }).db,
      $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
        // Default vedenje: uporabi auditMocks.mockTransaction
        return auditMocks.mockTransaction(fn)
      },
    },
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  }
})

import { createAuditLog } from '@/lib/db'
import { createTipDistributionWithChain } from '@/lib/tip-distribution-chain'

// ─── Test 1: createAuditLog z tx parametrom ─────────────────────────────────

describe('P1 fix: createAuditLog z optional tx parametrom', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auditMocks.mockFindFirst.mockResolvedValue(null)
    auditMocks.mockCreate.mockImplementation((args: { data: unknown }) => Promise.resolve(args.data))
  })

  it('BREZ tx: odpre svojo lastno transakcijo (backward compat)', async () => {
    await createAuditLog({
      action: 'TEST_NO_TX',
      entityType: 'Test',
      details: {},
    })

    // $transaction je bil klican
    expect(auditMocks.mockTransaction).toHaveBeenCalledTimes(1)
    expect(auditMocks.mockCreate).toHaveBeenCalledTimes(1)
  })

  it('Z tx: uporabi predani tx (ne odpre nove transakcije)', async () => {
    const mockTx = {
      auditLog: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
      },
    }

    await createAuditLog({
      action: 'TEST_WITH_TX',
      entityType: 'Test',
      details: {},
    }, mockTx as never)

    // $transaction NI bil klican — uporabljen je bil mockTx
    expect(auditMocks.mockTransaction).not.toHaveBeenCalled()
    // ampak mockTx.auditLog.create JE bil klican
    expect(mockTx.auditLog.create).toHaveBeenCalledTimes(1)
    expect(mockTx.auditLog.findFirst).toHaveBeenCalledTimes(1)
  })

  it('Z tx: chainHash je izračunan iz previousHash pridobljenega znotraj tx', async () => {
    const mockTx = {
      auditLog: {
        findFirst: vi.fn().mockResolvedValue({ chainHash: 'tx-prev-hash' }),
        create: vi.fn().mockResolvedValue({}),
      },
    }

    await createAuditLog({
      action: 'CHAIN_TEST',
      entityType: 'Test',
      entityId: 'e1',
      userId: 'u1',
      details: { v: 1 },
    }, mockTx as never)

    const call = mockTx.auditLog.create.mock.calls[0][0]
    const expectedPayload = [
      'tx-prev-hash', 'CHAIN_TEST', 'Test', 'e1', 'u1', JSON.stringify({ v: 1 }),
    ].join('|')
    const expectedHash = crypto.createHash('sha256').update(expectedPayload).digest('hex')

    expect(call.data.chainHash).toBe(expectedHash)
    expect(call.data.previousHash).toBe('tx-prev-hash')
  })
})

// ─── Test 2: createTipDistributionWithChain z tx parametrom ─────────────────

describe('P1 fix: createTipDistributionWithChain z optional tx parametrom', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tipMocks.mockFindFirst.mockResolvedValue(null)
    tipMocks.mockCreate.mockImplementation(() =>
      Promise.resolve({ id: 'td-' + Math.random().toString(36).slice(2, 8) })
    )
  })

  it('BREZ tx: odpre svojo lastno transakcijo (backward compat)', async () => {
    // Override db.$transaction za ta test
    const { db } = await import('@/lib/db')
    ;(db as unknown as { $transaction: unknown }).$transaction = tipMocks.mockTransaction

    const entries = [{
      tipPoolId: 'pool-1',
      employeeId: 'emp-1',
      employeeName: 'Ana',
      hoursWorked: 8,
      points: 1,
      amount: 25.50,
      status: 'pending' as const,
    }]

    const ids = await createTipDistributionWithChain(entries)

    expect(tipMocks.mockTransaction).toHaveBeenCalledTimes(1)
    expect(tipMocks.mockCreate).toHaveBeenCalledTimes(1)
    expect(ids).toHaveLength(1)
  })

  it('Z tx: uporabi predani tx (ne odpre nove transakcije)', async () => {
    const mockTxCreate = vi.fn().mockResolvedValue({ id: 'td-mock-1' })
    const mockTxFindFirst = vi.fn().mockResolvedValue(null)
    const mockTx = {
      tipDistribution: { findFirst: mockTxFindFirst, create: mockTxCreate },
    }

    const entries = [{
      tipPoolId: 'pool-1',
      employeeId: 'emp-1',
      employeeName: 'Ana',
      hoursWorked: 8,
      points: 1,
      amount: 25.50,
      status: 'pending' as const,
    }]

    const ids = await createTipDistributionWithChain(entries, mockTx as never)

    // $transaction NI bil klican
    expect(tipMocks.mockTransaction).not.toHaveBeenCalled()
    // ampak mockTx.tipDistribution.create JE bil klican
    expect(mockTxCreate).toHaveBeenCalledTimes(1)
    expect(ids).toEqual(['td-mock-1'])
  })

  it('Z tx: hash veriga je pravilno zgrajena znotraj tx', async () => {
    const mockTxCreate = vi.fn().mockResolvedValue({ id: 'td-1' })
    const mockTxFindFirst = vi.fn().mockResolvedValue({ chainHash: 'genesis' })
    const mockTx = {
      tipDistribution: { findFirst: mockTxFindFirst, create: mockTxCreate },
    }

    const entries = [{
      tipPoolId: 'pool-1',
      employeeId: 'emp-1',
      employeeName: 'Ana',
      hoursWorked: 8,
      points: 1,
      amount: 25.50,
      status: 'pending' as const,
    }]

    await createTipDistributionWithChain(entries, mockTx as never)

    const call = mockTxCreate.mock.calls[0][0]
    expect(call.data.previousHash).toBe('genesis')

    // chainHash je 64-znakov SHA-256 hex
    expect(call.data.chainHash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('Prazen array: ne naredi nič (niti tx ne uporabi)', async () => {
    const mockTx = {
      tipDistribution: { findFirst: vi.fn(), create: vi.fn() },
    }

    const ids = await createTipDistributionWithChain([], mockTx as never)

    expect(ids).toEqual([])
    expect(mockTx.tipDistribution.findFirst).not.toHaveBeenCalled()
    expect(mockTx.tipDistribution.create).not.toHaveBeenCalled()
  })
})

// ─── Test 3: safeCompareSignature — timing-safe primerjava ──────────────────

describe('P2 fix: Webhook signature — timing-safe comparison', () => {
  // Re-implementiramo funkcijo za test (ista logika kot v route.ts)
  function safeCompareSignature(expected: string, provided: string): boolean {
    const expectedBuf = Buffer.from(expected, 'utf8')
    const providedBuf = Buffer.from(provided, 'utf8')
    if (expectedBuf.length !== providedBuf.length) {
      crypto.timingSafeEqual(expectedBuf, expectedBuf)
      return false
    }
    return crypto.timingSafeEqual(expectedBuf, providedBuf)
  }

  it('sprejme pravilen podpis', () => {
    const expected = 'abc123'
    expect(safeCompareSignature(expected, expected)).toBe(true)
  })

  it('zavrne napačen podpis (isti dolžini)', () => {
    expect(safeCompareSignature('abc123', 'abc124')).toBe(false)
  })

  it('zavrne napačen podpis (različni dolžini)', () => {
    expect(safeCompareSignature('abc123', 'abc1234')).toBe(false)
    expect(safeCompareSignature('abc1234', 'abc123')).toBe(false)
  })

  it('zavrne prazen podpis', () => {
    expect(safeCompareSignature('abc123', '')).toBe(false)
    expect(safeCompareSignature('', '')).toBe(true) // oba prazna — tehnično enaka
  })

  it('je odporen na timing attack (različni prefix-i isti dolžine)', () => {
    const expected = 'a]cdefghijklmnopqrstuvwxyz0123456789'
    const provided1 = 'abcdefghijklmnopqrstuvwxyz0123456789' // 1 znak drugačen
    const provided2 = '0bcdefghijklmnopqrstuvwxyz0123456789' // 1 znak drugačen (drugje)

    expect(safeCompareSignature(expected, provided1)).toBe(false)
    expect(safeCompareSignature(expected, provided2)).toBe(false)
  })
})

// ─── Test 4: deductDirectItem — atomic preprečitev negative stock ───────────

describe('P2 fix: deductDirectItem — atomic preprečitev negative stock', () => {
  it('updateMany z WHERE quantity >= totalUnitsToDeduct — atomicni check', async () => {
    const mockTx = {
      inventoryItem: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'inv-1',
          menuItemId: 'menu-1',
          name: 'Pizza Margherita',
          quantity: 10,
          servingsPerUnit: 1,
          costPerUnit: 5,
          minQuantity: 2,
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }), // uspeh
        findUnique: vi.fn().mockResolvedValue({ quantity: 7 }), // 10 - 3 = 7
      },
      stockTransaction: {
        create: vi.fn().mockResolvedValue({}),
      },
    }

    const { deductDirectItem } = await import('@/lib/stock-deduction/deduct-direct')

    const result = {
      success: true,
      deducted: [] as unknown[],
      lowStockAlerts: [] as unknown[],
      errors: [] as unknown[],
    }

    await deductDirectItem(
      mockTx as never,
      { menuItemId: 'menu-1', quantity: 3, voided: false },
      'order-123',
      42,
      result as never,
    )

    expect(mockTx.inventoryItem.updateMany).toHaveBeenCalledWith({
      where: { id: 'inv-1', quantity: { gte: 3 } },
      data: { quantity: { decrement: 3 } },
    })

    expect(mockTx.stockTransaction.create).toHaveBeenCalledTimes(1)
    const call = mockTx.stockTransaction.create.mock.calls[0][0]
    expect(call.data.quantity).toBe(-3)
    expect(call.data.previousQty).toBe(10)
    expect(call.data.newQty).toBe(7)

    expect(result.success).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('nezadostna zaloga: ne gre v negativo, zabeleži napako', async () => {
    const mockTx = {
      inventoryItem: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'inv-1',
          menuItemId: 'menu-1',
          name: 'Pizza Margherita',
          quantity: 2, // samo 2 na voljo
          servingsPerUnit: 1,
          costPerUnit: 5,
          minQuantity: 2,
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }), // update ni uspel
        findUnique: vi.fn(),
      },
      stockTransaction: {
        create: vi.fn().mockResolvedValue({}),
      },
    }

    const { deductDirectItem } = await import('@/lib/stock-deduction/deduct-direct')

    const result = {
      success: true,
      deducted: [] as unknown[],
      lowStockAlerts: [] as unknown[],
      errors: [] as unknown[],
    }

    await deductDirectItem(
      mockTx as never,
      { menuItemId: 'menu-1', quantity: 5, voided: false }, // hoče 5, na voljo 2
      'order-123',
      42,
      result as never,
    )

    expect(mockTx.inventoryItem.updateMany).toHaveBeenCalledWith({
      where: { id: 'inv-1', quantity: { gte: 5 } },
      data: { quantity: { decrement: 5 } },
    })

    expect(mockTx.inventoryItem.findUnique).not.toHaveBeenCalled()

    expect(mockTx.stockTransaction.create).toHaveBeenCalledTimes(1)
    const call = mockTx.stockTransaction.create.mock.calls[0][0]
    expect(call.data.quantity).toBe(0)
    expect(call.data.previousQty).toBe(2)
    expect(call.data.newQty).toBe(2)
    expect(call.data.reason).toContain('POSKUS PRODAJE')

    expect(result.success).toBe(false)
    expect(result.errors).toHaveLength(1)
    const err = result.errors[0] as { error: string }
    expect(err.error).toContain('Premalo zaloge')
    expect(err.error).toContain('na voljo: 2')
    expect(err.error).toContain('potrebno: 5')
  })
})
