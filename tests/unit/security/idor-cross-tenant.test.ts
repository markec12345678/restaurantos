// ============================================
// P0-C1: IDOR CROSS-TENANT REGRESSION TESTS
//
// Testiramo da vseh 8 IDOR ranljivih poti uporablja locationId scope
// pri poizvedbah v DB. Preprečuje cross-tenant access (Tenant A ne
// more prebrati/posodobiti/izbrisati naročila Tenanta B).
//
// Test pristop: mock Prisma client + requireAuth, kličemo route handler,
// preverimo da je bil `findFirst` klican z `where.locationId` pravilno nastavljen.
// ============================================

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextResponse } from 'next/server'

// --- Mock setup ---

const mockOrderFindFirst = vi.fn()
const mockOrderFindUnique = vi.fn()
const mockPaymentFindFirst = vi.fn()
const mockPaymentFindUnique = vi.fn()
const mockTableFindFirst = vi.fn()

vi.mock('@/lib/db', () => ({
  db: {
    order: {
      findFirst: mockOrderFindFirst,
      findUnique: mockOrderFindUnique,
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    payment: {
      findFirst: mockPaymentFindFirst,
      findUnique: mockPaymentFindUnique,
      update: vi.fn().mockResolvedValue({}),
    },
    table: {
      findFirst: mockTableFindFirst,
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    orderItem: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    check: { findUnique: vi.fn(), update: vi.fn() },
    giftCard: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    loyaltyAccount: { findFirst: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn(async (cb: (_tx: unknown) => Promise<unknown>) => cb({})),
  },
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}))

const mockRequireAuth = vi.fn()
vi.mock('@/lib/auth-middleware', () => ({
  requireAuth: mockRequireAuth,
}))

vi.mock('@/lib/decimal', () => ({
  toNum: (v: unknown) => (typeof v === 'number' ? v : Number(v) || 0),
  deepToNumbers: <T>(v: T): T => v,
  round2: (n: number) => Math.round(n * 100) / 100,
}))

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
  handleRouteError: (_e: unknown, _ctx: string, _m: unknown, msg: string) =>
    NextResponse.json({ error: msg }, { status: 500 }),
  validateBody: <T>(_schema: unknown, data: T) => ({ data, error: null }),
}))

vi.mock('@/lib/validations', () => ({
  orderPatchActionSchema: { safeParse: (v: unknown) => ({ success: true, data: v }) },
  updateOrderSchema: { safeParse: (v: unknown) => ({ success: true, data: v }) },
  addOrderItemsSchema: { safeParse: (v: unknown) => ({ success: true, data: v }) },
  createPaymentSchema: { partial: () => ({ extend: () => ({ safeParse: (v: unknown) => ({ success: true, data: v }) }) }) },
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/lib/stock-deduction', () => ({
  deductStockForAddedItems: vi.fn().mockResolvedValue({ deducted: [], lowStockAlerts: [] }),
  broadcastLowStockAlert: vi.fn(),
}))

vi.mock('@/lib/websocket-client', () => ({
  broadcastWSEvent: vi.fn(),
}))

vi.mock('@/lib/counters', () => ({
  getNextCounter: vi.fn().mockResolvedValue(1),
}))

vi.mock('@/lib/event-emitter', () => ({
  eventEmitter: { emit: vi.fn() },
}))

// --- Helper ---
function makeReq(method = 'GET', body?: unknown): Request {
  return new Request('http://localhost/api/test', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

const LOC_A = 'loc-tenant-a'

function sessionWithLocation(locationId: string | null) {
  return {
    session: {
      token: 'tok',
      employeeId: 'emp-1',
      role: 'staff',
      permissions: ['take_orders', 'manage_cash', 'view_reports'],
      createdAt: Date.now(),
      expiresAt: Date.now() + 3600000,
      absoluteExpiry: Date.now() + 86400000,
      locationId,
    },
    error: null,
  }
}

describe('P0-C1: IDOR Cross-Tenant Regression', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue(sessionWithLocation(LOC_A))
  })

  describe('GET /api/orders/[id] — order scoped by locationId', () => {
    it('Tenant A uporablja locationId=A v query', async () => {
      mockOrderFindFirst.mockResolvedValue({ id: 'ord-1', locationId: LOC_A })
      const { GET } = await import('@/app/api/orders/[id]/route')
      await GET(makeReq('GET'), { params: Promise.resolve({ id: 'ord-1' }) })

      expect(mockOrderFindFirst).toHaveBeenCalledTimes(1)
      const where = mockOrderFindFirst.mock.calls[0][0].where
      expect(where.id).toBe('ord-1')
      expect(where.locationId).toBe(LOC_A)
    })

    it('Tenant A ne dobi naročila Tenanta B (findFirst vrne null)', async () => {
      mockOrderFindFirst.mockResolvedValue(null)
      const { GET } = await import('@/app/api/orders/[id]/route')
      const res = await GET(makeReq('GET'), { params: Promise.resolve({ id: 'ord-b' }) })

      expect(res.status).toBe(404)
      expect(mockOrderFindFirst).toHaveBeenCalledTimes(1)
      expect(mockOrderFindFirst.mock.calls[0][0].where.locationId).toBe(LOC_A)
    })
  })

  describe('DELETE /api/orders/[id] — order scoped by locationId', () => {
    it('Tenant A uporablja locationId=A v query', async () => {
      mockOrderFindFirst.mockResolvedValue({ id: 'ord-1', status: 'pending', locationId: LOC_A })
      const { DELETE } = await import('@/app/api/orders/[id]/route')
      await DELETE(makeReq('DELETE'), { params: Promise.resolve({ id: 'ord-1' }) })

      expect(mockOrderFindFirst).toHaveBeenCalledTimes(1)
      const where = mockOrderFindFirst.mock.calls[0][0].where
      expect(where.id).toBe('ord-1')
      expect(where.locationId).toBe(LOC_A)
    })

    it('Tenant A ne izbriše naročila Tenanta B', async () => {
      mockOrderFindFirst.mockResolvedValue(null)
      const { DELETE } = await import('@/app/api/orders/[id]/route')
      const res = await DELETE(makeReq('DELETE'), { params: Promise.resolve({ id: 'ord-b' }) })

      expect(res.status).toBe(404)
    })
  })

  describe('POST /api/orders/[id]/add-items — scoped by locationId', () => {
    it('Tenant A uporablja locationId=A', async () => {
      mockOrderFindFirst.mockResolvedValue({
        id: 'ord-1', status: 'pending', orderItems: [], table: null,
        orderNumber: 1, updatedAt: new Date(), locationId: LOC_A,
      })
      const { POST } = await import('@/app/api/orders/[id]/add-items/route')
      await POST(makeReq('POST', { orderItems: [] }), { params: Promise.resolve({ id: 'ord-1' }) })

      expect(mockOrderFindFirst).toHaveBeenCalled()
      const firstWhere = mockOrderFindFirst.mock.calls[0][0].where
      expect(firstWhere.locationId).toBe(LOC_A)
    })

    it('Tenant A ne doda artiklov naročilu Tenanta B', async () => {
      mockOrderFindFirst.mockResolvedValue(null)
      const { POST } = await import('@/app/api/orders/[id]/add-items/route')
      const res = await POST(makeReq('POST', { orderItems: [] }), { params: Promise.resolve({ id: 'ord-b' }) })

      expect(res.status).toBe(404)
    })
  })

  describe('POST /api/orders/[id]/transfer — scoped by locationId', () => {
    it('Tenant A preveri order in ciljno mizo z locationId=A', async () => {
      mockOrderFindFirst.mockResolvedValue({ id: 'ord-1', tableId: 't1', table: { number: 1 }, orderNumber: 1, locationId: LOC_A })
      mockTableFindFirst.mockResolvedValue({ id: 't2', number: 2, locationId: LOC_A })
      const { POST } = await import('@/app/api/orders/[id]/transfer/route')
      await POST(makeReq('POST', { newTableId: 't2' }), { params: Promise.resolve({ id: 'ord-1' }) })

      expect(mockOrderFindFirst.mock.calls[0][0].where.locationId).toBe(LOC_A)
      expect(mockTableFindFirst).toHaveBeenCalledTimes(1)
      expect(mockTableFindFirst.mock.calls[0][0].where.locationId).toBe(LOC_A)
    })

    it('Tenant A ne more prenesti naročila Tenanta B', async () => {
      mockOrderFindFirst.mockResolvedValue(null)
      const { POST } = await import('@/app/api/orders/[id]/transfer/route')
      const res = await POST(makeReq('POST', { newTableId: 't2' }), { params: Promise.resolve({ id: 'ord-b' }) })

      expect(res.status).toBe(404)
    })

    it('Tenant A ne more prenesti na mizo Tenanta B', async () => {
      mockOrderFindFirst.mockResolvedValue({ id: 'ord-1', tableId: 't1', table: { number: 1 }, orderNumber: 1, locationId: LOC_A })
      mockTableFindFirst.mockResolvedValue(null)
      const { POST } = await import('@/app/api/orders/[id]/transfer/route')
      const res = await POST(makeReq('POST', { newTableId: 't-b' }), { params: Promise.resolve({ id: 'ord-1' }) })

      expect(res.status).toBe(404)
    })
  })

  describe('PUT /api/payments/[id] — scoped via check.order.locationId', () => {
    it('Tenant A uporablja check.order.locationId=A v query', async () => {
      mockPaymentFindFirst.mockResolvedValue({ id: 'pay-1', checkId: 'c1', status: 'completed', amount: 10, refundAmount: 0 })
      const { PUT } = await import('@/app/api/payments/[id]/route')
      await PUT(makeReq('PUT', { status: 'refunded' }), { params: Promise.resolve({ id: 'pay-1' }) })

      expect(mockPaymentFindFirst).toHaveBeenCalledTimes(1)
      const where = mockPaymentFindFirst.mock.calls[0][0].where
      expect(where.id).toBe('pay-1')
      expect(where.check).toBeDefined()
      expect(where.check.order).toBeDefined()
      expect(where.check.order.locationId).toBe(LOC_A)
    })

    it('Tenant A ne posodobi plačila Tenanta B', async () => {
      mockPaymentFindFirst.mockResolvedValue(null)
      const { PUT } = await import('@/app/api/payments/[id]/route')
      const res = await PUT(makeReq('PUT', { status: 'refunded' }), { params: Promise.resolve({ id: 'pay-b' }) })

      expect(res.status).toBe(404)
      expect(mockPaymentFindFirst.mock.calls[0][0].where.check.order.locationId).toBe(LOC_A)
    })
  })

  describe('POST /api/payments/[id]/refund — scoped via check.order.locationId', () => {
    it('Tenant A uporablja check.order.locationId=A v query', async () => {
      mockPaymentFindFirst.mockResolvedValue({
        id: 'pay-1', amount: 100, refundAmount: 0, type: 'cash', checkId: 'c1',
        check: { order: { locationId: LOC_A } },
        giftCardId: null, loyaltyAccountId: null, loyaltyPointsUsed: 0,
      })
      const { POST } = await import('@/app/api/payments/[id]/refund/route')
      await POST(makeReq('POST', { amount: 10, reason: 'test' }), { params: Promise.resolve({ id: 'pay-1' }) })

      expect(mockPaymentFindFirst).toHaveBeenCalledTimes(1)
      const where = mockPaymentFindFirst.mock.calls[0][0].where
      expect(where.id).toBe('pay-1')
      expect(where.check.order.locationId).toBe(LOC_A)
    })

    it('Tenant A ne povrne plačila Tenanta B', async () => {
      mockPaymentFindFirst.mockResolvedValue(null)
      const { POST } = await import('@/app/api/payments/[id]/refund/route')
      const res = await POST(makeReq('POST', { amount: 10, reason: 'test' }), { params: Promise.resolve({ id: 'pay-b' }) })

      expect(res.status).toBe(404)
    })
  })

  describe('Admin (session.locationId = null) — no locationId filter', () => {
    it('Admin vidi vse lokacije (brez locationId filtra)', async () => {
      mockRequireAuth.mockResolvedValue(sessionWithLocation(null))
      mockOrderFindFirst.mockResolvedValue({ id: 'ord-1', locationId: 'loc-other' })
      const { GET } = await import('@/app/api/orders/[id]/route')
      await GET(makeReq('GET'), { params: Promise.resolve({ id: 'ord-1' }) })

      const where = mockOrderFindFirst.mock.calls[0][0].where
      expect(where.id).toBe('ord-1')
      expect(where.locationId).toBeUndefined()
    })
  })

  describe('Regression: findUnique ni več uporabljen za user-controlled id', () => {
    it('Order: findUnique se NE kliče na user-supplied id (zamenjano z findFirst)', async () => {
      mockOrderFindFirst.mockResolvedValue({ id: 'ord-1', locationId: LOC_A })
      const { GET } = await import('@/app/api/orders/[id]/route')
      await GET(makeReq('GET'), { params: Promise.resolve({ id: 'ord-1' }) })

      expect(mockOrderFindUnique).not.toHaveBeenCalled()
    })

    it('Payment: findUnique se NE kliče na user-supplied id', async () => {
      mockPaymentFindFirst.mockResolvedValue({ id: 'pay-1', checkId: 'c1', status: 'completed', amount: 10, refundAmount: 0 })
      const { PUT } = await import('@/app/api/payments/[id]/route')
      await PUT(makeReq('PUT', { status: 'refunded' }), { params: Promise.resolve({ id: 'pay-1' }) })

      expect(mockPaymentFindUnique).not.toHaveBeenCalled()
    })
  })
})
