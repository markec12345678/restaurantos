// ============================================
// RestaurantOS — Smoke test za ključno potezo
// Login → Order → Payment → FURS → Receipt
// Ta test preverja, da osnovni tok deluje end-to-end
// ============================================
import { test, expect, request as playwrightRequest } from '@playwright/test'

const API_BASE = '/api'
const BASE_URL = 'http://localhost:3000'

// Testni uporabnik — seedan v tests/e2e/global.setup.ts
const TEST_PIN = '1111'
const TEST_EMPLOYEE_ID = 'test-admin'

test.describe('Ključna poteza: Order → Payment → FURS', () => {
  let authCookie: string

  test.beforeAll(async () => {
    // 1. Prijava — pridobi session cookie
    const ctx = await playwrightRequest.newContext({ baseURL: BASE_URL })
    const res = await ctx.post(`${API_BASE}/auth`, {
      data: {
        employeeId: TEST_EMPLOYEE_ID,
        pin: TEST_PIN,
      },
    })
    expect(res.ok()).toBeTruthy()
    const setCookie = res.headers()['set-cookie']
    expect(setCookie).toBeTruthy()
    authCookie = setCookie!.split(';')[0]
    await ctx.dispose()
  })

  test('odpri POS in dodaj artikel v košarico', async ({ page }) => {
    await page.context().addCookies([{
      name: authCookie.split('=')[0],
      value: authCookie.split('=')[1],
      url: BASE_URL,
    }])

    await page.goto('/waiter')

    // Počakaj, da se meni naloži
    await expect(page.locator('[data-testid="menu-item-card"]').first()).toBeVisible({ timeout: 15000 })

    // Klikni prvi artikel
    await page.locator('[data-testid="menu-item-card"]').first().click()

    // Preveri, da se je dodal v košarico
    await expect(page.locator('[data-testid="cart-item"]').first()).toBeVisible()
    await expect(page.locator('[data-testid="cart-count"]')).toContainText(/[1-9]/)
  })

  test('oddaj naročilo v kuhinjo', async ({ page }) => {
    await page.context().addCookies([{
      name: authCookie.split('=')[0],
      value: authCookie.split('=')[1],
      url: BASE_URL,
    }])

    await page.goto('/waiter')

    // Dodaj artikel
    await page.locator('[data-testid="menu-item-card"]').first().click()

    // Izberi mizo
    await page.locator('[data-testid="table-selector"]').click()
    await page.locator('[data-testid="table-option"]').first().click()

    // Oddaj naročilo
    await page.locator('[data-testid="submit-order"]').click()

    // Potrdi v modalu
    await page.locator('[data-testid="confirm-order"]').click()

    // Počakaj na uspeh
    await expect(page.locator('[data-testid="order-success"]')).toBeVisible({ timeout: 10000 })
  })

  test('plačaj naročilo in sproži FURS potrjevanje', async ({ page, request }) => {
    // 1. Pridobi zadnje naročilo preko API-ja (request fixture iz Playwrighta)
    const ordersRes = await request.get(`${API_BASE}/orders?limit=1`, {
      headers: { Cookie: authCookie },
    })
    expect(ordersRes.ok()).toBeTruthy()
    const orders = await ordersRes.json()
    const orderId = orders.data?.[0]?.id
    expect(orderId).toBeTruthy()

    // 2. Pojdi na payment page
    await page.context().addCookies([{
      name: authCookie.split('=')[0],
      value: authCookie.split('=')[1],
      url: BASE_URL,
    }])
    await page.goto(`/order/${orderId}`)

    // 3. Izberi plačilo z gotovino
    await page.locator('[data-testid="payment-method-cash"]').click()
    await page.fill('[data-testid="cash-received"]', '20.00')
    await page.locator('[data-testid="process-payment"]').click()

    // 4. Počakaj na FURS potrditev
    await expect(page.locator('[data-testid="furs-status"]')).toContainText(
      /(potrjen|verified|queued|simulated)/i,
      { timeout: 15000 }
    )

    // 5. Preveri, da je račun kreiran
    await expect(page.locator('[data-testid="receipt-number"]')).toBeVisible()
  })

  test('preveri, da je račun v bazi z ZOI in EOR', async ({ request }) => {
    const res = await request.get(`${API_BASE}/receipts?limit=1`, {
      headers: { Cookie: authCookie },
    })
    expect(res.ok()).toBeTruthy()
    const receipts = await res.json()
    const receipt = receipts.data?.[0]

    expect(receipt).toBeTruthy()
    // ZOI mora biti prisoten (tudi v test okolju)
    expect(receipt.zoi).toBeTruthy()
    expect(receipt.zoi.length).toBeGreaterThan(5)
    // EOR je lahko null v queued stanju (offline), ampak polje mora obstajati
    expect(receipt).toHaveProperty('eor')
    // fiscalVerified flag mora biti boolean
    expect(typeof receipt.fiscalVerified).toBe('boolean')
  })
})
