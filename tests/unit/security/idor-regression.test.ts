// ============================================
// IDOR REGRESSION TESTS — P0-C1
//
// Tests that verify tenant isolation on [id] endpoints:
// 1. Tenant A → Tenant A order     ✅ (found)
// 2. Tenant A → Tenant B order     ❌ (404)
// 3. SuperAdmin → any order         ✅ (found)
// 4. Same for payments
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the auth middleware
vi.mock('@/lib/auth-middleware', () => ({
  requireAuth: vi.fn(),
}))

// Mock the db
const mockOrderFindFirst = vi.fn()
const mockPaymentFindFirst = vi.fn()

vi.mock('@/lib/db', () => ({
  db: {
    order: { findFirst: mockOrderFindFirst, findUnique: vi.fn(), findMany: vi.fn() },
    payment: { findFirst: mockPaymentFindFirst, findUnique: vi.fn(), findMany: vi.fn() },
    table: { findFirst: vi.fn(), findUnique: vi.fn() },
  },
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/decimal', () => ({
  deepToNumbers: (x: unknown) => x,
  toNum: (x: unknown) => Number(x),
  round2: (x: number) => Math.round(x * 100) / 100,
  abs: (x: unknown) => Math.abs(Number(x)),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/lib/api-utils', () => ({
  handleApiError: vi.fn((err: unknown, _name: string, msg: string) => {
    return new Response(JSON.stringify({ error: msg }), { status: 500 })
  }),
  parseJsonBody: vi.fn(async (req: Request) => {
    try {
      const data = await req.json()
      return { data }
    } catch {
      return { error: new Response('Invalid JSON', { status: 400 }) }
    }
  }),
  validateBody: vi.fn((_schema: unknown, data: unknown) => ({ data })),
}))

vi.mock('@/lib/validations', () => ({
  updateOrderSchema: { parse: (x: unknown) => x },
  orderPatchActionSchema: { parse: (x: unknown) => x },
  addOrderItemsSchema: { parse: (x: unknown) => x },
  createPaymentSchema: { partial: () => ({ extend: () => ({ parse: (x: unknown) => x }) }) },
}))

describe('P0-C1: IDOR Regression Tests — Tenant Isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Order [id] — locationId in WHERE clause', () => {
    it('Tenant A user: WHERE includes session.locationId', async () => {
      const { requireAuth } = await import('@/lib/auth-middleware')
      ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
        session: { employeeId: 'emp-a', role: 'waiter', locationId: 'loc-tenant-a' },
        error: null,
      })

      mockOrderFindFirst.mockResolvedValue({ id: 'order-1', locationId: 'loc-tenant-a', status: 'open', orderItems: [], table: { id: 't1', number: 5 } })

      const { GET } = await import('@/app/api/orders/[id]/route')
      const req = new Request('http://localhost:3000/api/orders/order-1', { headers: { Authorization: 'Bearer token' } })
      await GET(req, { params: Promise.resolve({ id: 'order-1' }) })

      expect(mockOrderFindFirst).toHaveBeenCalledTimes(1)
      const callArg = mockOrderFindFirst.mock.calls[0][0]
      expect(callArg.where).toHaveProperty('id', 'order-1')
      expect(callArg.where).toHaveProperty('locationId', 'loc-tenant-a')
    })

    it('Super admin: WHERE does NOT include locationId', async () => {
      const { requireAuth } = await import('@/lib/auth-middleware')
      ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
        session: { employeeId: 'super-admin', role: 'super_admin', locationId: null },
        error: null,
      })

      mockOrderFindFirst.mockResolvedValue({ id: 'order-1', locationId: 'loc-tenant-b', status: 'open', orderItems: [], table: null })

      const { GET } = await import('@/app/api/orders/[id]/route')
      const req = new Request('http://localhost:3000/api/orders/order-1', { headers: { Authorization: 'Bearer token' } })
      await GET(req, { params: Promise.resolve({ id: 'order-1' }) })

      expect(mockOrderFindFirst).toHaveBeenCalledTimes(1)
      const callArg = mockOrderFindFirst.mock.calls[0][0]
      expect(callArg.where).toHaveProperty('id', 'order-1')
      expect(callArg.where).not.toHaveProperty('locationId')
    })

    it('Tenant A → Tenant B order: returns 404', async () => {
      const { requireAuth } = await import('@/lib/auth-middleware')
      ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
        session: { employeeId: 'emp-a', role: 'waiter', locationId: 'loc-tenant-a' },
        error: null,
      })

      mockOrderFindFirst.mockResolvedValue(null)

      const { GET } = await import('@/app/api/orders/[id]/route')
      const req = new Request('http://localhost:3000/api/orders/order-tenant-b', { headers: { Authorization: 'Bearer token' } })
      const response = await GET(req, { params: Promise.resolve({ id: 'order-tenant-b' }) })

      expect(response.status).toBe(404)
      const callArg = mockOrderFindFirst.mock.calls[0][0]
      expect(callArg.where).toHaveProperty('locationId', 'loc-tenant-a')
    })
  })

  describe('Payment [id] — order.locationId in WHERE clause', () => {
    it('Tenant A user: WHERE includes order.locationId', async () => {
      const { requireAuth } = await import('@/lib/auth-middleware')
      ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
        session: { employeeId: 'emp-a', role: 'manager', locationId: 'loc-tenant-a' },
        error: null,
      })

      mockPaymentFindFirst.mockResolvedValue({ id: 'pay-1', amount: 50, status: 'completed', check: { id: 'check-1' }, giftCard: null, loyaltyAccount: null })

      const { PUT } = await import('@/app/api/payments/[id]/route')
      const req = new Request('http://localhost:3000/api/payments/pay-1', {
        method: 'PUT',
        headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'refunded' }),
      })

      try { await PUT(req, { params: Promise.resolve({ id: 'pay-1' }) }) } catch { /* expected */ }

      expect(mockPaymentFindFirst).toHaveBeenCalledTimes(1)
      const callArg = mockPaymentFindFirst.mock.calls[0][0]
      expect(callArg.where).toHaveProperty('id', 'pay-1')
      expect(callArg.where).toHaveProperty('order')
      expect(callArg.where.order).toHaveProperty('locationId', 'loc-tenant-a')
    })

    it('Super admin: WHERE does NOT include order.locationId', async () => {
      const { requireAuth } = await import('@/lib/auth-middleware')
      ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
        session: { employeeId: 'super-admin', role: 'super_admin', locationId: null },
        error: null,
      })

      mockPaymentFindFirst.mockResolvedValue({ id: 'pay-1', amount: 50, status: 'completed', check: { id: 'check-1' }, giftCard: null, loyaltyAccount: null })

      const { PUT } = await import('@/app/api/payments/[id]/route')
      const req = new Request('http://localhost:3000/api/payments/pay-1', {
        method: 'PUT',
        headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'refunded' }),
      })

      try { await PUT(req, { params: Promise.resolve({ id: 'pay-1' }) }) } catch { /* expected */ }

      expect(mockPaymentFindFirst).toHaveBeenCalledTimes(1)
      const callArg = mockPaymentFindFirst.mock.calls[0][0]
      expect(callArg.where).toHaveProperty('id', 'pay-1')
      expect(callArg.where).not.toHaveProperty('order')
    })
  })
})
