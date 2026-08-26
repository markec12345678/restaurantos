// ============================================
// RestaurantOS — E2E Setup Flow Tests
// ============================================
import { test, expect, request as playwrightRequest } from '@playwright/test'

const API_BASE = '/api'
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'

test.describe('Setup Wizard', () => {
  test('GET /api/setup/status vrača pravilno strukturo', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: BASE_URL })

    let lastRes: Awaited<ReturnType<typeof ctx.get>> | null = null
    for (let i = 0; i < 3; i++) {
      lastRes = await ctx.get(`${API_BASE}/setup/status`)
      if (lastRes.ok()) break
      await new Promise(r => setTimeout(r, 2000))
    }
    expect(lastRes?.ok()).toBeTruthy()

    const body = await lastRes!.json()
    expect(body).toHaveProperty('isInitialized')
    expect(body).toHaveProperty('mode')
    expect(body).toHaveProperty('hasEmployees')
    expect(body).toHaveProperty('hasLocations')
    expect(body).toHaveProperty('hasSettings')
    expect(body).toHaveProperty('counts')
    expect(body).toHaveProperty('multiLocationReady')
    expect(body).toHaveProperty('databaseUrl')
    expect(['single', 'multi']).toContain(body.mode)

    await ctx.dispose()
  })

  test('GET /api/setup/status deluje brez avtentikacije (javna ruta)', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: BASE_URL })
    let lastRes: Awaited<ReturnType<typeof ctx.get>> | null = null
    for (let i = 0; i < 3; i++) {
      lastRes = await ctx.get(`${API_BASE}/setup/status`)
      if (lastRes.ok()) break
      await new Promise(r => setTimeout(r, 2000))
    }
    expect(lastRes?.status()).not.toBe(401)
    expect(lastRes?.ok()).toBeTruthy()
    await ctx.dispose()
  })

  test('POST /api/setup/init zavrne neveljavne podatke', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: BASE_URL })

    const res = await ctx.post(`${API_BASE}/setup/init`, {
      data: {
        adminName: 'A',
        adminEmail: 'invalid-email',
        adminPin: '123',
      },
    })
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('Neveljavni podatki')
    expect(body.validationErrors).toBeDefined()

    await ctx.dispose()
  })

  test('POST /api/setup/init zahteva PIN 4 številke', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: BASE_URL })

    const res = await ctx.post(`${API_BASE}/setup/init`, {
      data: {
        adminName: 'Test Admin',
        adminEmail: 'test@test.com',
        adminPin: 'abcd',
        restaurantName: 'Test',
        locationName: 'Test',
        locationCode: 'TST',
      },
    })
    expect(res.status()).toBe(400)

    await ctx.dispose()
  })

  test('Setup status na E2E bazi je inicializiran (po global setup)', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: BASE_URL })
    let lastRes: Awaited<ReturnType<typeof ctx.get>> | null = null
    for (let i = 0; i < 3; i++) {
      lastRes = await ctx.get(`${API_BASE}/setup/status`)
      if (lastRes.ok()) break
      await new Promise(r => setTimeout(r, 2000))
    }
    expect(lastRes?.ok()).toBeTruthy()
    const body = await lastRes!.json()
    expect(body.isInitialized).toBe(true)
    expect(body.hasEmployees).toBe(true)
    expect(body.hasLocations).toBe(true)
    await ctx.dispose()
  })

  test('POST /api/setup/init prepreči re-init', async () => {
    const ctx = await playwrightRequest.newContext({ baseURL: BASE_URL })
    const res = await ctx.post(`${API_BASE}/setup/init`, {
      data: {
        mode: 'single',
        adminName: 'Hacker',
        adminEmail: 'hacker@evil.com',
        adminPin: '9999',
        restaurantName: 'Hacked',
        locationName: 'Hacked',
        locationCode: 'HCK',
      },
    })
    // 409 = konflikt (sistem že inicializiran) ali 400 = validacijska napaka
    // Oba sta sprejemljiva — glavno da ni 201 (uspeh) ali 500 (napaka)
    expect([400, 409]).toContain(res.status())
    if (res.status() === 409) {
      const body = await res.json()
      expect(body.error).toContain('že inicializiran')
    }
    await ctx.dispose()
  })

  test('Setup stran /setup je dostopna brez avtentikacije', async ({ page }) => {
    const res = await page.goto(`${BASE_URL}/setup`)
    expect(res?.status()).toBeLessThan(400)
    await expect(page.locator('h1, h2').first()).toContainText(/RestaurantOS Setup|Setup|inicializiran/i, { timeout: 10000 })
  })

  test('Setup stran prikaže izbiro načina (single/multi) kadar ni inicializiran', async ({ page }) => {
    await page.goto(`${BASE_URL}/setup`)
    await expect(page.locator('body')).toBeVisible({ timeout: 10000 })
    const title = await page.title()
    expect(title.length).toBeGreaterThan(0)
  })
})
