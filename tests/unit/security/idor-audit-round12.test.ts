// ============================================
// IDOR REGRESSION TESTS — AUDIT ROUND 12
//
// Tests that verify tenant isolation on [id] endpoints
// fixed in the latest audit round:
// 1. receipts/[id]     — order.locationId scope (GET, PUT)
// 2. checks/[id]       — order.locationId scope (PUT, DELETE)
// 3. time-entries/[id] — locationId scope (PUT)
// 4. purchase-orders/[id] PATCH — locationId scope (GET/PUT so bili že fixed)
// 5. waitlist/[id]     — locationId scope (PUT, DELETE)
// 6. Bolt webhook      — fail-closed brez secreta (prej fail-open)
// 7. orders POST       — brez PII debug headerjev
// ============================================

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the auth middleware
vi.mock('@/lib/auth-middleware', () => ({
  requireAuth: vi.fn(),
  resolveTenantLocationId: vi.fn(),
  tenantScopeToWhere: vi.fn(() => ({}),
  ),
}))

// Mock the db
const mockOrderFindFirst = vi.fn()
const mockReceiptFindFirst = vi.fn()
const mockCheckFindFirst = vi.fn()
const mockTimeEntryFindFirst = vi.fn()
const mockPurchaseOrderFindFirst = vi.fn()
const mockWaitlistFindFirst = vi.fn()
const mockEmployeeFindUnique = vi.fn()
const mockIntegrationFindFirst = vi.fn()

vi.mock('@/lib/db', () => ({
  db: {
    order: { findFirst: mockOrderFindFirst, findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn() },
    receipt: { findFirst: mockReceiptFindFirst, findUnique: vi.fn() },
    check: { findFirst: mockCheckFindFirst, findUnique: vi.fn() },
    timeEntry: { findFirst: mockTimeEntryFindFirst, findUnique: vi.fn() },
    purchaseOrder: { findFirst: mockPurchaseOrderFindFirst, findUnique: vi.fn() },
    waitlistEntry: { findFirst: mockWaitlistFindFirst, findUnique: vi.fn(), create: vi.fn() },
    employee: { findUnique: mockEmployeeFindUnique },
    integration: { findFirst: mockIntegrationFindFirst, update: vi.fn() },
    integrationLog: { create: vi.fn() },
    menuItem: { findMany: vi.fn().mockResolvedValue([]) },
  },
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/decimal', () => ({
  deepToNumbers: (x: unknown) => x,
  toNum: (x: unknown) => Number(x),
  round2: (x: number) => Math.round(x * 100) / 100,
  multiply: (a: number, b: number) => a * b,
  sumBy: (arr: unknown[], fn: (x: unknown) => number) => arr.reduce((s: number, x: unknown) => s + fn(x), 0),
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
  validateRequest: vi.fn(async (req: Request, _schema: unknown) => {
    try {
      const data = await req.json()
      return { data }
    } catch {
      return { error: new Response('Invalid JSON', { status: 400 }) }
    }
  }),
  validateApiResponse: vi.fn((data: unknown) => data),
}))

vi.mock('@/lib/validations', () => ({
  updateCheckSchema: { parse: (x: unknown) => x },
  updateTimeEntrySchema: { parse: (x: unknown) => x },
  receiptResponseSchema: {},
  orderSchema: { parse: (x: unknown) => x },
}))

// receipts/[id] helpers
vi.mock('@/app/api/receipts/[id]/_route-helpers', () => ({
  buildReceiptPreview: vi.fn(() => ({ id: 'r1', preview: true })),
}))
vi.mock('@/app/api/receipts/[id]/_helpers/post-handler', () => ({
  handlePostReceipt: vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 }),
  ),
}))
vi.mock('@/lib/furs/config-resolver', () => ({
  getRestaurantInfoForLocation: vi.fn(async () => ({
    name: 'Test', address: 'Test 1', postCode: '1000', city: 'Ljubljana',
    phone: '', businessId: '12345678', taxId: 'SI12345678', registerNumber: '1',
  })),
}))

// checks/[id] helpers
vi.mock('@/app/api/checks/[id]/_helpers', () => ({
  validateDiscount: vi.fn(),
  calculateDiscountUpdate: vi.fn(() => ({})),
  calculateNoDiscountTotals: vi.fn(() => ({})),
  incrementDiscountUsage: vi.fn(),
  decrementDiscountUsage: vi.fn(),
}))

// purchase-orders helpers + email
vi.mock('@/app/api/purchase-orders/[id]/_helpers', () => ({
  purchaseOrderUpdateSchema: { parse: (x: unknown) => x },
  VALID_PO_TRANSITIONS: { draft: ['submitted', 'cancelled'], submitted: ['received', 'cancelled'] },
  handleReceiveAction: vi.fn(),
}))
vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn(),
  isEmailEnabled: vi.fn(async () => false),
}))

// orders POST helper
vi.mock('@/app/api/orders/_helpers/post-handler', () => ({
  handlePostOrder: vi.fn(async () => new Response(JSON.stringify({ success: true }), {
    status: 201,
    headers: new Headers(),
  })),
}))

// rate-limit
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitAsync: vi.fn(async () => ({ allowed: true, retryAfterMs: 60000 })),
  checkRateLimit: vi.fn(() => ({ allowed: true, retryAfterMs: 60000 })),
  getClientIp: vi.fn(() => '127.0.0.1'),
  DELIVERY_WEBHOOK_LIMIT: { maxRequests: 30, windowMs: 60000 },
  AUTHENTICATED_LIMIT: { maxRequests: 60, windowMs: 60000 },
}))

// bolt webhook helpers + infra
vi.mock('@/app/api/delivery/webhook/bolt/_helpers', () => ({
  BOLT_SIGNATURE_HEADER: 'x-bolt-signature',
  boltOrderSchema: { safeParse: (x: unknown) => ({ data: x, error: null }) },
  findExistingBoltOrder: vi.fn(async () => null),
  mapBoltItemsToOrderItems: vi.fn(() => []),
}))
vi.mock('@/lib/counters', () => ({ getNextCounter: vi.fn(async () => 42) }))
vi.mock('@/lib/event-emitter', () => ({ emitOrderCreated: vi.fn(async () => undefined) }))
vi.mock('@/lib/websocket-client', () => ({ broadcastWSEvent: vi.fn() }))

function makeAuthedReq(url: string, method = 'GET', body?: unknown) {
  return new Request(url, {
    method,
    headers: { Authorization: 'Bearer token', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

describe('AUDIT R12: IDOR Regression — nova fixed [id] rute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Receipts [id] GET — order.locationId scope', () => {
    it('Tenant A user: WHERE vsebuje session.locationId', async () => {
      const { requireAuth } = await import('@/lib/auth-middleware')
      ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
        session: { employeeId: 'emp-a', role: 'waiter', locationId: 'loc-tenant-a' },
        error: null,
      })
      mockOrderFindFirst.mockResolvedValue(null)

      const { GET } = await import('@/app/api/receipts/[id]/route')
      const req = makeAuthedReq('http://localhost:3000/api/receipts/order-1')
      await GET(req, { params: Promise.resolve({ id: 'order-1' }) })

      expect(mockOrderFindFirst).toHaveBeenCalledTimes(1)
      const callArg = mockOrderFindFirst.mock.calls[0][0]
      expect(callArg.where).toHaveProperty('id', 'order-1')
      expect(callArg.where).toHaveProperty('locationId', 'loc-tenant-a')
    })

    it('Super admin: WHERE NE vsebuje locationId', async () => {
      const { requireAuth } = await import('@/lib/auth-middleware')
      ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
        session: { employeeId: 'super-admin', role: 'super_admin', locationId: null },
        error: null,
      })
      mockOrderFindFirst.mockResolvedValue(null)

      const { GET } = await import('@/app/api/receipts/[id]/route')
      const req = makeAuthedReq('http://localhost:3000/api/receipts/order-1')
      const res = await GET(req, { params: Promise.resolve({ id: 'order-1' }) })

      expect(res.status).toBe(404)
      const callArg = mockOrderFindFirst.mock.calls[0][0]
      expect(callArg.where).toHaveProperty('id', 'order-1')
      expect(callArg.where).not.toHaveProperty('locationId')
    })
  })

  describe('Receipts [id] PUT — receipt scoped prek order.locationId', () => {
    it('Tenant A user: WHERE vsebuje order.locationId', async () => {
      const { requireAuth } = await import('@/lib/auth-middleware')
      ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
        session: { employeeId: 'emp-a', role: 'manager', locationId: 'loc-tenant-a' },
        error: null,
      })
      mockReceiptFindFirst.mockResolvedValue(null)

      const { PUT } = await import('@/app/api/receipts/[id]/route')
      const req = makeAuthedReq('http://localhost:3000/api/receipts/order-1', 'PUT', { printed: true })
      const res = await PUT(req, { params: Promise.resolve({ id: 'order-1' }) })

      expect(res.status).toBe(404)
      expect(mockReceiptFindFirst).toHaveBeenCalledTimes(1)
      const callArg = mockReceiptFindFirst.mock.calls[0][0]
      expect(callArg.where).toHaveProperty('orderId', 'order-1')
      expect(callArg.where).toHaveProperty('order')
      expect(callArg.where.order).toHaveProperty('locationId', 'loc-tenant-a')
    })
  })

  describe('Checks [id] PUT — order.locationId scope', () => {
    it('Tenant A user: WHERE vsebuje order.locationId', async () => {
      const { requireAuth } = await import('@/lib/auth-middleware')
      ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
        session: { employeeId: 'emp-a', role: 'waiter', locationId: 'loc-tenant-a' },
        error: null,
      })
      mockCheckFindFirst.mockResolvedValue(null)

      const { PUT } = await import('@/app/api/checks/[id]/route')
      const req = makeAuthedReq('http://localhost:3000/api/checks/check-1', 'PUT', { paymentStatus: 'paid' })
      const res = await PUT(req, { params: Promise.resolve({ id: 'check-1' }) })

      expect(res.status).toBe(404)
      const callArg = mockCheckFindFirst.mock.calls[0][0]
      expect(callArg.where).toHaveProperty('id', 'check-1')
      expect(callArg.where).toHaveProperty('order')
      expect(callArg.where.order).toHaveProperty('locationId', 'loc-tenant-a')
    })
  })

  describe('Checks [id] DELETE — order.locationId scope', () => {
    it('Tenant A user: WHERE vsebuje order.locationId', async () => {
      const { requireAuth } = await import('@/lib/auth-middleware')
      ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
        session: { employeeId: 'emp-a', role: 'waiter', locationId: 'loc-tenant-a' },
        error: null,
      })
      mockCheckFindFirst.mockResolvedValue(null)

      const { DELETE } = await import('@/app/api/checks/[id]/route')
      const req = makeAuthedReq('http://localhost:3000/api/checks/check-1', 'DELETE')
      const res = await DELETE(req, { params: Promise.resolve({ id: 'check-1' }) })

      expect(res.status).toBe(404)
      const callArg = mockCheckFindFirst.mock.calls[0][0]
      expect(callArg.where).toHaveProperty('order')
      expect(callArg.where.order).toHaveProperty('locationId', 'loc-tenant-a')
    })
  })

  describe('Time-entries [id] PUT — locationId scope', () => {
    it('Tenant A user: WHERE vsebuje locationId', async () => {
      const { requireAuth } = await import('@/lib/auth-middleware')
      ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
        session: { employeeId: 'emp-a', role: 'manager', locationId: 'loc-tenant-a' },
        error: null,
      })
      mockTimeEntryFindFirst.mockResolvedValue(null)

      const { PUT } = await import('@/app/api/time-entries/[id]/route')
      const req = makeAuthedReq('http://localhost:3000/api/time-entries/te-1', 'PUT', { clockOut: '2026-01-01T12:00:00Z' })
      const res = await PUT(req, { params: Promise.resolve({ id: 'te-1' }) })

      expect(res.status).toBe(404)
      const callArg = mockTimeEntryFindFirst.mock.calls[0][0]
      expect(callArg.where).toHaveProperty('id', 'te-1')
      expect(callArg.where).toHaveProperty('locationId', 'loc-tenant-a')
    })
  })

  describe('Purchase-orders [id] PATCH — locationId scope', () => {
    it('Tenant A user: WHERE vsebuje locationId', async () => {
      const { requireAuth } = await import('@/lib/auth-middleware')
      ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
        session: { employeeId: 'emp-a', role: 'manager', locationId: 'loc-tenant-a' },
        error: null,
      })
      mockPurchaseOrderFindFirst.mockResolvedValue(null)

      const { PATCH } = await import('@/app/api/purchase-orders/[id]/route')
      const req = makeAuthedReq('http://localhost:3000/api/purchase-orders/po-1', 'PATCH', { status: 'submitted' })
      const res = await PATCH(req, { params: Promise.resolve({ id: 'po-1' }) })

      expect(res.status).toBe(404)
      const callArg = mockPurchaseOrderFindFirst.mock.calls[0][0]
      expect(callArg.where).toHaveProperty('id', 'po-1')
      expect(callArg.where).toHaveProperty('locationId', 'loc-tenant-a')
    })
  })

  describe('Waitlist [id] PUT/DELETE — locationId scope', () => {
    it('Tenant A user PUT: WHERE vsebuje locationId', async () => {
      const { requireAuth } = await import('@/lib/auth-middleware')
      ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
        session: { employeeId: 'emp-a', role: 'waiter', locationId: 'loc-tenant-a' },
        error: null,
      })
      mockWaitlistFindFirst.mockResolvedValue(null)

      const { PUT } = await import('@/app/api/waitlist/[id]/route')
      const req = makeAuthedReq('http://localhost:3000/api/waitlist/wl-1', 'PUT', { action: 'notify' })
      const res = await PUT(req, { params: Promise.resolve({ id: 'wl-1' }) })

      expect(res.status).toBe(404)
      const callArg = mockWaitlistFindFirst.mock.calls[0][0]
      expect(callArg.where).toHaveProperty('id', 'wl-1')
      expect(callArg.where).toHaveProperty('locationId', 'loc-tenant-a')
    })

    it('Tenant A user DELETE: WHERE vsebuje locationId', async () => {
      const { requireAuth } = await import('@/lib/auth-middleware')
      ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
        session: { employeeId: 'emp-a', role: 'waiter', locationId: 'loc-tenant-a' },
        error: null,
      })
      mockWaitlistFindFirst.mockResolvedValue(null)

      const { DELETE } = await import('@/app/api/waitlist/[id]/route')
      const req = makeAuthedReq('http://localhost:3000/api/waitlist/wl-1', 'DELETE')
      const res = await DELETE(req, { params: Promise.resolve({ id: 'wl-1' }) })

      expect(res.status).toBe(404)
      const callArg = mockWaitlistFindFirst.mock.calls[0][0]
      expect(callArg.where).toHaveProperty('locationId', 'loc-tenant-a')
    })
  })

  describe('Bolt webhook — fail-closed brez secreta', () => {
    it('Brez apiSecret/WEBHOOK_SECRET: ZAVRNJEN (ne fail-open)', async () => {
      mockIntegrationFindFirst.mockResolvedValue({ id: 'int-1', provider: 'bolt', isActive: true, apiSecret: null })
      // WEBHOOK_SECRET ni nastavljen v testnem env — vendar ga moremo eksplicitno izbrisati
      const prevSecret = process.env.WEBHOOK_SECRET
      delete process.env.WEBHOOK_SECRET

      const { POST } = await import('@/app/api/delivery/webhook/bolt/route')
      const req = new Request('http://localhost:3000/api/delivery/webhook/bolt', {
        method: 'POST',
        headers: { 'x-bolt-signature': 'deadbeef' },
        body: JSON.stringify({ order_id: 'b-1' }),
      })
      const res = await POST(req)

      // FIX SECURITY: prej 200/201 (fail-open — podpis se je preskočil), sedaj 503 (fail-closed)
      expect(res.status).toBe(503)

      if (prevSecret !== undefined) process.env.WEBHOOK_SECRET = prevSecret
    })
  })

  describe('Orders POST — brez PII debug headerjev', () => {
    it('Uspešen POST ne izpostavi X-Auth-* headerjev', async () => {
      const { requireAuth } = await import('@/lib/auth-middleware')
      ;(requireAuth as ReturnType<typeof vi.fn>).mockResolvedValue({
        session: { employeeId: 'emp-a', role: 'waiter', locationId: 'loc-tenant-a' },
        error: null,
      })
      mockEmployeeFindUnique.mockResolvedValue({ status: 'active' })
      const { handlePostOrder } = await import('@/app/api/orders/_helpers/post-handler')
      ;(handlePostOrder as ReturnType<typeof vi.fn>).mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 201 }),
      )

      const { POST } = await import('@/app/api/orders/route')
      const req = makeAuthedReq('http://localhost:3000/api/orders', 'POST', { tableId: 't1', items: [] })
      const res = await POST(req)

      expect(res.status).toBe(201)
      expect(res.headers.get('X-Auth-Check')).toBeNull()
      expect(res.headers.get('X-Auth-EmployeeId')).toBeNull()
      expect(res.headers.get('X-Auth-EmployeeName')).toBeNull()
      expect(res.headers.get('X-Auth-EmployeeStatus')).toBeNull()
    })
  })
})
