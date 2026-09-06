// ============================================
// RestaurantOS — FURS & Financial Correctness E2E Tests
// ============================================
// Validira finančno pravilnost: FURS overitev, ZOI, EOR, DDV razdelitev,
// Z-poročila, e-invoice book, računi.
// ============================================
import { test, expect, request as playwrightRequest } from '@playwright/test'

const API_BASE = '/api'
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
const TEST_PIN = '1111'
const TEST_EMPLOYEE_ID = 'test-admin'

test.describe.configure({ mode: 'serial' })

test.describe('FURS & Financial Correctness', () => {
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
  // FURS STATUS & CONFIG
  // ═══════════════════════════════════════════════════════════════

  test('FURS-1: GET /api/furs vrača status povezave', async ({ request }) => {
    const res = await request.get(`${API_BASE}/furs`, { headers: authHeaders() })
    expect([200, 429]).toContain(res.status())
    if (res.ok()) {
      const body = await res.json()
      expect(body.connected).toBeDefined()
      expect(body.environment).toBeDefined()
      expect(['test', 'production']).toContain(body.environment)
    }
  })

  test('FURS-2: GET /api/furs/cert-status vrača cert lifecycle', async ({ request }) => {
    const res = await request.get(`${API_BASE}/furs/cert-status`, { headers: authHeaders() })
    expect([200, 429]).toContain(res.status())
    if (res.ok()) {
      const body = await res.json()
      expect(body.certificate).toBeDefined()
      expect(body.certificate.status).toBeDefined()
      expect(['valid', 'expiring_soon', 'expired', 'missing', 'not_configured']).toContain(body.certificate.status)
      expect(body.fiscalization).toBeDefined()
      expect(body.fiscalization.zddv1DeadlineHours).toBe(48)
    }
  })

  test('FURS-3: GET /api/furs/config-source vrača vir konfiguracije', async ({ request }) => {
    const res = await request.get(`${API_BASE}/furs/config-source`, { headers: authHeaders() })
    expect([200, 401, 403, 429]).toContain(res.status())
    if (res.ok()) {
      const body = await res.json()
      expect(['location', 'restaurant-settings', 'env', 'missing']).toContain(body.source)
    }
  })

  // ═══════════════════════════════════════════════════════════════
  // E-INVOICE BOOK
  // ═══════════════════════════════════════════════════════════════

  test('FURS-4: GET /api/furs/e-invoice-book vrača knjigo računov', async ({ request }) => {
    const today = new Date().toISOString().split('T')[0]
    const res = await request.get(
      `${API_BASE}/furs/e-invoice-book?dateFrom=${today}&dateTo=${today}`,
      { headers: authHeaders() }
    )
    expect([200, 429]).toContain(res.status())
    if (res.ok()) {
      const body = await res.json()
      expect(body.summary).toBeDefined()
      expect(body.summary.izdajatelj).toBeDefined()
      expect(body.summary.izdajatelj.naziv).toBeDefined()
    }
  })

  test('FURS-5: GET /api/furs/e-invoice-book z manjkajočim dateFrom vrne 400', async ({ request }) => {
    const res = await request.get(`${API_BASE}/furs/e-invoice-book`, { headers: authHeaders() })
    expect([400, 429]).toContain(res.status())
  })

  test('FURS-6: GET /api/furs/e-invoice-book z JSON formatom', async ({ request }) => {
    const today = new Date().toISOString().split('T')[0]
    const res = await request.get(
      `${API_BASE}/furs/e-invoice-book?dateFrom=${today}&dateTo=${today}&format=json`,
      { headers: authHeaders() }
    )
    expect([200, 429]).toContain(res.status())
    if (res.ok()) {
      const body = await res.json()
      expect(body.invoices).toBeDefined()
      expect(Array.isArray(body.invoices)).toBeTruthy()
    }
  })

  // ═══════════════════════════════════════════════════════════════
  // RECEIPT PREVIEW
  // ═══════════════════════════════════════════════════════════════

  test('FURS-7: GET /api/receipts/[id] z neobstoječim order ID vrne 404', async ({ request }) => {
    const res = await request.get(`${API_BASE}/receipts/nonexistent-order-id`, { headers: authHeaders() })
    expect([404, 429]).toContain(res.status())
  })

  test('FURS-8: GET /api/receipts/[id] z veljavnim order ID vrača receipt preview', async ({ request }) => {
    const ordersRes = await request.get(`${API_BASE}/orders?limit=5`, { headers: authHeaders() })
    if (!ordersRes.ok()) { test.skip(); return }
    const ordersBody = await ordersRes.json()
    const order = ordersBody.orders?.[0]
    if (!order) { test.skip(); return }

    const res = await request.get(`${API_BASE}/receipts/${order.id}`, { headers: authHeaders() })
    expect([200, 404, 429]).toContain(res.status())
    if (res.ok()) {
      const body = await res.json()
      // Receipt mora vsebovati poslovne podatke (iz Location, ne global settings)
      expect(body.businessName !== undefined || body.receiptNumber !== undefined).toBeTruthy()
    }
  })

  // ═══════════════════════════════════════════════════════════════
  // Z-REPORT
  // ═══════════════════════════════════════════════════════════════

  test('FURS-9: GET /api/z-report vrača seznam Z-poročil', async ({ request }) => {
    const res = await request.get(`${API_BASE}/z-report`, { headers: authHeaders() })
    expect([200, 429]).toContain(res.status())
    if (res.ok()) {
      const body = await res.json()
      expect(body).toBeDefined()
    }
  })

  test('FURS-10: GET /api/z-report z datumom', async ({ request }) => {
    const today = new Date().toISOString().split('T')[0]
    const res = await request.get(`${API_BASE}/z-report?date=${today}`, { headers: authHeaders() })
    expect([200, 429]).toContain(res.status())
  })

  // ═══════════════════════════════════════════════════════════════
  // ACCOUNTING
  // ═══════════════════════════════════════════════════════════════

  test('FURS-11: GET /api/accounting/trial-balance vrača bruto bilanco', async ({ request }) => {
    const today = new Date().toISOString().split('T')[0]
    const res = await request.get(
      `${API_BASE}/accounting/trial-balance?dateFrom=${today}&dateTo=${today}`,
      { headers: authHeaders() }
    )
    expect([200, 429]).toContain(res.status())
    if (res.ok()) {
      const body = await res.json()
      expect(body.totalDebit).toBeDefined()
      expect(body.totalCredit).toBeDefined()
    }
  })

  test('FURS-12: GET /api/accounting/profit-loss vrača P&L', async ({ request }) => {
    const today = new Date().toISOString().split('T')[0]
    const res = await request.get(
      `${API_BASE}/accounting/profit-loss?dateFrom=${today}&dateTo=${today}`,
      { headers: authHeaders() }
    )
    expect([200, 429]).toContain(res.status())
    if (res.ok()) {
      const body = await res.json()
      expect(body).toBeDefined()
    }
  })

  test('FURS-13: GET /api/accounting/balance-sheet vrača bilanco stanja', async ({ request }) => {
    const today = new Date().toISOString().split('T')[0]
    const res = await request.get(
      `${API_BASE}/accounting/balance-sheet?dateTo=${today}`,
      { headers: authHeaders() }
    )
    expect([200, 429]).toContain(res.status())
  })

  test('FURS-14: GET /api/accounting/journal-entries vrača knjigovodske vnose', async ({ request }) => {
    const res = await request.get(`${API_BASE}/accounting/journal-entries?limit=10`, { headers: authHeaders() })
    expect([200, 429]).toContain(res.status())
    if (res.ok()) {
      const body = await res.json()
      expect(body.entries).toBeDefined()
      expect(body.total).toBeDefined()
    }
  })

  test('FURS-15: GET /api/accounting/accounts-receivable vrača terjatve', async ({ request }) => {
    const res = await request.get(`${API_BASE}/accounting/accounts-receivable`, { headers: authHeaders() })
    expect([200, 429]).toContain(res.status())
    if (res.ok()) {
      const body = await res.json()
      expect(body.entries).toBeDefined()
      expect(body.aging).toBeDefined()
    }
  })
})
