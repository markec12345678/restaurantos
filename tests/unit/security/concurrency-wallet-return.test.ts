// ============================================
// P1-19: Wallet payment (webhook concurrency) + returnStockForOrder
// (double-return, snapshot mirror) — Unit testi
// ============================================
import { describe, it, expect, beforeEach, vi } from 'vitest'

// ── ENOTEN mock @/lib/db (zadnji vi.mock za isto pot bi prepisal prejšnje) ──
const { mockDb } = vi.hoisted(() => {
  // "currentTx" — vsak test namesti tx, ki ga $transaction posreduje callbacku
  let currentTx: Record<string, unknown> = {}
  const mockDb = {
    // namenski setter za teste
    __setCurrentTx: (tx: Record<string, unknown>) => {
      currentTx = tx
    },
    walletPayment: {
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    order: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn().mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback(currentTx),
    ),
  }
  return { mockDb }
})

vi.mock('@/lib/db', () => ({ db: mockDb }))

vi.mock('@/lib/outbox', () => ({
  createOutboxEvent: vi.fn().mockResolvedValue({ id: 'outbox-1' }),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/lib/decimal', () => ({
  toNum: (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0),
  round2: (n: number) => Math.round(n * 100) / 100,
  multiply: (a: number, b: number) => a * b,
  subtract: (a: number, b: number) => a - b,
}))

// import PO mockih!
import { authorizeWalletPayment, refundWalletPayment } from '@/lib/wallet-payment'
import { returnStockForOrder } from '@/lib/stock-deduction/return-stock'

describe('P1-19: authorizeWalletPayment — pogojna statusna transicija', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('PRVI webhook: updateMany(count=1) → avtoriziran', async () => {
    mockDb.walletPayment.updateMany.mockResolvedValueOnce({ count: 1 })
    mockDb.walletPayment.findUnique.mockResolvedValueOnce({
      id: 'wp-1',
      status: 'authorized',
      transactionId: 'txn-1',
      amount: 25,
    })

    const result = await authorizeWalletPayment('wp-1', {
      transactionId: 'txn-1',
      status: 'authorized',
    })

    expect(result.status).toBe('authorized')
    // Pogojni update: where vsebuje status='pending'
    const where = mockDb.walletPayment.updateMany.mock.calls[0][0].where
    expect(where).toEqual({ id: 'wp-1', status: 'pending' })
  })

  it('DRUGI (sočasen) webhook istega dogodka: updateMany(count=0) → napaka "ni v pending stanju"', async () => {
    mockDb.walletPayment.updateMany.mockResolvedValueOnce({ count: 0 }) // konkurent že obdelal
    mockDb.walletPayment.findUnique.mockResolvedValueOnce({ id: 'wp-1', status: 'authorized' })

    await expect(
      authorizeWalletPayment('wp-1', { transactionId: 'txn-1', status: 'authorized' }),
    ).rejects.toThrow(/ni v pending stanju \(trenutno: authorized\)/)
  })

  it('webhook NEOBSTOJEČEGA plačila: count=0 + findUnique(null) → "ne obstaja"', async () => {
    mockDb.walletPayment.updateMany.mockResolvedValueOnce({ count: 0 })
    mockDb.walletPayment.findUnique.mockResolvedValueOnce(null)

    await expect(
      authorizeWalletPayment('wp-ne', { transactionId: 'txn-1', status: 'failed' }),
    ).rejects.toThrow(/ne obstaja/)
  })
})

describe('P1-19: refundWalletPayment — zaklep + increment (izgubljen update)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function setupRefundTx(locked: { amount: number; refundedAmount: number; status: string }) {
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(0),
      walletPayment: {
        findUnique: vi.fn().mockResolvedValueOnce({ id: 'wp-1', ...locked }),
        update: vi.fn().mockImplementationOnce(
          async (args: { data: { refundedAmount: { increment: number } } }) => ({
            id: 'wp-1',
            amount: locked.amount,
            refundedAmount: locked.refundedAmount + (args.data?.refundedAmount?.increment ?? 0),
            status: locked.status,
            transactionId: 'txn-1',
          }),
        ),
      },
    }
    mockDb.__setCurrentTx(tx)
    return { tx }
  }

  it('refund 30 od 100 → increment(30) + advisory lock klican', async () => {
    const { tx } = setupRefundTx({ amount: 100, refundedAmount: 0, status: 'captured' })

    await refundWalletPayment('wp-1', 30)

    // Zaklep VEDNO prvi korak transakcije
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1)
    // INCREMENT — ne absolutni zapis (varovalka pred izgubljenimi update-i)
    const updateMock = tx.walletPayment.update as unknown as { mock: { calls: Array<[unknown]> } }
    const updateArgs = updateMock.mock.calls[0][0] as { data: { refundedAmount: { increment: number } } }
    expect(updateArgs.data.refundedAmount).toEqual({ increment: 30 })
  })

  it('drugi refund presega preostanek (60 + 60 > 100) → ZAVRNJEN pred update', async () => {
    const { tx } = setupRefundTx({ amount: 100, refundedAmount: 60, status: 'captured' })

    await expect(refundWalletPayment('wp-1', 60)).rejects.toThrow(/Neveljaven znesek povračila/)
    expect((tx.walletPayment.update as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()
  })
})

// ============================================
// P1-19 + P1-inventory: returnStockForOrder
// ============================================

function makeReturnTx(overrides: {
  existingReturn?: unknown
  saleRows?: Array<{ inventoryItemId: string; quantity: number }>
  order?: Record<string, unknown>
}) {
  let sequence = 0
  const calls = {
    locks: [] as Array<unknown>,
    lockOrder: -1,
    findFirstOrder: -1,
    increments: [] as Array<{ id: string; qty: number }>,
    returnCreates: [] as Array<Record<string, unknown>>,
  }
  const tx = {
    $executeRaw: vi.fn().mockImplementation(async (query: unknown) => {
      sequence++
      calls.locks.push(query)
      if (calls.lockOrder === -1) calls.lockOrder = sequence
      return 0
    }),
    order: {
      findUnique: vi.fn().mockResolvedValue(
        overrides.order ?? { id: 'order-9', inventoryDeducted: true, locationId: 'loc-1', orderNumber: 9 },
      ),
    },
    orderItem: {
      findMany: vi.fn().mockResolvedValue([]), // legacy fallback: prazno
    },
    stockTransaction: {
      findFirst: vi.fn().mockImplementation(async (args: Record<string, unknown>) => {
        sequence++
        if (calls.findFirstOrder === -1) calls.findFirstOrder = sequence
        return overrides.existingReturn ?? null
      }),
      findMany: vi.fn().mockResolvedValue(
        overrides.saleRows ?? [
          { inventoryItemId: 'inv-1', quantity: -4 },
          { inventoryItemId: 'inv-2', quantity: -2 },
        ],
      ),
      create: vi.fn().mockImplementation(async (args: Record<string, unknown>) => {
        calls.returnCreates.push(args.data as Record<string, unknown>)
        return { id: `st-${calls.returnCreates.length}` }
      }),
    },
    inventoryItem: {
      findUnique: vi.fn().mockImplementation(async (args: { where: { id: string } }) => ({
        id: args.where.id,
        name: `Artikel ${args.where.id}`,
        costPerUnit: 2,
        minQuantity: 1,
        locationId: 'loc-1',
      })),
      update: vi.fn().mockImplementation(async (args: { where: { id: string }; data: { quantity: { increment: number } } }) => {
        calls.increments.push({ id: args.where.id, qty: args.data.quantity.increment })
        return { quantity: 100 }
      }),
    },
  }
  mockDb.__setCurrentTx(tx)
  return { tx, calls }
}

describe('P1-19 + P1-inventory: returnStockForOrder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('SNAPSHOT MIRROR: vrača TOČNO nasprotje sale vrstic (ne trenutne recepture)', async () => {
    const { calls } = makeReturnTx({
      saleRows: [
        { inventoryItemId: 'inv-1', quantity: -4 },
        { inventoryItemId: 'inv-2', quantity: -2 },
      ],
    })

    const result = await returnStockForOrder('order-9', 9, 'STORNO')

    // +4 na inv-1, +2 na inv-2 (mirror negiranih količin)
    expect(calls.increments).toContainEqual({ id: 'inv-1', qty: 4 })
    expect(calls.increments).toContainEqual({ id: 'inv-2', qty: 2 })
    expect(result.success).toBe(true)
    expect(result.deducted).toHaveLength(2)
    expect(result.deducted.every(d => d.method === 'snapshot')).toBe(true)
  })

  it('poskus prodaje (quantity=0) se NE vrača', async () => {
    const { calls } = makeReturnTx({
      saleRows: [{ inventoryItemId: 'inv-1', quantity: 0 }],
    })

    await returnStockForOrder('order-9', 9, 'STORNO')

    expect(calls.increments).toHaveLength(0)
    expect(calls.returnCreates).toHaveLength(0)
  })

  it('DOUBLE-RETURN: obstoječa return vrstica → zavrnjeno, NI incrementa', async () => {
    const { calls } = makeReturnTx({ existingReturn: { id: 'ret-1' } })

    const result = await returnStockForOrder('order-9', 9, 'STORNO')

    expect(result.success).toBe(false)
    expect(calls.increments).toHaveLength(0)
  })

  it('advisory lock na orderId je PRVI klic (serializacija konkurenčnih vračil)', async () => {
    const { calls } = makeReturnTx({})

    await returnStockForOrder('order-9', 9, 'STORNO')

    // $executeRaw (pg_advisory_xact_lock) je bil klican PRED stockTransaction.findFirst
    expect(calls.lockOrder).toBe(1)
    expect(calls.findFirstOrder).toBeGreaterThan(calls.lockOrder)
  })

  it('order brez inventoryDeducted → zavrnjeno (zaloga nikoli razknjižena)', async () => {
    makeReturnTx({
      order: { id: 'order-9', inventoryDeducted: false, locationId: 'loc-1', orderNumber: 9 },
    })

    const result = await returnStockForOrder('order-9', 9, 'STORNO')
    expect(result.success).toBe(false)
  })
})
