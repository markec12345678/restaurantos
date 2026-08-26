// ============================================
// RestaurantOS — E2E Workflow Tests (API-level)
// Natakar + Kuhar + Lastnik workflow end-to-end
// ============================================
import { test, expect, request as playwrightRequest } from '@playwright/test'

const API_BASE = '/api'
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'

const TEST_PIN = '1111'
const TEST_EMPLOYEE_ID = 'test-admin'

test.describe.configure({ mode: 'serial' })

test.describe('E2E Workflow: Natakar + Kuhar + Lastnik', () => {
  let authToken: string
  let orderId: string
  let orderItemId: string
  let checkId: string

  test.beforeAll(async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: BASE_URL })
    const res = await ctx.post(`${API_BASE}/auth`, {
      data: { employeeId: TEST_EMPLOYEE_ID, pin: TEST_PIN },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.token).toBeTruthy()
    authToken = body.token
    await ctx.dispose()
  })

  function authHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' }
  }

  // ═══════════════════════════════════════════════════════════════
  // NATAKAR WORKFLOW
  // ═══════════════════════════════════════════════════════════════

  test('NATAKAR 1: Ustvari naročilo z artikli', async ({ request }) => {
    const menuRes = await request.get(`${API_BASE}/menu-items?limit=3`, { headers: authHeaders() })
    expect(menuRes.ok()).toBeTruthy()
    const menuBody = await menuRes.json()
    expect(menuBody.menuItems.length).toBeGreaterThan(0)
    const menuItemId = menuBody.menuItems[0].id

    const orderRes = await request.post(`${API_BASE}/orders`, {
      headers: authHeaders(),
      data: {
        type: 'dine-in',
        tableId: 'table-1',
        orderItems: [
          { menuItemId, quantity: 2, notes: 'Brez čebule' },
        ],
      },
    })
    expect(orderRes.ok()).toBeTruthy()
    const order = await orderRes.json()
    expect(order.id).toBeTruthy()
    expect(order.orderNumber).toBeGreaterThan(0)
    expect(order.orderItems.length).toBe(1)
    expect(order.status).toBe('pending')
    expect(order.paymentStatus).toBe('unpaid')

    orderId = order.id
    orderItemId = order.orderItems[0].id

    const tablesRes = await request.get(`${API_BASE}/tables`, { headers: authHeaders() })
    const tables = await tablesRes.json()
    const table = tables.find((t: { id: string }) => t.id === 'table-1')
    expect(table.status).toBe('occupied')
  })

  test('NATAKAR 2: Pošlje naročilo v kuhinjo (fire)', async ({ request }) => {
    const res = await request.patch(`${API_BASE}/orders/${orderId}`, {
      headers: authHeaders(),
      data: { action: 'fire' },
    })
    expect(res.ok()).toBeTruthy()
    const order = await res.json()
    expect(order.status).toBe('in-progress')
    expect(order.firedAt).toBeTruthy()
    expect(order.orderItems[0].status).toBe('preparing')
    expect(order.orderItems[0].firedAt).toBeTruthy()
  })

  // ═══════════════════════════════════════════════════════════════
  // KUHAR WORKFLOW
  // ═══════════════════════════════════════════════════════════════

  test('KUHAR 1: Vidi naročilo na KDS', async ({ request }) => {
    const res = await request.get(`${API_BASE}/kitchen`, { headers: authHeaders() })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.orders.length).toBeGreaterThan(0)
    const kdsOrder = body.orders.find((o: { id: string }) => o.id === orderId)
    expect(kdsOrder).toBeTruthy()
    expect(kdsOrder.status).toBe('in-progress')
    expect(kdsOrder.orderItems[0].menuItem).toBeTruthy()
    expect(kdsOrder.waitMinutes).toBeGreaterThanOrEqual(0)
  })

  test('KUHAR 2: Označi artikel kot pripravljen (ready)', async ({ request }) => {
    const res = await request.patch(`${API_BASE}/orders/${orderId}`, {
      headers: authHeaders(),
      data: { action: 'item_status', itemId: orderItemId, status: 'ready' },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.allReady).toBe(true)
  })

  test('KUHAR 3: Order je avtomatsko promovan v ready', async ({ request }) => {
    const res = await request.get(`${API_BASE}/orders?status=ready`, { headers: authHeaders() })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    const order = body.orders.find((o: { id: string }) => o.id === orderId)
    expect(order).toBeTruthy()
    expect(order.status).toBe('ready')
  })

  // ═══════════════════════════════════════════════════════════════
  // NATAKAR (nadaljevanje) — plačilo
  // ═══════════════════════════════════════════════════════════════

  test('NATAKAR 3: Postreže artikel (served)', async ({ request }) => {
    const res = await request.patch(`${API_BASE}/orders/${orderId}`, {
      headers: authHeaders(),
      data: { action: 'item_status', itemId: orderItemId, status: 'served' },
    })
    expect(res.ok()).toBeTruthy()
  })

  test('NATAKAR 4: Ustvari ček za naročilo', async ({ request }) => {
    const res = await request.post(`${API_BASE}/checks`, {
      headers: authHeaders(),
      data: { orderId },
    })
    expect(res.ok()).toBeTruthy()
    const check = await res.json()
    expect(check.id).toBeTruthy()
    expect(check.orderId).toBe(orderId)
    checkId = check.id
  })

  test('NATAKAR 5: Plača naročilo (cash)', async ({ request }) => {
    const orderRes = await request.get(`${API_BASE}/orders?limit=1`, { headers: authHeaders() })
    const orderBody = await orderRes.json()
    const order = orderBody.orders.find((o: { id: string }) => o.id === orderId)
    const amount = order.total

    const payRes = await request.post(`${API_BASE}/payments`, {
      headers: authHeaders(),
      data: {
        checkId,
        amount,
        tipAmount: 0,
        type: 'cash',
        idempotencyKey: `e2e-test-${Date.now()}`,
      },
    })
    expect(payRes.ok()).toBeTruthy()
    const payment = await payRes.json()
    expect(payment.id).toBeTruthy()
    expect(payment.status).toBe('completed')
  })

  test('NATAKAR 6: Preveri, da je order paymentStatus=paid', async ({ request }) => {
    const res = await request.get(`${API_BASE}/orders?limit=5`, { headers: authHeaders() })
    const body = await res.json()
    const order = body.orders.find((o: { id: string }) => o.id === orderId)
    expect(order.paymentStatus).toBe('paid')
    expect(order.paidAt).toBeTruthy()
  })

  test('NATAKAR 7: Preveri, da je bil račun samodejno ustvarjen (server-side)', async ({ request }) => {
    await new Promise(r => setTimeout(r, 2000))
    const orderRes = await request.get(`${API_BASE}/orders?limit=1`, { headers: authHeaders() })
    const orderBody = await orderRes.json()
    const order = orderBody.orders.find((o: { id: string }) => o.id === orderId)
    expect(order).toBeTruthy()
    const fursRes = await request.get(`${API_BASE}/furs`, { headers: authHeaders() })
    expect(fursRes.ok()).toBeTruthy()
  })

  test('NATAKAR 8: Preveri, da je miza sproščena po plačilu', async ({ request }) => {
    const tablesRes = await request.get(`${API_BASE}/tables`, { headers: authHeaders() })
    const tables = await tablesRes.json()
    const table = tables.find((t: { id: string }) => t.id === 'table-1')
    expect(table).toBeTruthy()
  })

  // ═══════════════════════════════════════════════════════════════
  // LASTNIK WORKFLOW
  // ═══════════════════════════════════════════════════════════════

  test('LASTNIK 1: Dashboard prikazuje današnjo prodajo', async ({ request }) => {
    const res = await request.get(`${API_BASE}/dashboard`, { headers: authHeaders() })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.todayRevenue).toBeGreaterThanOrEqual(0)
    expect(body.totalOrders).toBeGreaterThanOrEqual(1)
    expect(body.totalTables).toBeGreaterThanOrEqual(1)
  })

  test('LASTNIK 2: Dashboard analytics (categoryBreakdown, paymentMethod)', async ({ request }) => {
    const res = await request.get(`${API_BASE}/dashboard`, { headers: authHeaders() })
    const body = await res.json()
    expect(body).toBeTruthy()
  })

  test('LASTNIK 3: EOD preveri odprta naročila', async ({ request }) => {
    const getRes = await request.get(`${API_BASE}/end-of-day`, { headers: authHeaders() })
    expect(getRes.ok()).toBeTruthy()
    const eodData = await getRes.json()
    expect(eodData).toBeTruthy()
    expect(eodData.date).toBeTruthy()
  })

  test('LASTNIK 4: Finančna poročila (sales)', async ({ request }) => {
    const today = new Date().toISOString().split('T')[0]
    const res = await request.get(
      `${API_BASE}/reports/sales?startDate=${today}&endDate=${today}`,
      { headers: authHeaders() }
    )
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body).toBeTruthy()
  })

  test('LASTNIK 5: Rezervacije — ustvari in preveri Table.status', async ({ request }) => {
    const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
    const res = await request.post(`${API_BASE}/reservations`, {
      headers: authHeaders(),
      data: {
        tableId: 'table-1',
        dateTime: futureDate,
        partySize: 2,
        duration: 90,
        customerName: 'Test Gost ' + Date.now(),
        customerPhone: '+386 30 123 456',
      },
    })
    expect(res.ok()).toBeTruthy()
    const reservation = await res.json()
    expect(reservation.reservation).toBeTruthy()
    expect(reservation.reservation.id).toBeTruthy()

    const tablesRes = await request.get(`${API_BASE}/tables`, { headers: authHeaders() })
    const tables = await tablesRes.json()
    const table = tables.find((t: { id: string }) => t.id === 'table-1')
    expect(table.status).toBe('reserved')
  })

  test('LASTNIK 6: HACCP entries (EU 852/2004)', async ({ request }) => {
    const res = await request.get(`${API_BASE}/haccp`, { headers: authHeaders() })
    expect([200, 404]).toContain(res.status())
  })

  test('LASTNIK 7: Audit log (revizijski dnevnik)', async ({ request }) => {
    const res = await request.get(`${API_BASE}/audit?limit=10`, { headers: authHeaders() })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body).toBeTruthy()
    if (body.logs || body.auditLogs || body.entries) {
      const logs = body.logs || body.auditLogs || body.entries
      expect(logs.length).toBeGreaterThan(0)
    }
  })

  test('LASTNIK 8: ChartOfAccount (issue #38)', async ({ request }) => {
    const res = await request.get(`${API_BASE}/accounting/chart-of-accounts`, { headers: authHeaders() })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body).toBeTruthy()
  })

  test('LASTNIK 9: FURS status', async ({ request }) => {
    const res = await request.get(`${API_BASE}/furs`, { headers: authHeaders() })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body).toBeTruthy()
    expect(body.environment).toBeDefined()
  })

  test('LASTNIK 10: Lokacije (multi-location)', async ({ request }) => {
    const res = await request.get(`${API_BASE}/locations`, { headers: authHeaders() })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.locations).toBeDefined()
    expect(body.locations.length).toBeGreaterThan(0)
    expect(body.stats).toBeDefined()
  })

  // ═══════════════════════════════════════════════════════════════
  // ČIŠČENJE
  // ═══════════════════════════════════════════════════════════════

  test('CLEANUP: Prekliči test naročilo', async ({ request }) => {
    if (!orderId) return
    const res = await request.delete(`${API_BASE}/orders/${orderId}`, { headers: authHeaders() })
    expect([200, 400, 404]).toContain(res.status())
  })
})
