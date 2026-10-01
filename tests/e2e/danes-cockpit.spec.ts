// ============================================
// RestaurantOS — #148 korak 2 (R204): DANES COCKPIT NEGATIVNI E2E
// ============================================
// Issue #148 §16 (failure injection) + §15 (browser verification), §13
// (NO silent error coercion): za vsak kokpit vir deterministično injiciramo
// napako (route mock) in dokažemo:
//
//   **request fails → UI pokaže ERROR → NI lažnega poslovnega stanja**
//
//   ERROR  ≠ EMPTY   (NEG-1 vs POS-1: 500 pokaže napako, prazen seznam
//                      pokaže "ni izjem" — nikoli obratno)
//   UNAUTHORIZED ≠ EMPTY (NEG-8: 403 pokaže "ni dostopa", nikoli prazno)
//   izolacija per vir (NEG-2/6/7: en vir padel, ostali še vedno READY)
//
// Tehnika: page.route() fulfils za 7 kokpit endpointov — baza baseline
// uspešnih odgovorov + per-test prepisan EN vir s statusom (500/403).
// Seja: žeton + user (iz /api/auth odgovora) injicirana v localStorage/
// sessionStorage PRE navigacije (isti ključi kot usePinAuth setAuthToken/
// setCurrentUser); GET /api/auth validacija teče NARAVNO (nije mockan —
// dokaz, da mockan samo ciljni vir).
// serviceWorkers: 'block' — SW ne sme posredovati (page.route okoli SW).
// API-level prijava (isti vzorec kot critical-path.spec.ts) — PIN UI tok ni
// predmet tega spec-a (že pokrit v pin-login specih).
//
// Predpogoji (playwright webServer + seed, kot core-flow):
//   - test-admin / PIN 1111 (admin — vse capabilities)
// ============================================
import { test, expect, request as playwrightRequest, type Page } from '@playwright/test'

const API_BASE = '/api'
const TEST_PIN = '1111'
const TEST_EMPLOYEE_ID = 'test-admin'

test.describe.configure({ mode: 'serial' })
test.use({ serviceWorkers: 'block' })

// — Deterministični uspešni odgovori (baseline READY) —

const OK_ALERTS = {
  timestamp: new Date().toISOString(),
  summary: { total: 1, critical: 1, warning: 0, info: 0 },
  alerts: [
    { type: 'delayed_order', severity: 'critical', orderId: 'o1', orderNumber: '42', tableNumber: 5, elapsedMinutes: 25, itemCount: 2, message: 'Naročilo #42 čaka 25 minut' },
  ],
  categories: { delayedOrders: 1, kotNotStarted: 0, unclosedBills: 0, cancellations: 0, lowStock: 0, unfiscalized: 0, longShifts: 0, longOccupiedTables: 0 },
}

const OK_KITCHEN = {
  stats: { totalActive: 3, pendingOrders: 1, inProgressOrders: 2, readyOrdersCount: 0, totalItemsPending: 4, criticalOrders: 0, avgWaitTime: 7 },
}

const OK_DASHBOARD = {
  todayRevenue: 125.5, todayTax: 26.36, totalOrders: 8, paidOrderCount: 8,
  activeTables: 3, totalTables: 12,
  fursStatus: { environment: 'test', todayUnverified: 0 },
}

const OK_CASH = { activeShift: null, liveStats: null }

const OK_RESERVATIONS = {
  // prihajajoča rezervacija (~26 h v prihodnosti — LJ dan ≠ danes ali danes, nič ne sme ura ob browser TZ)
  reservations: [
    { id: 'r1', customerName: 'Ana Novak', dateTime: new Date(Date.now() + 26 * 3600 * 1000).toISOString(), partySize: 4 },
  ],
  summary: { total: 1, totalGuests: 4 },
}

const OK_MENU_STOCK = { 'mi-1': { status: 'ok' } }

const OK_OUTBOX = { stats: { pending: 0, processing: 0, sent: 5, failed: 0, dead_letter: 0 } }

/** 7 kokpit virov → uspešen mock odgovor (baseline) */
const SUCCESS_MOCKS: Array<{ url: string; body: unknown }> = [
  { url: '**/api/operational-alerts*', body: OK_ALERTS },
  { url: '**/api/kitchen*', body: OK_KITCHEN },
  { url: '**/api/dashboard*', body: OK_DASHBOARD },
  { url: '**/api/cash-register*', body: OK_CASH },
  { url: '**/api/reservations*', body: OK_RESERVATIONS },
  { url: '**/api/inventory/menu-stock*', body: OK_MENU_STOCK },
  { url: '**/api/outbox*', body: OK_OUTBOX },
]

const EMPTY_ALERTS = {
  ...OK_ALERTS,
  summary: { total: 0, critical: 0, warning: 0, info: 0 },
  alerts: [],
}

test.describe('Danes kokpit — negativni E2E (#148 §16: ERROR ≠ EMPTY ≠ UNAUTHORIZED)', () => {
  let authToken: string
  let employee: Record<string, unknown>

  test.beforeAll(async () => {
    const ctx = await playwrightRequest.newContext()
    const res = await ctx.post(`${API_BASE}/auth`, {
      data: { employeeId: TEST_EMPLOYEE_ID, pin: TEST_PIN },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.token).toBeTruthy()
    authToken = body.token
    employee = body.employee
    await ctx.dispose()
  })

  /**
   * Odpri kokpit z injicirano sejo + route mocki:
   *  - VSI viri dobijo uspešen baseline odgovor,
   *  - vir iz `mods` lahko preglasi status (napaka) ALI body (prilagojen uspeh)
   *    — vse PRED navigacijo (React Query cache se napravi že z mockom).
   */
  async function openCockpit(page: Page, mods: Array<{ url: string; status?: number; body?: unknown }> = []) {
    const modMap = new Map(mods.map((m) => [m.url, m]))
    for (const m of SUCCESS_MOCKS) {
      const mod = modMap.get(m.url)
      const status = mod?.status ?? 200
      const body = mod?.body ?? m.body
      await page.route(m.url, (route) =>
        route.fulfill({
          status,
          contentType: 'application/json',
          body: JSON.stringify(status === 200 ? body : { error: `mock ${status}` }),
        }),
      )
    }
    // Injiciraj sejo (isti ključi kot usePinAuth setAuthToken/setCurrentUser)
    const token = authToken
    const user = employee
    await page.addInitScript(
      ([t, u]) => {
        window.localStorage.setItem('pos_auth_token', t as string)
        window.localStorage.setItem('pos_token', t as string)
        window.sessionStorage.setItem('pos_auth_token', t as string)
        window.localStorage.setItem('pos_auth_user', JSON.stringify(u))
        window.sessionStorage.setItem('pos_auth_user', JSON.stringify(u))
      },
      [token, user] as [string, Record<string, unknown>],
    )
    await page.goto('/')
  }

  // ═════════════════════════════════════════════════════════════
  // NEGATIVNI: HTTP 500 per vir → ERROR, nikoli lažno poslovno stanje
  // ═════════════════════════════════════════════════════════════

  test('DANES-NEG-1: alerts 500 → ERROR vrstica, NI lažnega "ni izjem" (false-green defekt #148 §2)', async ({ page }) => {
    await openCockpit(page, [{ url: '**/api/operational-alerts*', status: 500 }])
    const error = page.locator('[data-testid="danes-attention-error"]')
    await expect(error).toBeVisible({ timeout: 20_000 })
    await expect(error).toHaveAttribute('role', 'alert')
    // ni lažnega praznega stanja in ni lažnega seznama
    await expect(page.locator('[data-testid="danes-attention-empty"]')).toHaveCount(0)
    await expect(page.locator('[data-testid="danes-attention-list"]')).toHaveCount(0)
    // izolacija: stran ni strgana — KPI (dashboard vir) še vedno renderan
    await expect(page.locator('[data-testid="danes-kpi-revenue"]')).toBeVisible()
  })

  test('DANES-NEG-2: menu-stock 500 → ERROR, NI lažnega "vse na zalogi"', async ({ page }) => {
    await openCockpit(page, [{ url: '**/api/inventory/menu-stock*', status: 500 }])
    const error = page.locator('[data-testid="danes-stock-error"]')
    await expect(error).toBeVisible({ timeout: 20_000 })
    await expect(error).toHaveAttribute('role', 'alert')
  })

  test('DANES-NEG-3: outbox 500 → sistem vrstica ERROR, NI lažnega "brez okvar"', async ({ page }) => {
    await openCockpit(page, [{ url: '**/api/outbox*', status: 500 }])
    const error = page.locator('[data-testid="danes-system-error"]')
    await expect(error).toBeVisible({ timeout: 20_000 })
    await expect(error).toHaveAttribute('role', 'alert')
    // loading vrstica je že zamenjana
    await expect(page.locator('[data-testid="danes-system-loading"]')).toHaveCount(0)
  })

  test('DANES-NEG-4: reservations 500 → ERROR, NI lažnega "brez rezervacij"', async ({ page }) => {
    await openCockpit(page, [{ url: '**/api/reservations*', status: 500 }])
    const error = page.locator('[data-testid="danes-reservations-error"]')
    await expect(error).toBeVisible({ timeout: 20_000 })
    await expect(error).toHaveAttribute('role', 'alert')
    // uspešnih rezervacij ni (mock je padel) — seznam NI renderan
    await expect(page.locator('[data-testid="danes-reservations"]')).toHaveCount(0)
  })

  test('DANES-NEG-5: cash-register 500 → ERROR, NI lažne smene/prihodkov', async ({ page }) => {
    await openCockpit(page, [{ url: '**/api/cash-register*', status: 500 }])
    const error = page.locator('[data-testid="danes-cash-error"]')
    await expect(error).toBeVisible({ timeout: 20_000 })
    await expect(error).toHaveAttribute('role', 'alert')
  })

  test('DANES-NEG-6: kitchen 500 → KPI pokaže "—", sosednji KPI (dashboard) ostane READY', async ({ page }) => {
    await openCockpit(page, [{ url: '**/api/kitchen*', status: 500 }])
    // KPI pokriti s kitchen virom: "—" (nikoli lažno 0)
    await expect(page.locator('[data-testid="danes-kpi-orders"]')).toContainText('—', { timeout: 20_000 })
    await expect(page.locator('[data-testid="danes-kpi-waiting"]')).toContainText('—')
    // izolacija: dashboard KPI NIMA "—" (uspešen mock → EUR vrednost)
    await expect(page.locator('[data-testid="danes-kpi-revenue"]')).not.toContainText('—')
  })

  test('DANES-NEG-7: dashboard 500 → KPI pokaže "—", kitchen KPI ostane READY', async ({ page }) => {
    await openCockpit(page, [{ url: '**/api/dashboard*', status: 500 }])
    await expect(page.locator('[data-testid="danes-kpi-revenue"]')).toContainText('—', { timeout: 20_000 })
    await expect(page.locator('[data-testid="danes-kpi-tables"]')).toContainText('—')
    await expect(page.locator('[data-testid="danes-kpi-orders"]')).not.toContainText('—')
  })

  // ═════════════════════════════════════════════════════════════
  // UNAUTHORIZED ≠ EMPTY (403; 401 clearing je usePOSAuth/authFetch kanon)
  // ═════════════════════════════════════════════════════════════

  test('DANES-NEG-8: cash-register 403 → page UNAUTHORIZED, NI prazne/healthy vsebine', async ({ page }) => {
    await openCockpit(page, [{ url: '**/api/cash-register*', status: 403 }])
    const unauthorized = page.locator('[data-testid="danes-unauthorized"]')
    await expect(unauthorized).toBeVisible({ timeout: 20_000 })
    await expect(unauthorized).toHaveAttribute('role', 'alert')
    // UNAUTHORIZED NI prikazan kot ERROR kartica in NI kot prazno stanje
    await expect(page.locator('[data-testid="danes-cash-error"]')).toHaveCount(0)
    await expect(page.locator('[data-testid="danes-attention-empty"]')).toHaveCount(0)
  })

  // ═════════════════════════════════════════════════════════════
  // POZITIVNI KONTROLI (EMPTY ≠ ERROR in READY render)
  // ═════════════════════════════════════════════════════════════

  test('DANES-POS-1: alerts 200 + prazen seznam → eksplicitno EMPTY, NI napake', async ({ page }) => {
    // prazen seznam PRED navigacijo (mock, ne reroute — cache mora biti prazen)
    await openCockpit(page, [{ url: '**/api/operational-alerts*', body: EMPTY_ALERTS }])
    const empty = page.locator('[data-testid="danes-attention-empty"]')
    await expect(empty).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('[data-testid="danes-attention-error"]')).toHaveCount(0)
    await expect(page.locator('[data-testid="danes-attention-list"]')).toHaveCount(0)
  })

  test('DANES-POS-2: alerts 200 + delayed_order → READY seznam renderan (tipizirana pot)', async ({ page }) => {
    await openCockpit(page)
    const list = page.locator('[data-testid="danes-attention-list"]')
    await expect(list).toBeVisible({ timeout: 20_000 })
    await expect(list).toContainText('Naročilo #42')
    await expect(page.locator('[data-testid="danes-attention-error"]')).toHaveCount(0)
  })
})
