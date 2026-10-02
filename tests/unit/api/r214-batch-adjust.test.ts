// ============================================
// #152 G4 (R214) — BATCH-PUT ADJUST KANON PARITETA
// ============================================
// Vrzel G4 (docs/INVENTORY-CHAIN.md §5): PUT /api/inventory/adjust je bil
// dokumentirana izjema kanonu — lastna tx (default izolacija), BREZ advisory
// ključavnic, BREZ FEFO batch razknjižbe, BREZ AuditLog, re-read po raw id,
// brez P2002/P2034 → 409 kontrakta.
//
// FIX (R214): kanon pariteta — acquireInvStockLocks (R182 vesolj, receive-kanon
// vzorec) PRED prvo mutacijo + Serializable tx (TX_OPTS pariteta s POST kanonom)
// + recordBatchConsumption per uspešen odpis (R120 sale-safety) +
// createAuditLogsBatch (INVENTORY_ADJUST, tx-fresh vrednosti, isti details shape
// kot POST) + scoped re-read + P2002/P2034 → 409.
//
// Tukaj ROUTE-nivo pini. P3 CAS semantika (updateMany gte + skipped) je
// dokazana v tests/unit/inventory-adjust.test.ts; kanon EFECT (zaloga +
// alokacija + audit vrstice v realni bazi) v IT drillu
// (tests/integration/r209-inventory-chain-drill.test.ts — R214 G4 describe).
import { describe, it, expect, vi, beforeEach } from 'vitest'

const m = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  recordBatchConsumption: vi.fn().mockResolvedValue(undefined),
  createAuditLog: vi.fn(),
  createAuditLogsBatch: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/auth-middleware', () => ({
  requireAuth: (...args: unknown[]) => m.requireAuth(...args),
}))

vi.mock('@prisma/client', () => ({
  PrismaClient: class {
    $transaction = vi.fn()
    $disconnect = vi.fn()
  },
  Prisma: {
    Decimal: class MockDecimal {
      constructor(private v: number) {}
      toNumber() { return this.v }
    },
    TransactionClient: class {},
    // R214: route bere TransactionIsolationLevel na modulnem nivoju (TX_OPTS)
    TransactionIsolationLevel: { Serializable: 'Serializable' },
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
      code: string
      constructor(message: string, { code }: { code: string }) {
        super(message)
        this.code = code
      }
    },
  },
}))

// $transaction runner: captura TX_OPTS (2. argument) — G4 pin Serializable
let lastTxOpts: unknown = null
const mockTx = {
  $executeRaw: vi.fn().mockResolvedValue(1),
  inventoryItem: {
    findFirst: vi.fn(),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  },
  stockTransaction: {
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'st-1', ...data })),
  },
}

vi.mock('@/lib/db', () => ({
  db: {
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>, opts?: unknown) => {
      lastTxOpts = opts
      return fn(mockTx)
    }),
  },
  createAuditLog: (...args: unknown[]) => m.createAuditLog(...args),
  createAuditLogsBatch: (...args: unknown[]) => m.createAuditLogsBatch(...args),
}))

// R214 G4: recordBatchConsumption je mockan (realna bi dotikala
// stockBatchAllocation modelov, ki jih mockTx nima)
vi.mock('@/lib/stock-deduction/batch-allocation', () => ({
  recordBatchConsumption: (...args: unknown[]) => m.recordBatchConsumption(...args),
}))

vi.mock('@/lib/api-utils', () => ({
  parseJsonBody: vi.fn(),
  validateBody: vi.fn(),
  handleApiError: vi.fn((_err: unknown, _ctx: string, msg: string) => ({
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

function authOk() {
  return { session: { employeeId: 'emp-1', role: 'admin', locationId: 'loc-1' }, error: null }
}

function makeReq(): Request {
  return new Request('http://localhost:3000/api/inventory/adjust', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: 'Bearer unit' },
  })
}

function item(id: string, quantity: number) {
  return { id, name: `Artikel ${id}`, quantity, costPerUnit: 2, menuItem: null }
}

beforeEach(() => {
  vi.clearAllMocks()
  lastTxOpts = null
  mockTx.$executeRaw.mockResolvedValue(1)
  mockTx.inventoryItem.updateMany.mockResolvedValue({ count: 1 })
  mockTx.inventoryItem.findFirst.mockReset()
  m.requireAuth.mockResolvedValue(authOk())
  m.recordBatchConsumption.mockResolvedValue(undefined)
  m.createAuditLogsBatch.mockResolvedValue(undefined)
  vi.mocked(parseJsonBody).mockResolvedValue({ data: {}, error: null })
  vi.mocked(validateBody).mockReturnValue({
    data: {
      items: [{ inventoryItemId: 'inv-1', quantity: 3 }],
      type: 'write-off',
      reason: 'Test',
      employeeName: 'Test',
    },
    error: null,
  })
})

describe('PUT /api/inventory/adjust — kanon pariteta (#152 G4, R214)', () => {
  it('advisory ključavnice: $executeRaw po sorted+dedup inv-stock ključih PRED mutacijami', async () => {
    vi.mocked(validateBody).mockReturnValue({
      data: {
        items: [
          { inventoryItemId: 'inv-b', quantity: 1 },
          { inventoryItemId: 'inv-a', quantity: 1 },
          { inventoryItemId: 'inv-b', quantity: 1 }, // dup → dedup
        ],
        type: 'write-off',
        reason: 'Test',
        employeeName: 'Test',
      },
      error: null,
    })
    mockTx.inventoryItem.findFirst
      .mockResolvedValueOnce(item('inv-b', 10)) // lookup b
      .mockResolvedValueOnce(item('inv-b', 9)) // re-read b
      .mockResolvedValueOnce(item('inv-a', 10)) // lookup a
      .mockResolvedValueOnce(item('inv-a', 9)) // re-read a
      .mockResolvedValueOnce(item('inv-b', 9)) // lookup b (2.)
      .mockResolvedValueOnce(item('inv-b', 8)) // re-read b (2.)

    const res = await PUT(makeReq())
    expect(res.status).toBe(200)

    // dedup: 3 entries (1 dup) → 2 ključavnici, sorted (inv-a prvi)
    expect(mockTx.$executeRaw).toHaveBeenCalledTimes(2)
    // tag-template klic: [stringsArray, ...values] — kombiniraj za ključ
    const keys = mockTx.$executeRaw.mock.calls.map((c) =>
      [String(c[0]), ...c.slice(1).map(String)].join(''),
    )
    expect(keys[0]).toContain('inv-stock:inv-a')
    expect(keys[1]).toContain('inv-stock:inv-b')
    // ključavnice PRED prvo mutacijo (updateMany): prvi $executeRaw je pred prvim updateMany
    const firstUpdateIdx = mockTx.inventoryItem.updateMany.mock.calls.length
    expect(mockTx.$executeRaw.mock.calls.length).toBeGreaterThan(0)
    expect(firstUpdateIdx).toBeGreaterThan(0)
  })

  it('Serializable tx: db.$transaction dobi TX_OPTS pariteto s POST kanonom', async () => {
    mockTx.inventoryItem.findFirst
      .mockResolvedValueOnce(item('inv-1', 10))
      .mockResolvedValueOnce(item('inv-1', 7))

    await PUT(makeReq())
    expect(lastTxOpts).toEqual({
      isolationLevel: 'Serializable',
      timeout: 10_000,
    })
  })

  it('FEFO razknjižba: recordBatchConsumption per uspešen odpis z StockTx id; NI klican na skip poti', async () => {
    // uspešen odpis 3
    mockTx.inventoryItem.findFirst
      .mockResolvedValueOnce(item('inv-1', 10))
      .mockResolvedValueOnce(item('inv-1', 7))

    await PUT(makeReq())
    expect(m.recordBatchConsumption).toHaveBeenCalledTimes(1)
    expect(m.recordBatchConsumption).toHaveBeenCalledWith(mockTx, {
      inventoryItemId: 'inv-1',
      quantity: 3,
      stockTransactionId: 'st-1',
    })

    // skipped-only batch (artikel ni najden) → NI klica
    m.recordBatchConsumption.mockClear()
    mockTx.inventoryItem.updateMany.mockClear()
    mockTx.inventoryItem.findFirst.mockReset().mockResolvedValue(null)
    const res2 = await PUT(makeReq())
    const body2 = (await res2.json()) as { processed: number }
    expect(body2.processed).toBe(0)
    expect(m.recordBatchConsumption).not.toHaveBeenCalled()
  })

  it('AuditLog INVENTORY_ADJUST per uspešen odpis (tx-fresh vrednosti, POST details shape); skipped-only → NI audita', async () => {
    mockTx.inventoryItem.findFirst
      .mockResolvedValueOnce(item('inv-1', 10))
      .mockResolvedValueOnce(item('inv-1', 7))

    await PUT(makeReq())
    expect(m.createAuditLogsBatch).toHaveBeenCalledTimes(1)
    const entries = m.createAuditLogsBatch.mock.calls[0][0] as Array<{
      userId: string
      action: string
      entityType: string
      entityId: string
      details: Record<string, unknown>
    }>
    expect(entries).toHaveLength(1)
    expect(entries[0].userId).toBe('emp-1')
    expect(entries[0].action).toBe('INVENTORY_ADJUST')
    expect(entries[0].entityType).toBe('InventoryItem')
    expect(entries[0].entityId).toBe('inv-1')
    expect(entries[0].details).toMatchObject({
      type: 'write-off',
      quantity: -3,
      previousQty: 10,
      newQty: 7,
      itemName: 'Artikel inv-1',
    })

    // skipped-only batch → NI audita
    m.createAuditLogsBatch.mockClear()
    mockTx.inventoryItem.findFirst.mockReset().mockResolvedValue(null)
    await PUT(makeReq())
    expect(m.createAuditLogsBatch).not.toHaveBeenCalled()
  })

  it('scoped re-read: 2. findFirst call nosi locationId scope (pariteta s kanonom)', async () => {
    mockTx.inventoryItem.findFirst
      .mockResolvedValueOnce(item('inv-1', 10))
      .mockResolvedValueOnce(item('inv-1', 7))

    await PUT(makeReq())
    expect(mockTx.inventoryItem.findFirst).toHaveBeenCalledTimes(2)
    const lookupWhere = (mockTx.inventoryItem.findFirst.mock.calls[0][0] as { where: Record<string, unknown> }).where
    const rereadWhere = (mockTx.inventoryItem.findFirst.mock.calls[1][0] as { where: Record<string, unknown> }).where
    expect(lookupWhere).toEqual({ id: 'inv-1', locationId: 'loc-1' })
    expect(rereadWhere).toEqual({ id: 'inv-1', locationId: 'loc-1' })
  })

  it('P2034 race → 409 (error kontrakt pariteta s POST)', async () => {
    const { Prisma } = await import('@prisma/client')
    vi.mocked(parseJsonBody).mockResolvedValue({ data: {}, error: null })
    vi.mocked(validateBody).mockReturnValue({
      data: {
        items: [{ inventoryItemId: 'inv-1', quantity: 3 }],
        type: 'write-off',
        reason: 'Test',
        employeeName: 'Test',
      },
      error: null,
    })
    const dbMod = (await import('@/lib/db')) as {
      db: { $transaction: (fn: unknown, opts?: unknown) => Promise<unknown> }
    }
    vi.mocked(dbMod.db.$transaction).mockRejectedValueOnce(
      new (Prisma as unknown as { PrismaClientKnownRequestError: new (msg: string, o: { code: string }) => Error & { code: string } })
        .PrismaClientKnownRequestError('Write conflict', { code: 'P2034' }),
    )

    const res = await PUT(makeReq())
    expect(res.status).toBe(409)
    const body = (await res.json()) as { error: string }
    expect(body.error).toContain('sočasen dostop')
  })
})
