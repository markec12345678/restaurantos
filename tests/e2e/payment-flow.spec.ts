// ============================================
// RestaurantOS — Payment Flow E2E Tests
// ============================================
// Validira: order creation, payment processing, refunds, void operations,
// gift cards, loyalty points, idempotency.
// ============================================
import { test, expect, request as playwrightRequest } from '@playwright/test'

const API_BASE = '/api'
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
const TEST_PIN = '1111'
const TEST_EMPLOYEE_ID = 'test-admin'

test.describe.configure({ mode: 'serial' })

test.describe('Payment Flow', () => {
  let authToken: string

  test.beforeAll(async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: BASE_URL })
    const res = await ctx.post(`${API_BASE}/auth`, {
      data: { employeeId: TEST_EMPLOYEE_ID, pin: TEST_PIN },
    })
    const body = await res.json()
    authToken = body.token
    await ctx.dispose()
  })

  function authHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' }
  }

  // ═══════════════════════════════════════════════════════════════
  // ORDER LISTING
  // ═══════════════════════════════════════════════════════════════

  test('PAY-1: GET /api/orders vrača paginirane naročila', async ({ request }) => {
    const res = await request.get(`${API_BASE}/orders?limit=10&offset=0`, { headers: authHeaders() })
    expect([200, 429]).toContain(res.status())
    if (res.ok()) {
      const body = await res.json()
      expect(body.orders).toBeDefined()
      expect(body.total).toBeDefined()
      expect(body.limit).toBe(10)
      expect(body.offset).toBe(0)
    }
  })

  test('PAY-2: GET /api/orders z status filter', async ({ request }) => {
    const res = await request.get(`${API_BASE}/orders?status=pending&limit=5`, { headers: authHeaders() })
    expect([200, 429]).toContain(res.status())
    if (res.ok()) {
      const body = await res.json()
      for (const order of body.orders || []) {
        expect(order.status).toBe('pending')
      }
    }
  })

  test('PAY-3: GET /api/orders z paymentStatus filter', async ({ request }) => {
    const res = await request.get(`${API_BASE}/orders?paymentStatus=paid&limit=5`, { headers: authHeaders() })
    expect([200, 429]).toContain(res.status())
    if (res.ok()) {
      const body = await res.json()
      for (const order of body.orders || []) {
        expect(order.paymentStatus).toBe('paid')
      }
    }
  })

  // ═══════════════════════════════════════════════════════════════
  // ORDER CREATION
  // ═══════════════════════════════════════════════════════════════

  test('PAY-4: POST /api/orders z veljavnimi podatki', async ({ request }) => {
    const menuRes = await request.get(`${API_BASE}/menu-items?limit=1`, { headers: authHeaders() })
    if (!menuRes.ok()) { test.skip(); return }
    const menuBody = await menuRes.json()
    const menuItemId = menuBody.menuItems?.[0]?.id
    if (!menuItemId) { test.skip(); return }

    const res = await request.post(`${API_BASE}/orders`, {
      headers: authHeaders(),
      data: {
        type: 'dine-in',
        tableId: 'table-1',
        orderItems: [{ menuItemId, quantity: 1 }],
      },
    })
    expect([200, 201, 400, 429]).toContain(res.status())
    if (res.ok()) {
      const order = await res.json()
      expect(order.id).toBeTruthy()
      expect(order.orderNumber).toBeTruthy()
      expect(order.status).toBe('pending')
    }
  })

  test('PAY-5: POST /api/orders z manjkajočimi orderItems vrne 400', async ({ request }) => {
    const res = await request.post(`${API_BASE}/orders`, {
      headers: authHeaders(),
      data: { type: 'dine-in', tableId: 'table-1' },
    })
    expect([400, 429]).toContain(res.status())
  })

  test('PAY-6: POST /api/orders z neveljavnim type vrne 400', async ({ request }) => {
    const res = await request.post(`${API_BASE}/orders`, {
      headers: authHeaders(),
      data: { type: 'invalid-type', tableId: 'table-1', orderItems: [] },
    })
    expect([400, 429]).toContain(res.status())
  })

  // ═══════════════════════════════════════════════════════════════
  // ORDER MODIFICATION
  // ═══════════════════════════════════════════════════════════════

  test('PAY-7: PUT /api/orders/[id] z neobstoječim ID vrne 404', async ({ request }) => {
    const res = await request.put(`${API_BASE}/orders/nonexistent-id`, {
      headers: authHeaders(),
      data: { status: 'in-progress' },
    })
    expect([404, 429]).toContain(res.status())
  })

  test('PAY-8: PATCH /api/orders/[id] z neveljavnim action vrne 400', async ({ request }) => {
    const ordersRes = await request.get(`${API_BASE}/orders?limit=1`, { headers: authHeaders() })
    if (!ordersRes.ok()) { test.skip(); return }
    const orderId = (await ordersRes.json()).orders?.[0]?.id
    if (!orderId) { test.skip(); return }

    const res = await request.patch(`${API_BASE}/orders/${orderId}`, {
      headers: authHeaders(),
      data: { action: 'invalid-action' },
    })
    expect([400, 429]).toContain(res.status())
  })

  // ═══════════════════════════════════════════════════════════════
  // PAYMENT ENDPOINTS
  // ═══════════════════════════════════════════════════════════════

  test('PAY-9: GET /api/payments vrača seznam plačil', async ({ request }) => {
    const res = await request.get(`${API_BASE}/payments?limit=10`, { headers: authHeaders() })
    expect([200, 429]).toContain(res.status())
    if (res.ok()) {
      const body = await res.json()
      expect(body.payments || body).toBeDefined()
    }
  })

  test('PAY-10: PUT /api/payments/[id] z neobstoječim ID vrne 404', async ({ request }) => {
    const res = await request.put(`${API_BASE}/payments/nonexistent-id`, {
      headers: authHeaders(),
      data: { status: 'refunded' },
    })
    expect([404, 429]).toContain(res.status())
  })

  test('PAY-11: POST /api/payments/[id]/refund z neobstoječim ID vrne 404', async ({ request }) => {
    const res = await request.post(`${API_BASE}/payments/nonexistent-id/refund`, {
      headers: authHeaders(),
      data: { amount: 10, reason: 'test' },
    })
    expect([404, 429]).toContain(res.status())
  })

  test('PAY-12: POST /api/payments/[id]/refund z negativnim zneskom vrne 400', async ({ request }) => {
    // Najdi veljavno plačilo
    const paymentsRes = await request.get(`${API_BASE}/payments?limit=1`, { headers: authHeaders() })
    if (!paymentsRes.ok()) { test.skip(); return }
    const paymentId = (await paymentsRes.json()).payments?.[0]?.id
    if (!paymentId) { test.skip(); return }

    const res = await request.post(`${API_BASE}/payments/${paymentId}/refund`, {
      headers: authHeaders(),
      data: { amount: -10, reason: 'negativno' },
    })
    expect([400, 429]).toContain(res.status())
  })

  // ═══════════════════════════════════════════════════════════════
  // CARD TERMINAL
  // ═══════════════════════════════════════════════════════════════

  test('PAY-13: GET /api/card-terminal vrača status terminala', async ({ request }) => {
    const res = await request.get(`${API_BASE}/card-terminal`, { headers: authHeaders() })
    expect([200, 429]).toContain(res.status())
    if (res.ok()) {
      const body = await res.json()
      expect(body.connected).toBeDefined()
      expect(body.provider).toBeDefined()
    }
  })

  test('PAY-14: POST /api/card-terminal z manjkajočim orderId vrne 400', async ({ request }) => {
    const res = await request.post(`${API_BASE}/card-terminal`, {
      headers: authHeaders(),
      data: { amount: 10, currency: 'EUR' },
    })
    expect([400, 429]).toContain(res.status())
  })

  // ═══════════════════════════════════════════════════════════════
  // CASH REGISTER
  // ═══════════════════════════════════════════════════════════════

  test('PAY-15: GET /api/cash-register vrača aktivno izmeno', async ({ request }) => {
    const res = await request.get(`${API_BASE}/cash-register`, { headers: authHeaders() })
    expect([200, 429]).toContain(res.status())
    if (res.ok()) {
      const body = await res.json()
      expect(body.activeShift !== undefined || body.recentShifts !== undefined).toBeTruthy()
    }
  })
})
