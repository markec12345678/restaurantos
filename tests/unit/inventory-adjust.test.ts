// ============================================
// INVENTORY ADJUST TESTS — P3 fix: atomic negative stock prevention
// ============================================
// Preverja da inventory/adjust PUT route uporablja atomic updateMany z WHERE
// clause za preprečitev negative stock (enak pattern kot deduct-direct.ts).
// ============================================
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock @prisma/client z Decimal support
vi.mock('@prisma/client', () => {
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
    toDecimalPlaces(_dp: number, _mode?: unknown) { return new MockDecimal(Math.round(this.v * 100) / 100) }
    toString() { return String(this.v) }
    toJSON() { return this.v }
    static ROUND_HALF_UP = 4
  }
  return {
    PrismaClient: class MockPrismaClient {
      $transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
        return fn(mockTx)
      })
      $disconnect = vi.fn()
    },
    Prisma: {
      Decimal: MockDecimal,
      TransactionClient: class {},
    },
  }
})

// Mock db
const mockTx = {
  inventoryItem: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  stockTransaction: {
    create: vi.fn().mockResolvedValue({ id: 'st-1' }),
  },
}

vi.mock('@/lib/db', () => ({
  db: {
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockTx)),
  },
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/lib/auth-middleware', () => ({
  requireAuth: vi.fn().mockResolvedValue({
    session: { employeeId: 'emp-1', locationId: 'loc-1' },
  }),
}))

vi.mock('@/lib/api-utils', () => ({
  parseJsonBody: vi.fn(),
  validateBody: vi.fn(),
  handleApiError: vi.fn((_err, _ctx, msg) => ({
    json: () => ({ error: msg }),
    status: 500,
  })),
}))

vi.mock('@/lib/decimal', () => ({
  toNum: (val: { toNumber?: () => number } | number | null | undefined) => {
    if (val == null) return 0
    if (typeof val === 'number') return val
    if (typeof val.toNumber === 'function') return val.toNumber()
    return Number(val) || 0
  },
  round2: (val: number) => Math.round(val * 100) / 100,
  multiply: (a: number, b: number) => a * b,
}))

import { PUT } from '@/app/api/inventory/adjust/route'
import { parseJsonBody, validateBody } from '@/lib/api-utils'

describe('P3 fix: inventory/adjust — atomic negative stock prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default valid body
    vi.mocked(parseJsonBody).mockResolvedValue({ data: {}, error: null })
    vi.mocked(validateBody).mockReturnValue({ data: {
      items: [{ inventoryItemId: 'inv-1', quantity: 3 }],
      type: 'write-off',
      reason: 'Test',
      employeeName: 'Test',
    }, error: null })
  })

  it('uporabi atomic updateMany z WHERE quantity >= deductQty (zadostna zaloga)', async () => {
    mockTx.inventoryItem.findUnique.mockResolvedValue({
      id: 'inv-1',
      name: 'Moka',
      quantity: 10,
      costPerUnit: 2,
    })
    mockTx.inventoryItem.updateMany.mockResolvedValue({ count: 1 }) // uspeh
    mockTx.inventoryItem.findUnique.mockResolvedValueOnce({
      id: 'inv-1', name: 'Moka', quantity: 10, costPerUnit: 2,
    }).mockResolvedValueOnce({
      id: 'inv-1', name: 'Moka', quantity: 7, costPerUnit: 2, menuItem: null,
    })

    const req = new Request('http://localhost/api/inventory/adjust', { method: 'PUT' })
    const res = await PUT(req)
    const body = await res.json()

    // updateMany je bil klican z atomarnim WHERE
    expect(mockTx.inventoryItem.updateMany).toHaveBeenCalledWith({
      where: { id: 'inv-1', quantity: { gte: 3 } },
      data: { quantity: { decrement: 3 } },
    })

    // StockTransaction je bil zapisan z negativno količino
    expect(mockTx.stockTransaction.create).toHaveBeenCalledTimes(1)
    const call = mockTx.stockTransaction.create.mock.calls[0][0]
    expect(call.data.quantity).toBe(-3)
    expect(call.data.previousQty).toBe(10)
    expect(call.data.newQty).toBe(7)

    // Item je bil procesiran
    expect(body.processed).toBe(1)
    expect(body.skipped).toHaveLength(0)
  })

  it('nezadostna zaloga: NE gre v negativo, zabeleži v skipped', async () => {
    mockTx.inventoryItem.findUnique
      .mockResolvedValueOnce({ id: 'inv-1', name: 'Moka', quantity: 2, costPerUnit: 2 })
      .mockResolvedValueOnce({ id: 'inv-1', name: 'Moka', quantity: 2, costPerUnit: 2, menuItem: null })

    // updateMany vrne count=0 — ni dovolj zaloge
    mockTx.inventoryItem.updateMany.mockResolvedValue({ count: 0 })

    // Spremeni quantity na 5 (več kot 2)
    vi.mocked(validateBody).mockReturnValue({ data: {
      items: [{ inventoryItemId: 'inv-1', quantity: 5 }],
      type: 'write-off',
      reason: 'Test',
      employeeName: 'Test',
    }, error: null })

    const req = new Request('http://localhost/api/inventory/adjust', { method: 'PUT' })
    const res = await PUT(req)
    const body = await res.json()

    // updateMany je bil klican z atomarnim WHERE
    expect(mockTx.inventoryItem.updateMany).toHaveBeenCalledWith({
      where: { id: 'inv-1', quantity: { gte: 5 } },
      data: { quantity: { decrement: 5 } },
    })

    // Ni bil procesiran
    expect(body.processed).toBe(0)
    expect(body.skipped).toHaveLength(1)
    expect(body.skipped[0].reason).toContain('Premalo zaloge')
    expect(body.skipped[0].reason).toContain('na voljo: 2')
    expect(body.skipped[0].reason).toContain('potrebno: 5')

    // StockTransaction je bil zapisan z quantity=0 (POSKUS)
    expect(mockTx.stockTransaction.create).toHaveBeenCalledTimes(1)
    const call = mockTx.stockTransaction.create.mock.calls[0][0]
    expect(call.data.quantity).toBe(0)
    expect(call.data.newQty).toBe(2) // nespremenjeno
    expect(call.data.reason).toContain('POSKUS')
    expect(call.data.reason).toContain('nezadostna zaloga')
  })

  it('artikel ni najden: zabeleži v skipped', async () => {
    // Reset mocks — mockReset() čisti tudi queued return values
    mockTx.inventoryItem.findUnique.mockReset()
    mockTx.inventoryItem.updateMany.mockReset()
    mockTx.stockTransaction.create.mockReset()
    mockTx.stockTransaction.create.mockResolvedValue({ id: 'st-1' })
    mockTx.inventoryItem.findUnique.mockResolvedValue(null)
    vi.mocked(parseJsonBody).mockResolvedValue({ data: {}, error: null })
    vi.mocked(validateBody).mockReturnValue({ data: {
      items: [{ inventoryItemId: 'inv-1', quantity: 3 }],
      type: 'write-off',
      reason: 'Test',
      employeeName: 'Test',
    }, error: null })

    const req = new Request('http://localhost/api/inventory/adjust', { method: 'PUT' })
    const res = await PUT(req)
    const body = await res.json()

    expect(body.processed).toBe(0)
    expect(body.skipped).toHaveLength(1)
    expect(body.skipped[0].reason).toBe('Artikel ni najden')

    // updateMany NI bil klican
    expect(mockTx.inventoryItem.updateMany).not.toHaveBeenCalled()
    // StockTransaction NI bil klican
    expect(mockTx.stockTransaction.create).not.toHaveBeenCalled()
  })

  it('količina = 0 ali negativna: zabeleži v skipped', async () => {
    mockTx.inventoryItem.findUnique.mockResolvedValue({
      id: 'inv-1', name: 'Moka', quantity: 10, costPerUnit: 2,
    })

    vi.mocked(validateBody).mockReturnValue({ data: {
      items: [{ inventoryItemId: 'inv-1', quantity: 0 }],
      type: 'write-off',
      reason: 'Test',
      employeeName: 'Test',
    }, error: null })

    const req = new Request('http://localhost/api/inventory/adjust', { method: 'PUT' })
    const res = await PUT(req)
    const body = await res.json()

    expect(body.skipped).toHaveLength(1)
    expect(body.skipped[0].reason).toContain('Količina mora biti pozitivna')
    expect(mockTx.inventoryItem.updateMany).not.toHaveBeenCalled()
  })
})
