// ============================================
// RestaurantOS — E2E Auth SETUP za offline sync scenarije (R226)
// ============================================
// Playwright canonical auth-setup vzorec: prijavljeno sejo (storageState)
// pripravi TA fajl v 'setup' projektu (config testMatch /.*\.setup\.ts/),
// chromium projekt ga NE pobere (default testMatch zahteva *.spec.ts /
// *.test.ts) in ga doseže prek dependencies: ['setup'] — fajl obstaja,
// preden se r226-offline-sync.spec.ts zbere (skip-guard problem rešen na
// projektu nivoju, ne collect času).
//
// Tok: fail-open single-step prijava (brez device bindinga — grid ne
// obstaja; GET /api/auth/employees ga NE kliče, usePinLogin
// employeesQuery enabled: !!deviceLocationId) — test-admin PIN 1111
// (scripts/e2e-seed-data.mjs; hišni vzorec device-tab.spec.ts).
//
// 429 BUDGET (middleware vedro 'auth-login', lokalni privzeti 5/15min):
//   setup: GET /api/auth status (401) + POST prijava = 2
//   A/B/C spec: GET /api/auth validacija seje (storageState) = 1 vsak
//   Skupaj 5/5 = TOČNO kot device-tab.spec.ts / two-step-login.spec.ts
//   (dokazano deterministično pod privzetimi mejami).
// ============================================
import { test, expect, type Page } from '@playwright/test'
import { tmpdir } from 'os'
import { join } from 'path'

// ENAKA pot kot v r226-offline-sync.spec.ts (literal po hišnem vzorcu
// device-tab.spec.ts STORAGE_STATE_PATH)
export const R226_STORAGE_STATE_PATH = join(tmpdir(), 'restaurantos-r226-offline-sync.json')
const NULL_LOCATION_ADMIN_PIN = '1111'

/** Cookie banner (svež kontekst) umaknjen, da ne more interceptati klikov. */
async function dismissCookieBannerIfVisible(page: Page): Promise<void> {
  const banner = page.locator('[role="dialog"][aria-label*="piškotkov"]')
  try {
    await banner.waitFor({ state: 'visible', timeout: 3_000 })
  } catch {
    return
  }
  await page.getByRole('button', { name: 'Samo nujni' }).click()
  await expect(banner).toBeHidden()
}

/** PIN vnesi s KLIKOM keypad tipk (touch pot) in potrdi (4-mestni seed PIN
 *  potrebuje izrecen klik — auto-submit šele pri 6 stevkah, PIN_MAX_LENGTH). */
async function enterPinViaKeypad(page: Page, pin: string): Promise<void> {
  for (const digit of pin) {
    await page.getByRole('button', { name: `Stevka ${digit}` }).click()
  }
  await page.getByRole('button', { name: 'Potrdi PIN' }).click()
}

/** Marker prijavljenega POS UI-ja (hišni vzorec device-tab.spec.ts). */
async function expectLoggedInUi(page: Page): Promise<void> {
  await expect(page.locator('#main-content')).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('[role="dialog"][aria-label="PIN prijava"]')).toBeHidden()
}

/** SetupRedirect overlay ('Preverjam stanje sistema...', fixed z-50) —
 *  mrzel dev compile /api/setup/status ga lokalno podaljša in bi interceptal
 *  klike; počakaj, da mine (hišni vzorec r226-offline-sync.spec.ts). */
async function awaitSetupOverlayGone(page: Page): Promise<void> {
  await expect(page.getByText('Preverjam stanje sistema...')).toBeHidden({ timeout: 60_000 })
}

// Mrzel Turbopack compile prvega '/' obiska (hišni vzorec device-tab.spec.ts)
test.use({ navigationTimeout: 120_000 })

test('r226 auth setup: prijava test-admin (PIN 1111) → storageState za offline sync scenarije', async ({ page }) => {
  // Setup tok (prijava + mount validacija) > 30s default (kds-timer vzorec)
  test.setTimeout(90_000)

  await page.goto('/')
  await dismissCookieBannerIfVisible(page)
  await awaitSetupOverlayGone(page)
  await expect(page.getByRole('button', { name: 'Stevka 1' })).toBeVisible({ timeout: 20_000 })
  await enterPinViaKeypad(page, NULL_LOCATION_ADMIN_PIN)
  await expectLoggedInUi(page)

  // Seja za A/B/C scenarije (chromium dependencies: ['setup'])
  await page.context().storageState({ path: R226_STORAGE_STATE_PATH })
})
