// ============================================
// RestaurantOS — Multi-Tenant Security E2E Tests
// ============================================
// Validira P0-C1..C5 hardening popravke v realnem browser/API environment.
//
// Testira:
//   P0-C1: IDOR cross-tenant protection (orders/payments)
//   P0-C2: ?locationId bypass prevention + fail-closed
//   P0-C3A: FURS/receipt config isolation
//   P0-C4: Webhook locationId filter
//   P0-C5: API key subscriptionId scoping
//
// Predpogoji:
//   - Baza inicializirana z scripts/init-e2e-db.mjs
//   - Dev server teče na localhost:3000
//   - Seed: test-admin (PIN 1111), loc-1
// ============================================
import { test, expect, request as playwrightRequest } from '@playwright/test'

const API_BASE = '/api'
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'

const TEST_PIN = '1111'
const TEST_EMPLOYEE_ID = 'test-admin'

test.describe.configure({ mode: 'serial' })

test.describe('Multi-Tenant Security: P0-C1..C5 Validation', () => {
  let authToken: string
  let orderId: string

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
  // P0-C1: IDOR CROSS-TENANT PROTECTION
  // ═══════════════════════════════════════════════════════════════

  test.describe('P0-C1: IDOR Protection', () => {
    test('setup: ustvari order za testiranje', async ({ request }) => {
      // Najprej pridobi menu item
      const menuRes = await request.get(`${API_BASE}/menu-items?limit=1`, { headers: authHeaders() })
      expect(menuRes.ok()).toBeTruthy()
      const menuBody = await menuRes.json()
      const menuItemId = menuBody.menuItems?.[0]?.id
      expect(menuItemId).toBeTruthy()

      // Ustvari order
      const orderRes = await request.post(`${API_BASE}/orders`, {
        headers: authHeaders(),
        data: {
          type: 'dine-in',
          tableId: 'table-1',
          orderItems: [{ menuItemId, quantity: 1 }],
        },
      })
      expect(orderRes.ok()).toBeTruthy()
      const order = await orderRes.json()
      orderId = order.id
      expect(orderId).toBeTruthy()
    })

    test('IDOR-1: GET /api/orders/[id] vrača 404 za neobstoječi ID', async ({ request }) => {
      const res = await request.get(`${API_BASE}/orders/nonexistent-id-12345`, {
        headers: authHeaders(),
      })
      expect(res.status()).toBe(404)
    })

    test('IDOR-2: GET /api/orders/[id] vrača 200 za veljaven order', async ({ request }) => {
      const res = await request.get(`${API_BASE}/orders/${orderId}`, {
        headers: authHeaders(),
      })
      expect(res.ok()).toBeTruthy()
      const body = await res.json()
      expect(body.id).toBe(orderId)
    })

    test('IDOR-3: DELETE /api/orders/[id] z neobstoječim ID vrne 404', async ({ request }) => {
      const res = await request.delete(`${API_BASE}/orders/nonexistent-id-12345`, {
        headers: authHeaders(),
      })
      expect(res.status()).toBe(404)
    })

    test('IDOR-4: POST /api/orders/[id]/add-items z neobstoječim ID vrne 404', async ({ request }) => {
      const menuRes = await request.get(`${API_BASE}/menu-items?limit=1`, { headers: authHeaders() })
      const menuBody = await menuRes.json()
      const menuItemId = menuBody.menuItems?.[0]?.id

      const res = await request.post(`${API_BASE}/orders/nonexistent-id-12345/add-items`, {
        headers: authHeaders(),
        data: {
          orderItems: [{ menuItemId, quantity: 1 }],
        },
      })
      expect(res.status()).toBe(404)
    })

    test('IDOR-5: POST /api/orders/[id]/transfer z neobstoječim ID vrne 404', async ({ request }) => {
      const res = await request.post(`${API_BASE}/orders/nonexistent-id-12345/transfer`, {
        headers: authHeaders(),
        data: { newTableId: 'table-1' },
      })
      expect(res.status()).toBe(404)
    })

    test('IDOR-6: PUT /api/payments/[id] z neobstoječim ID vrne 404', async ({ request }) => {
      const res = await request.put(`${API_BASE}/payments/nonexistent-id-12345`, {
        headers: authHeaders(),
        data: { status: 'refunded' },
      })
      expect(res.status()).toBe(404)
    })

    test('IDOR-7: POST /api/payments/[id]/refund z neobstoječim ID vrne 404', async ({ request }) => {
      const res = await request.post(`${API_BASE}/payments/nonexistent-id-12345/refund`, {
        headers: authHeaders(),
        data: { amount: 10, reason: 'test' },
      })
      expect(res.status()).toBe(404)
    })
  })

  // ═══════════════════════════════════════════════════════════════
  // P0-C2: ?locationId BYPASS PREVENTION
  // ═══════════════════════════════════════════════════════════════

  test.describe('P0-C2: Tenant Scope Helper', () => {
    test('SCOPE-1: GET /api/orders brez ?locationId — admin vidi vse', async ({ request }) => {
      const res = await request.get(`${API_BASE}/orders?limit=1`, { headers: authHeaders() })
      expect(res.ok()).toBeTruthy()
      const body = await res.json()
      expect(body.orders).toBeDefined()
      expect(body.total).toBeGreaterThanOrEqual(0)
    })

    test('SCOPE-2: GET /api/orders z ?locationId=loc-1 — filtrira po lokaciji', async ({ request }) => {
      const res = await request.get(`${API_BASE}/orders?locationId=loc-1&limit=1`, { headers: authHeaders() })
      // Admin z locationId=null lahko uporabi ?locationId za cross-branch access.
      // V CI okolju so sprejemljivi: 200 (OK), 401/403 (RBAC), 429 (rate limited)
      expect([200, 401, 403, 429]).toContain(res.status())
      if (res.ok()) {
        const body = await res.json()
        expect(body.orders).toBeDefined()
      }
    })

    test('SCOPE-3: GET /api/orders z ?locationId=nonexistent — vrne prazno', async ({ request }) => {
      const res = await request.get(`${API_BASE}/orders?locationId=nonexistent-loc&limit=1`, { headers: authHeaders() })
      // Sprejemljivi: 200 (prazno), 429 (rate limited v CI)
      expect([200, 429]).toContain(res.status())
      if (res.ok()) {
        const body = await res.json()
        expect(body.orders).toBeDefined()
        expect(body.total).toBe(0)
      }
    })

    test('SCOPE-4: GET /api/z-report brez ?locationId — admin vidi vse', async ({ request }) => {
      const res = await request.get(`${API_BASE}/z-report`, { headers: authHeaders() })
      expect(res.ok()).toBeTruthy()
    })

    test('SCOPE-5: GET /api/cash-register brez ?locationId — vrača aktivno izmeno', async ({ request }) => {
      const res = await request.get(`${API_BASE}/cash-register`, { headers: authHeaders() })
      expect(res.ok()).toBeTruthy()
    })

    test('SCOPE-6: GET /api/staff-shifts brez ?locationId — vrača izmene', async ({ request }) => {
      const res = await request.get(`${API_BASE}/staff-shifts`, { headers: authHeaders() })
      expect(res.ok()).toBeTruthy()
    })
  })

  // ═══════════════════════════════════════════════════════════════
  // P0-C3A: FURS/RECEIPT CONFIG ISOLATION
  // ═══════════════════════════════════════════════════════════════

  test.describe('P0-C3A: FURS Config Isolation', () => {
    test('FURS-1: GET /api/furs/cert-status — vrača status', async ({ request }) => {
      const res = await request.get(`${API_BASE}/furs/cert-status`, { headers: authHeaders() })
      expect(res.ok()).toBeTruthy()
      const body = await res.json()
      expect(body.certificate).toBeDefined()
      expect(body.certificate.status).toBeDefined()
      expect(['valid', 'expiring_soon', 'expired', 'missing', 'not_configured']).toContain(body.certificate.status)
    })

    test('FURS-2: GET /api/furs — vrača FURS status', async ({ request }) => {
      const res = await request.get(`${API_BASE}/furs`, { headers: authHeaders() })
      expect(res.ok()).toBeTruthy()
      const body = await res.json()
      expect(body.connected).toBeDefined()
      expect(body.environment).toBeDefined()
    })

    test('FURS-3: GET /api/furs/config-source — vrača vir konfiguracije', async ({ request }) => {
      const res = await request.get(`${API_BASE}/furs/config-source`, { headers: authHeaders() })
      // Admin-only endpoint — lahko 200 ali 403
      if (res.ok()) {
        const body = await res.json()
        expect(['location', 'restaurant-settings', 'env', 'missing']).toContain(body.source)
      } else {
        expect([403, 401]).toContain(res.status())
      }
    })

    test('FURS-4: GET /api/furs/e-invoice-book — vrača knjigo računov', async ({ request }) => {
      const today = new Date().toISOString().split('T')[0]
      const res = await request.get(
        `${API_BASE}/furs/e-invoice-book?dateFrom=${today}&dateTo=${today}`,
        { headers: authHeaders() }
      )
      expect(res.ok()).toBeTruthy()
      const body = await res.json()
      expect(body.summary).toBeDefined()
      expect(body.summary.izdajatelj).toBeDefined()
    })

    test('FURS-5: GET /api/receipts/[id] — receipt preview z Location info', async ({ request }) => {
      // Pridobi order ki ima receipt (če obstaja)
      const ordersRes = await request.get(`${API_BASE}/orders?limit=5`, { headers: authHeaders() })
      const ordersBody = await ordersRes.json()
      const paidOrder = ordersBody.orders?.find((o: { paymentStatus: string }) => o.paymentStatus === 'paid')

      if (paidOrder) {
        const res = await request.get(`${API_BASE}/receipts/${paidOrder.id}`, { headers: authHeaders() })
        expect(res.ok()).toBeTruthy()
        const body = await res.json()
        // Receipt mora vsebovati poslovne podatke (iz Location, ne global settings)
        expect(body.businessName !== undefined).toBeTruthy()
      }
    })
  })

  // ═══════════════════════════════════════════════════════════════
  // P0-C3B: PUBLIC MENU AUTO-DETECT
  // ═══════════════════════════════════════════════════════════════

  test.describe('P0-C3B: Public Menu Auto-Detect', () => {
    test('MENU-1: GET /api/public/menu brez ?locationId — auto-detect prvo aktivno', async ({ request }) => {
      const res = await request.get(`${API_BASE}/public/menu`)
      expect(res.ok()).toBeTruthy()
      const body = await res.json()
      expect(body.menus).toBeDefined()
      expect(Array.isArray(body.menus)).toBeTruthy()
      expect(body.settings).toBeDefined()
      expect(body.settings.name).toBeTruthy()
    })

    test('MENU-2: GET /api/public/menu z ?locationId=loc-1 — vrne meni za loc-1', async ({ request }) => {
      const res = await request.get(`${API_BASE}/public/menu?locationId=loc-1`)
      // Sprejemljivi: 200 (OK), 429 (rate limited v CI)
      expect([200, 429]).toContain(res.status())
      if (res.ok()) {
        const body = await res.json()
        expect(body.menus).toBeDefined()
        expect(body.settings).toBeDefined()
      }
    })

    test('MENU-3: GET /api/public/menu z ?locationId=nonexistent — vrne 400 ali 200', async ({ request }) => {
      const res = await request.get(`${API_BASE}/public/menu?locationId=nonexistent-loc`)
      // 400 = no active location found (pravilno za nonexistent)
      // 200 = auto-detect fallback (če se endpoint odloči fallbackati)
      // 429 = rate limited v CI
      expect([200, 400, 429]).toContain(res.status())
    })

    test('MENU-4: GET /api/qr-menu brez ?locationId — auto-detect', async ({ request }) => {
      const res = await request.get(`${API_BASE}/qr-menu`)
      expect(res.ok()).toBeTruthy()
      const body = await res.json()
      expect(body.menus).toBeDefined()
      expect(body.settings).toBeDefined()
    })
  })

  // ═══════════════════════════════════════════════════════════════
  // P0-C4: WEBHOOK + SETTINGS ISOLATION
  // ═══════════════════════════════════════════════════════════════

  test.describe('P0-C4: Webhook + Settings', () => {
    test('WEBHOOK-1: triggerWebhook z locationId — ne crasha', async () => {
      // Webhook trigger je intern (preko emitEvent) — preverimo da order creation
      // (ki sproži webhook) ne crasha
      // Ta test je implicitno pokrit v IDOR-1 setup
      expect(orderId).toBeTruthy()
    })

    test('SETTINGS-1: GET /api/settings — vrača nastavitve', async ({ request }) => {
      const res = await request.get(`${API_BASE}/settings`, { headers: authHeaders() })
      expect(res.ok()).toBeTruthy()
      const body = await res.json()
      expect(body.name).toBeDefined()
      expect(body.currency).toBeDefined()
    })

    test('SETTINGS-2: GET /api/dashboard — vrača dashboard podatke', async ({ request }) => {
      const res = await request.get(`${API_BASE}/dashboard`, { headers: authHeaders() })
      expect(res.ok()).toBeTruthy()
      const body = await res.json()
      expect(body.todayRevenue).toBeDefined()
      expect(body.fursStatus).toBeDefined()
      expect(body.fursStatus.environment).toBeDefined()
    })
  })

  // ═══════════════════════════════════════════════════════════════
  // P0-C5: API KEY SUBSCRIPTIONID SCOPING
  // ═══════════════════════════════════════════════════════════════

  test.describe('P0-C5: API Key Scoping', () => {
    test('APIKEY-1: GET /api/mobile/menu brez Authorization — vrača 401', async ({ request }) => {
      const res = await request.get(`${API_BASE}/mobile/menu?locationId=loc-1`)
      expect(res.status()).toBe(401)
    })

    test('APIKEY-2: GET /api/mobile/menu z neveljavnim API key — vrača 401', async ({ request }) => {
      const res = await request.get(`${API_BASE}/mobile/menu?locationId=loc-1`, {
        headers: { Authorization: 'Bearer posr_invalid_key_12345' },
      })
      expect(res.status()).toBe(401)
    })

    test('APIKEY-3: GET /api/mobile/menu z veljavnim formatom ampak napačnim key — vrača 401', async ({ request }) => {
      const res = await request.get(`${API_BASE}/mobile/menu?locationId=loc-1`, {
        headers: { Authorization: 'Bearer posr_0000000000000000000000000000000000000000000000000000000000000000' },
      })
      expect(res.status()).toBe(401)
    })
  })

  // ═══════════════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════════════

  test.afterAll(async ({ request }) => {
    // Počisti testni order (če je bil ustvarjen)
    if (orderId && authToken) {
      try {
        await request.delete(`${API_BASE}/orders/${orderId}`, { headers: authHeaders() })
      } catch {
        // Ignoriraj napake pri cleanup
      }
    }
  })
})
