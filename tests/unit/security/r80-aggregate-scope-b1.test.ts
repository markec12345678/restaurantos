// ============================================
// R80 BATCH B — WRITE IDOR REGRESSION: POST /api/tables/transfer
//
// Prej: `db.table.findUnique({ where: { id } })` ×2 BREZ lokacijskega checka —
// take_orders staff je lahko prenesel naročila med mizami TUJIH tenantov
// (inner order.findMany/count je dedoval nescopecan parent; audit 2-b:
// tables/transfer/route.ts:38-74).
//
// Fix: P0-C1 scoped-fetch vzorec iz orders/[id]/transfer — findFirst z
// lokacijskim filtrom iz seje (fail-closed resolver); izven scope-a →
// 404 notInScopeResponse('Miza'); super-admin brez lokacije = globalni nadzor.
//
// Test pristop (kot idor-cross-tenant.test.ts): mock Prisma + requireAuth,
// REAL tenant-scope resolver logika (auth-middleware/tenant-scope je shim nad
// src/lib/tenant-scope.ts), kličemo route handler in preverjamo where + 404.
// ============================================
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextResponse } from 'next/server'

// --- Mock setup ---

const mockTableFindFirst = vi.fn()
const mockTableFindUnique = vi.fn()
const mockTableUpdate = vi.fn()
const mockOrderFindMany = vi.fn()
const mockOrderUpdate = vi.fn()
const mockOrderCount = vi.fn()

const mockTx = {
  // R108: transferTableOrders kanon — tx-fresh re-read + advisory locks
  // ($executeRaw) na OBEH mizah; naročila se berejo TX-FRESH (findMany).
  $executeRaw: vi.fn(),
  order: { update: mockOrderUpdate, count: mockOrderCount, findMany: mockOrderFindMany },
  table: { findFirst: mockTableFindFirst, update: mockTableUpdate },
}

vi.mock('@/lib/db', () => ({
  db: {
    table: {
      findFirst: mockTableFindFirst,
      findUnique: mockTableFindUnique,
      update: mockTableUpdate,
    },
    order: {
      findMany: mockOrderFindMany,
      update: mockOrderUpdate,
      count: mockOrderCount,
    },
    $transaction: vi.fn(async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx)),
  },
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}))

const mockRequireAuth = vi.fn()
// REAL tenant-scope logika — enaka implementacija kot v produkciji
// ('@/lib/auth-middleware' barrel re-exporta src/lib/tenant-scope.ts).
// '@/lib/db' je mock-an zgoraj, zato importActual ne inicializira Prisma.
vi.mock('@/lib/auth-middleware', async () => {
  const actual = await vi.importActual<typeof import('@/lib/tenant-scope')>('@/lib/tenant-scope')
  return {
    requireAuth: mockRequireAuth,
    resolveTenantLocationId: actual.resolveTenantLocationId,
    resolveTenantLocationIdOrThrow: actual.resolveTenantLocationIdOrThrow,
    tenantScopeToWhere: actual.tenantScopeToWhere,
  }
})

vi.mock('@/lib/api-utils', () => ({
  parseJsonBody: vi.fn(async (req: Request) => {
    try {
      const text = await req.text()
      return { data: JSON.parse(text), error: null }
    } catch {
      return { data: null, error: NextResponse.json({ error: 'Bad JSON' }, { status: 400 }) }
    }
  }),
  handleApiError: (_e: unknown, _ctx: string, msg: string) =>
    NextResponse.json({ error: msg }, { status: 500 }),
  validateBody: <T>(_schema: unknown, data: T) => ({ data, error: null }),
}))

// --- Helperji ---

function makeReq(body: unknown): Request {
  return new Request('http://localhost/api/tables/transfer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const LOC_A = 'loc-tenant-a'
const LOC_B = 'loc-tenant-b'

function sessionWith(locationId: string | null, role = 'staff') {
  return {
    session: {
      token: 'tok',
      employeeId: 'emp-1',
      role,
      permissions: ['take_orders'],
      createdAt: Date.now(),
      expiresAt: Date.now() + 3600000,
      absoluteExpiry: Date.now() + 86400000,
      locationId,
    },
    error: null,
  }
}

function mockTablesInScopeA() {
  mockTableFindFirst.mockImplementation(({ where }: { where: { id: string; locationId?: string } }) =>
    Promise.resolve({ id: where.id, number: where.id === 'src-a' ? 1 : 2, locationId: LOC_A }),
  )
}

describe('R80 batch B: POST /api/tables/transfer — cross-tenant WRITE IDOR', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue(sessionWith(LOC_A))
  })

  it('izvorna miza tujega tenanta → 404, brez prenosa (order.findMany ne dedi nescopecanega parenta)', async () => {
    mockTableFindFirst.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(where.id === 'src-a' ? { id: 'src-a', number: 1, locationId: LOC_A } : null),
    )
    const { POST } = await import('@/app/api/tables/transfer/route')
    const res = await POST(makeReq({ sourceTableId: 'src-a', targetTableId: 'tbl-b' }))

    expect(res.status).toBe(404)
    // Obe mizi sta iskani z lokacijskim filtrom iz seje (P0-C1 vzorec)
    expect(mockTableFindFirst).toHaveBeenCalledTimes(2)
    expect(mockTableFindFirst.mock.calls[0][0].where.id).toBe('src-a')
    expect(mockTableFindFirst.mock.calls[0][0].where.locationId).toBe(LOC_A)
    expect(mockTableFindFirst.mock.calls[1][0].where.locationId).toBe(LOC_A)
    // WRITE blokiran: naročila se ne naložijo niti prenesejo
    expect(mockOrderFindMany).not.toHaveBeenCalled()
    expect(mockOrderUpdate).not.toHaveBeenCalled()
    expect(mockTableUpdate).not.toHaveBeenCalled()
  })

  it('ciljna miza tujega tenanta → 404, brez prenosa', async () => {
    mockTableFindFirst.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(where.id === 'src-a' ? { id: 'src-a', number: 1, locationId: LOC_A } : null),
    )
    const { POST } = await import('@/app/api/tables/transfer/route')
    const res = await POST(makeReq({ sourceTableId: 'src-a', targetTableId: 'tgt-b' }))

    expect(res.status).toBe(404)
    expect(mockOrderFindMany).not.toHaveBeenCalled()
    expect(mockOrderUpdate).not.toHaveBeenCalled()
    expect(mockTableUpdate).not.toHaveBeenCalled()
  })

  it('prenos znotraj lokacije uspe; order.findMany ima defense-in-depth locationId filter', async () => {
    mockTablesInScopeA()
    mockOrderFindMany.mockResolvedValue([{ id: 'ord-1', orderNumber: 5 }])
    mockOrderUpdate.mockResolvedValue({ id: 'ord-1', orderNumber: 5, tableId: 'tgt-a' })
    mockOrderCount.mockResolvedValue(0)
    mockTableUpdate.mockResolvedValue({})

    const { POST } = await import('@/app/api/tables/transfer/route')
    const res = await POST(makeReq({ sourceTableId: 'src-a', targetTableId: 'tgt-a' }))

    expect(res.status).toBe(200)
    expect(mockTableFindFirst.mock.calls[0][0].where.locationId).toBe(LOC_A)
    expect(mockTableFindFirst.mock.calls[1][0].where.locationId).toBe(LOC_A)
    expect(mockOrderFindMany.mock.calls[0][0].where.locationId).toBe(LOC_A)
    expect(mockOrderUpdate).toHaveBeenCalledTimes(1)
  })

  it('super-admin brez dodeljene lokacije = globalni nadzor (brez locationId filtra, kot P0-C1)', async () => {
    mockRequireAuth.mockResolvedValue(sessionWith(null, 'super_admin'))
    mockTableFindFirst.mockImplementation(({ where }: { where: { id: string; locationId?: string } }) =>
      Promise.resolve({ id: where.id, number: 1, locationId: LOC_B }),
    )
    mockOrderFindMany.mockResolvedValue([{ id: 'ord-9', orderNumber: 9 }])
    mockOrderUpdate.mockResolvedValue({ id: 'ord-9', orderNumber: 9, tableId: 'x' })
    mockOrderCount.mockResolvedValue(0)
    mockTableUpdate.mockResolvedValue({})

    const { POST } = await import('@/app/api/tables/transfer/route')
    const res = await POST(makeReq({ sourceTableId: 'src-x', targetTableId: 'tgt-x' }))

    expect(res.status).toBe(200)
    expect(mockTableFindFirst.mock.calls[0][0].where.locationId).toBeUndefined()
    expect(mockOrderFindMany.mock.calls[0][0].where.locationId).toBeUndefined()
  })

  it('ne-admin brez dodeljene lokacije → 403 fail-closed, findFirst se sploh ne kliče', async () => {
    mockRequireAuth.mockResolvedValue(sessionWith(null, 'staff'))
    const { POST } = await import('@/app/api/tables/transfer/route')
    const res = await POST(makeReq({ sourceTableId: 'src-a', targetTableId: 'tgt-a' }))

    expect(res.status).toBe(403)
    expect(mockTableFindFirst).not.toHaveBeenCalled()
    expect(mockOrderFindMany).not.toHaveBeenCalled()
  })

  it('regresija: findUnique se NE uporablja več za user-controlled table ID', async () => {
    mockTablesInScopeA()
    mockOrderFindMany.mockResolvedValue([{ id: 'ord-1', orderNumber: 5 }])
    mockOrderUpdate.mockResolvedValue({ id: 'ord-1', orderNumber: 5, tableId: 'tgt-a' })
    mockOrderCount.mockResolvedValue(0)
    mockTableUpdate.mockResolvedValue({})

    const { POST } = await import('@/app/api/tables/transfer/route')
    await POST(makeReq({ sourceTableId: 'src-a', targetTableId: 'tgt-a' }))

    expect(mockTableFindUnique).not.toHaveBeenCalled()
  })
})
