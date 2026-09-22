// ============================================
// RestaurantOS — P1-observability E2E dim
// ============================================
// Preveri, da monitoring endpointa delujeta end-to-end:
//   - GET /api/monitoring/metrics (register + DB gorice)
//   - GET /api/monitoring/alerts (8 alert pravil)
//   - POST /api/monitoring/backup-heartbeat (secret-protected)
// ============================================
import { test, expect, request as playwrightRequest } from '@playwright/test'

const API_BASE = '/api'
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
const TEST_PIN = '1111'
const TEST_EMPLOYEE_ID = 'test-admin'

test.describe('Observability monitoring endpointa', () => {
  let authToken: string

  test.beforeAll(async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: BASE_URL })
    const res = await ctx.post(`${API_BASE}/auth`, {
      data: { employeeId: TEST_EMPLOYEE_ID, pin: TEST_PIN },
    })
    // FAIL-FAST (v1.3.1 CI fix): prej se token ni preveril — če je prijava padla
    // (npr. 429 rate limit ob retryjih), je authToken ostal undefined in so
    // vsi testi padli na 401, kar je prikrilo pravi vzrok. Zdaj prijava pade
    // TUKAJ z jasnim sporočilom.
    expect(res.ok()).toBeTruthy()
    const body = await res.json().catch(() => ({}))
    authToken = body.token
    expect(authToken).toBeTruthy()
    await ctx.dispose()
  })

  function authHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' }
  }

  test('OBS-1: /api/monitoring/metrics vrača register + DB gorice', async ({ request }) => {
    const res = await request.get(`${API_BASE}/monitoring/metrics`, { headers: authHeaders() })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()

    // In-process register
    expect(Array.isArray(body.metrics)).toBe(true)
    expect(body.process.uptimeSeconds).toBeGreaterThanOrEqual(0)
    // E2E je zagnal vsaj eno prijavo + več DB poizvedb (instrumentacija živa)
    const names = body.metrics.map((m: { name: string }) => m.name)
    expect(names).toContain('auth_login_success_total')
    expect(names).toContain('db_query_latency_ms')
    const dbLatency = body.metrics.find((m: { name: string }) => m.name === 'db_query_latency_ms')
    expect(dbLatency.stats.count).toBeGreaterThan(0)

    // DB gorice
    expect(body.db.outbox).toHaveProperty('pending')
    expect(body.db.reconciliation).toHaveProperty('paymentsWithoutJournal')
    expect(body.db.inventory).toHaveProperty('negativeCount')
  })

  test('OBS-2: /api/monitoring/alerts vrača strukturo 8 pravil (brez kritičnih na sveži bazi)', async ({ request }) => {
    const res = await request.get(`${API_BASE}/monitoring/alerts`, { headers: authHeaders() })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()

    expect(body.summary).toHaveProperty('critical')
    expect(body.summary).toHaveProperty('warning')
    expect(Array.isArray(body.alerts)).toBe(true)
    // Sveža E2E baza: FURS simulacija NI napaka, vrsta je prazna, zaloga pozitivna,
    // veriga je veljavna → edina pričakovana vrsta je backup_not_configured (info)
    for (const alert of body.alerts) {
      expect(alert.severity).not.toBe('critical')
    }
  })

  test('OBS-3: backup heartbeat je zavrnjen brez CRON_SECRET (fail-closed)', async ({ request }) => {
    const res = await request.post(`${API_BASE}/monitoring/backup-heartbeat`, {
      headers: authHeaders(),
      data: {},
    })
    // Admin token NI dovoljen — samo CRON_SECRET bearer (posreden klic mora padti)
    expect([401, 403]).toContain(res.status())
  })

  test('OBS-4: monitoring endpointi zahtevajo admin dovoljenje', async ({ request }) => {
    const noAuth = await request.get(`${API_BASE}/monitoring/metrics`)
    expect([401, 403]).toContain(noAuth.status())
  })
})
