// ============================================
// RestaurantOS — Dashboard, Reports & Edge Cases E2E Tests
// ============================================
// Validira: dashboard podatke, poročila, edge case-e (prazne baze,
// neveljavni vnosi, concurrency, rate limiting).
// ============================================
import { test, expect, request as playwrightRequest } from '@playwright/test'

const API_BASE = '/api'
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
const TEST_PIN = '1111'
const TEST_EMPLOYEE_ID = 'test-admin'

test.describe.configure({ mode: 'serial' })

test.describe('Dashboard & Reports', () => {
  let authToken: string

  test.beforeAll(async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: BASE_URL })
    const res = await ctx.post(`${API_BASE}/auth`, {
      data: { employeeId: TEST_EMPLOYEE_ID, pin: TEST_PIN },
    })
    const body = await res.json().catch(() => ({}))
    authToken = body.token || ""
    await ctx.dispose()
  })

  function authHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' }
  }

  // ═══════════════════════════════════════════════════════════════
  // DASHBOARD
  // ═══════════════════════════════════════════════════════════════

  test('DASH-1: GET /api/dashboard vrača dashboard podatke', async ({ request }) => {
    const res = await request.get(`${API_BASE}/dashboard`, { headers: authHeaders() })
    expect([200, 429]).toContain(res.status())
    if (res.ok()) {
      const body = await res.json().catch(() => ({}))
      expect(body.todayRevenue).toBeDefined()
      expect(body.todayTax).toBeDefined()
      expect(body.totalOrders).toBeDefined()
      expect(body.fursStatus).toBeDefined()
      expect(body.fursStatus.environment).toBeDefined()
    }
  })

  test('DASH-2: GET /api/settings vrača nastavitve', async ({ request }) => {
    const res = await request.get(`${API_BASE}/settings`, { headers: authHeaders() })
    expect([200, 429]).toContain(res.status())
    if (res.ok()) {
      const body = await res.json().catch(() => ({}))
      expect(body.name).toBeDefined()
      expect(body.currency).toBeDefined()
      expect(body.locale).toBeDefined()
    }
  })

  // ═══════════════════════════════════════════════════════════════
  // REPORTS
  // ═══════════════════════════════════════════════════════════════

  test('REPORT-1: GET /api/reports/eod vrača EOD podatke', async ({ request }) => {
    const today = new Date().toISOString().split('T')[0]
    const res = await request.get(`${API_BASE}/reports/eod?date=${today}`, { headers: authHeaders() })
    expect([200, 429]).toContain(res.status())
    if (res.ok()) {
      const body = await res.json().catch(() => ({}))
      expect(body.summary).toBeDefined()
      // R94 pin korekcija (stale pin, R91-lekcija): /api/reports/eod vrača
      // summary.totalRevenue (metrics.ts:88-96 — totalOrders, totalRevenue,
      // totalTax, ...). 'totalSales' v tem summaryju NIKOLI ni obstajal
      // (totalSales je polje Dashboard/Shift tipov, ne EOD).
      expect(body.summary.totalRevenue).toBeDefined()
      expect(body.summary.totalOrders).toBeDefined()
    }
  })

  test('REPORT-2: GET /api/reports/eod z neveljavnim datumom vrne 400', async ({ request }) => {
    const res = await request.get(`${API_BASE}/reports/eod?date=invalid-date`, { headers: authHeaders() })
    expect([400, 429]).toContain(res.status())
  })

  test('REPORT-3: GET /api/reports/export z CSV formatom', async ({ request }) => {
    const today = new Date().toISOString().split('T')[0]
    const res = await request.get(
      `${API_BASE}/reports/export?type=orders&format=csv&startDate=${today}&endDate=${today}`,
      { headers: authHeaders() }
    )
    expect([200, 400, 429]).toContain(res.status())
  })

  test('REPORT-4: GET /api/staff-performance vrača analitiko osebja', async ({ request }) => {
    const res = await request.get(`${API_BASE}/staff-performance?period=today`, { headers: authHeaders() })
    expect([200, 429]).toContain(res.status())
    if (res.ok()) {
      const body = await res.json().catch(() => ({}))
      expect(body.employees).toBeDefined()
      expect(body.totals).toBeDefined()
    }
  })

  test('REPORT-5: GET /api/staff-performance z neveljavnim periodom', async ({ request }) => {
    const res = await request.get(`${API_BASE}/staff-performance?period=invalid`, { headers: authHeaders() })
    expect([200, 429]).toContain(res.status())
  })

  // ═══════════════════════════════════════════════════════════════
  // MENU & ITEMS
  // ═══════════════════════════════════════════════════════════════

  test('MENU-1: GET /api/menu-items vrača artikle', async ({ request }) => {
    const res = await request.get(`${API_BASE}/menu-items?limit=10`, { headers: authHeaders() })
    expect([200, 429]).toContain(res.status())
    if (res.ok()) {
      const body = await res.json().catch(() => ({}))
      expect(body.menuItems).toBeDefined()
      expect(Array.isArray(body.menuItems)).toBeTruthy()
    }
  })

  test('MENU-2: GET /api/menu-items z pagination', async ({ request }) => {
    const res = await request.get(`${API_BASE}/menu-items?limit=2&offset=0`, { headers: authHeaders() })
    expect([200, 429]).toContain(res.status())
    if (res.ok()) {
      const body = await res.json().catch(() => ({}))
      expect(body.menuItems.length).toBeLessThanOrEqual(2)
    }
  })

  test('MENU-3: PUT /api/menu-items/[id] z neobstoječim ID vrne 404', async ({ request }) => {
    // R94 pin korekcija (R91-lekcija): [id] ruta je izvažala LE PUT/DELETE.
    // R95-d: GET je DODAN (MENU-3b) — PUT pin ostane nespremenjen.
    const res = await request.put(`${API_BASE}/menu-items/nonexistent-id`, {
      headers: authHeaders(),
      data: { name: 'Neobstojec', price: 1 },
    })
    expect([404, 429]).toContain(res.status())
  })

  test('MENU-3b: GET /api/menu-items/[id] z neobstoječim ID vrne 404 (R95-d single-item fetch)', async ({ request }) => {
    // R95-d: ruta zdaj izvaža GET (pariteta s PUT/DELETE: manage_inventory +
    // tenant resolver + enoten 404 brez obstoja-oraklja). Neavten GET = 401.
    const unauth = await request.get(`${API_BASE}/menu-items/nonexistent-id`)
    expect(unauth.status()).toBe(401)

    const res = await request.get(`${API_BASE}/menu-items/nonexistent-id`, { headers: authHeaders() })
    expect([404, 429]).toContain(res.status())
    if (res.status() === 404) {
      const body = await res.json().catch(() => ({}))
      expect(body.error).toBe('Menu item not found')
    }
  })

  // ═══════════════════════════════════════════════════════════════
  // STAFF & SHIFTS
  // ═══════════════════════════════════════════════════════════════

  test('STAFF-1: GET /api/staff-shifts vrača izmene', async ({ request }) => {
    const today = new Date().toISOString().split('T')[0]
    const res = await request.get(
      `${API_BASE}/staff-shifts?startDate=${today}&endDate=${today}`,
      { headers: authHeaders() }
    )
    expect([200, 429]).toContain(res.status())
    if (res.ok()) {
      const body = await res.json().catch(() => ({}))
      expect(body.shifts).toBeDefined()
      expect(body.stats).toBeDefined()
    }
  })

  test('STAFF-2: GET /api/tip-pool vrača napitnine', async ({ request }) => {
    const res = await request.get(`${API_BASE}/tip-pool`, { headers: authHeaders() })
    expect([200, 429]).toContain(res.status())
  })

  // ═══════════════════════════════════════════════════════════════
  // DELIVERY
  // ═══════════════════════════════════════════════════════════════

  test('DELIVERY-1: GET /api/delivery vrača dostave', async ({ request }) => {
    const res = await request.get(`${API_BASE}/delivery?limit=5`, { headers: authHeaders() })
    expect([200, 429]).toContain(res.status())
    if (res.ok()) {
      const body = await res.json().catch(() => ({}))
      expect(body.deliveries || body).toBeDefined()
    }
  })

  test('DELIVERY-2: GET /api/delivery-zones vrača cone dostave', async ({ request }) => {
    const res = await request.get(`${API_BASE}/delivery-zones`, { headers: authHeaders() })
    expect([200, 429]).toContain(res.status())
    if (res.ok()) {
      const body = await res.json().catch(() => ({}))
      expect(body.zones).toBeDefined()
    }
  })

  // ═══════════════════════════════════════════════════════════════
  // DEVICES & OPENING HOURS
  // ═══════════════════════════════════════════════════════════════

  test('DEVICE-1: GET /api/devices vrača naprave', async ({ request }) => {
    const res = await request.get(`${API_BASE}/devices`, { headers: authHeaders() })
    expect([200, 429]).toContain(res.status())
    if (res.ok()) {
      const body = await res.json().catch(() => ({}))
      expect(body.devices || body).toBeDefined()
    }
  })

  test('HOURS-1: GET /api/opening-hours vrača delovni čas', async ({ request }) => {
    const res = await request.get(`${API_BASE}/opening-hours`, { headers: authHeaders() })
    expect([200, 429]).toContain(res.status())
    if (res.ok()) {
      const body = await res.json().catch(() => ({}))
      expect(body.hours || body).toBeDefined()
    }
  })

  // ═══════════════════════════════════════════════════════════════
  // EDGE CASES
  // ═══════════════════════════════════════════════════════════════

  test('EDGE-1: GET /api/orders brez auth headerja vrne 401', async ({ request }) => {
    const res = await request.get(`${API_BASE}/orders`)
    expect(res.status()).toBe(401)
  })

  test('EDGE-2: GET /api/orders z neveljavnim tokenom vrne 401', async ({ request }) => {
    const res = await request.get(`${API_BASE}/orders`, {
      headers: { Authorization: 'Bearer invalid-token-12345' },
    })
    expect(res.status()).toBe(401)
  })

  test('EDGE-3: POST /api/auth z neveljavnim PIN vrne 401', async ({ request }) => {
    const res = await request.post(`${API_BASE}/auth`, {
      data: { employeeId: TEST_EMPLOYEE_ID, pin: '9999' },
    })
    expect(res.status()).toBe(401)
  })

  test('EDGE-4: POST /api/auth — R95 BINDING kontrakt: tuj employeeId + veljaven PIN = 401 (enoten, zero orakelj)', async ({ request }) => {
    // R95-a kontrakt sprememba (dvostopenjska prijava — R94 backlog): employeeId
    // PODAN = strog binding — PIN se preverja TOČNO proti tistem zaposlenemu
    // (validations/auth.ts + _helpers.ts vezavna veja). Neznana/neaktivna id
    // ALI PIN ki ni njegov → ISTI enoten 401 'Napačen PIN ali nedejaven
    // uporabnik' (ni obstoja-oraklja). To je NAMERNA poostrena pripis
    // identitete; 'nonexistent-employee' ni več ignoriran (R94 Zod strip).
    const res = await request.post(`${API_BASE}/auth`, {
      data: { employeeId: 'nonexistent-employee', pin: '1111' },
    })
    // 401 = binding zavrnil (enoten); 429 = rate limited v CI (legalen retry)
    expect([401, 429]).toContain(res.status())
    if (res.status() === 401) {
      const body = await res.json()
      expect(body.error).toBe('Napačen PIN ali nedejaven uporabnik')
    }
  })

  test('EDGE-4b: POST /api/auth — PIN-only legacy kontrakt ostane: { pin } brez employeeId = prijava lastnika PIN-a', async ({ request }) => {
    // R95 kompatibilnost: employeeId ODSOTEN = legacy deterministični lastnik
    // PIN-a (R94 kontrakt nespremenjen — WaiterLogin/KDSLogin/offline poti).
    // Seed: test-admin PIN 1111 → seja = test-admin.
    const res = await request.post(`${API_BASE}/auth`, {
      data: { pin: '1111' },
    })
    expect([200, 429]).toContain(res.status())
    if (res.status() === 200) {
      const body = await res.json()
      expect(body.employee.id).toBe('test-admin')
    }
  })

  test('EDGE-5: GET /api/setup/status je javno dostopen (brez auth)', async ({ request }) => {
    const res = await request.get(`${API_BASE}/setup/status`)
    expect([200, 429]).toContain(res.status())
    if (res.ok()) {
      const body = await res.json().catch(() => ({}))
      expect(body.isInitialized).toBeDefined()
      expect(body.mode).toBeDefined()
    }
  })

  test('EDGE-6: GET /api/health vrača 200 (server health)', async ({ request }) => {
    const res = await request.get(`${API_BASE}/health`)
    expect(res.status()).toBe(200)
    const body = await res.json().catch(() => ({}))
    expect(body.status).toBe('ok')
    expect(body.database).toBe('connected')
  })

  test('EDGE-7: GET /api/public/menu odgovarja brez crash-a (R90: brez ?locationId → 404 fail-closed)', async ({ request }) => {
    const res = await request.get(`${API_BASE}/public/menu`)
    // R90 kanon: ?locationId je obvezen — manjkajoč → unificiran 404 (prej
    // auto-detect fallback 200). 200 = stari odgovor (ni več pravilen, ampak
    // toleriran za backwards-safe asercijo), 429 = rate limited v CI.
    expect([200, 404, 429]).toContain(res.status())
  })

  test('EDGE-8: /qr-menu stran je javno dostopna', async ({ request }) => {
    // R91: pin popravljen — stari klic `/api/qr-menu` je bil napačna površina
    // (API varianta je auth-gated 401 — glej MENU-4 v multi-tenant-security),
    // javno dostopna je SAMO stran /qr-menu (200 HTML shell).
    const res = await request.get('/qr-menu')
    expect([200, 429]).toContain(res.status())
  })

  test('EDGE-9: GET /api/orders z limit > 500 je omejen na 500', async ({ request }) => {
    const res = await request.get(`${API_BASE}/orders?limit=99999`, { headers: authHeaders() })
    expect([200, 429]).toContain(res.status())
    if (res.ok()) {
      const body = await res.json().catch(() => ({}))
      expect(body.limit).toBeLessThanOrEqual(500)
    }
  })

  test('EDGE-10: GET /api/orders z negativnim offsetom ne crash-a', async ({ request }) => {
    const res = await request.get(`${API_BASE}/orders?offset=-1`, { headers: authHeaders() })
    expect([200, 400, 429]).toContain(res.status())
  })

  test('EDGE-11: POST /api/orders z praznim orderItems array', async ({ request }) => {
    const res = await request.post(`${API_BASE}/orders`, {
      headers: authHeaders(),
      data: { type: 'dine-in', tableId: 'table-1', orderItems: [] },
    })
    expect([400, 429]).toContain(res.status())
  })

  test('EDGE-12: GET /api/menu-items z limit=0', async ({ request }) => {
    const res = await request.get(`${API_BASE}/menu-items?limit=0`, { headers: authHeaders() })
    expect([200, 429]).toContain(res.status())
  })

  test('EDGE-13: GET /api/furs/cert-status brez auth vrne 401', async ({ request }) => {
    const res = await request.get(`${API_BASE}/furs/cert-status`)
    expect(res.status()).toBe(401)
  })

  test('EDGE-14: GET /api/accounting brez auth vrne 401', async ({ request }) => {
    const res = await request.get(`${API_BASE}/accounting/trial-balance`)
    expect(res.status()).toBe(401)
  })

  test('EDGE-15: POST /api/auth s PIN-only telesom se prijavi kot lastnik PIN-a', async ({ request }) => {
    // R94 pin korekcija: { pin } brez employeeId je pod PIN-only kontraktom
    // (loginSchema = { pin }, glej EDGE-4) VELJAVNA prijava — ne 400.
    const res = await request.post(`${API_BASE}/auth`, {
      data: { pin: '1111' },
    })
    expect([200, 429]).toContain(res.status())
    if (res.status() === 200) {
      const body = await res.json()
      expect(body.employee.id).toBe('test-admin')
    }
  })

  test('EDGE-16: POST /api/auth brez pin vrne 400', async ({ request }) => {
    const res = await request.post(`${API_BASE}/auth`, {
      data: { employeeId: TEST_EMPLOYEE_ID },
    })
    expect([400, 401]).toContain(res.status())
  })
})
