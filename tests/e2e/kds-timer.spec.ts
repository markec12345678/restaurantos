// ============================================
// RestaurantOS — R116 P1: KDS TIMER REGRESSION (firedAt → KDS timer)
// ============================================
// DOKAZUJE POVEZAVO firedAt → KDS časovnik (ne samo "firedAt != null"):
//
//   1. Sales oddaja: POST /api/orders → firedAt = T0 (≈ createdAt)
//   2. realna pauza ≥ 26 s → PATCH action=fire → re-fire semantika
//      OVERWRITE firedAt = T1 (razlika createdAt vs firedAt ≥ 25 s)
//   3. /kds v brskalniku → časovnik kartice (mm:ss) se bere iz DOM
//   4. asercija: |parsing(časovnik) − (now − firedAt)| ≤ 10 s
//
// Če bi časovnik regresoiral na createdAt, bi bil off za ≥ 25 s (pauza
// iz koraka 2) → test PADE. Če bi regresoiral na R114 "--:--", bi bil
// parsing nemogoč → test PADE. Tako je dokazana vir resnice = firedAt.
//
// Pogoj: init-e2e-db seed (test-admin PIN 1111, loc-1, mi-*).
// Zaženi z: scripts/e2e-chunk-once.sh kds-timer.spec.ts
// ============================================
import { test, expect, request as playwrightRequest } from '@playwright/test'

const API_BASE = '/api'
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'
const TEST_PIN = '1111'
const TEST_EMPLOYEE_ID = 'test-admin'

test.describe('R116: KDS timer temelji na firedAt', () => {
  let authToken: string

  test.beforeAll(async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: BASE_URL })
    const res = await ctx.post(`${API_BASE}/auth`, {
      data: { employeeId: TEST_EMPLOYEE_ID, pin: TEST_PIN },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.success).toBe(true)
    authToken = body.token
    await ctx.dispose()
  })

  function authHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' }
  }

  test('Sales oddaja → fire → KDS timer = elapsed(firedAt), ne createdAt, ne --:--', async ({ request, page }) => {
    test.setTimeout(240_000) // realna pauza 26 s + /kds navigacija + polling

    // ── 1. Sales oddaja (POST /api/orders = trenutek pošiljanja v kuhinjo) ──
    const menuRes = await request.get(`${API_BASE}/menu-items?limit=5`, { headers: authHeaders() })
    expect(menuRes.ok()).toBeTruthy()
    const menuBody = await menuRes.json()
    const menuItemId = (menuBody.menuItems?.[0]?.id) as string
    expect(menuItemId).toBeTruthy()

    const key = `e2e-kds-timer-${Date.now()}`
    const createRes = await request.post(`${API_BASE}/orders?locationId=loc-1`, {
      headers: authHeaders(),
      data: {
        type: 'takeout', // brez mize — ne pušča stanja miz
        orderItems: [{ menuItemId, quantity: 1 }],
        idempotencyKey: key,
      },
    })
    expect(createRes.ok()).toBeTruthy()
    const order = await createRes.json()
    expect(order.status).toBe('pending')
    // R115 invariant: Sales oddaja VEDNO žiga firedAt
    expect(order.firedAt).toBeTruthy()
    const createdAtMs = new Date(order.createdAt).getTime()
    const firedAt0Ms = new Date(order.firedAt).getTime()
    expect(Math.abs(firedAt0Ms - createdAtMs)).toBeLessThan(5_000) // Sales: isti dogodek

    // ── 2. realna pauza → fire (re-fire semantika OVERWRITE firedAt = T1) ──
    // 26 s: mm:ss razlika med viri resnice je deterministično vidna
    // (createdAt-based časovnik bi bil ≥ 26 s off).
    await new Promise((r) => setTimeout(r, 26_000))

    const fireRes = await request.patch(`${API_BASE}/orders/${order.id}`, {
      headers: authHeaders(),
      data: { action: 'fire' },
    })
    expect(fireRes.ok()).toBeTruthy()
    const fired = await fireRes.json()
    expect(fired.status).toBe('in-progress')

    // Premisa testa MORA držati: firedAt se je premaknil za ≥ 25 s od createdAt
    const firedAtMs = new Date(fired.firedAt).getTime()
    const gapMs = firedAtMs - createdAtMs
    expect(gapMs).toBeGreaterThanOrEqual(25_000)
    // Re-fire je OVERWRITE (nov firedAt), ne ohranjanje starega
    expect(fired.firedAt).not.toBe(order.firedAt)

    // ── 3. /kds v brskalniku (seja prek localStorage — isti kanon kot /kds app) ──
    await page.addInitScript(
      ({ token, employeeId }) => {
        window.localStorage.setItem('pos_token', token)
        window.localStorage.setItem(
          'pos_employee',
          JSON.stringify({ id: employeeId, name: 'Test Admin', role: 'admin' }),
        )
      },
      { token: authToken, employeeId: TEST_EMPLOYEE_ID },
    )
    await page.goto('/kds', { timeout: 120_000 })

    // Kartica naročila (po orderNumber — word-boundary, ne substring)
    const card = page
      .locator('.card-lift')
      .filter({ hasText: new RegExp(`\\b${order.orderNumber}\\b`) })
    await expect(card).toBeVisible({ timeout: 45_000 })

    // ── 4. časovnik iz DOM = elapsed(firedAt) ± 10 s ──
    const timerEl = card.locator('.kds-timer-badge').first()
    await expect(timerEl).toBeVisible()
    const timerText = (await timerEl.textContent())?.trim() ?? ''

    // R114 regresija: NIKOLI "--:--" za Sales naročilo
    expect(timerText).not.toBe('--:--')
    expect(timerText).toMatch(/^\d{2}:\d{2}$/)

    const [mm, ss] = timerText.split(':').map(Number)
    const renderedSeconds = mm * 60 + ss
    const expectedSeconds = Math.floor((Date.now() - firedAtMs) / 1000)
    // POVEZAVA DOKAZANA: odčitek sledi firedAt (ne createdAt — ta bi bil
    // off za gapMs ≥ 25 s; ne createdAt+fallback, ne created now)
    expect(Math.abs(renderedSeconds - expectedSeconds)).toBeLessThanOrEqual(10)
    // Eksplicitno: odčitek je MANJŠI od elapsed(createdAt) − 15 s
    // (createdAt-based bi bil vsaj gapMs − 10 = ≥ 15 s večji)
    const createdAtSeconds = Math.floor((Date.now() - createdAtMs) / 1000)
    expect(renderedSeconds).toBeLessThan(createdAtSeconds - 15)
  })
})
