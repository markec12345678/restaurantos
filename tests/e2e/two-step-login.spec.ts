// ============================================
// RestaurantOS — E2E dvostopenjska prijava (R96-c)
// ============================================
// Pokrije R95 UI tok (izbira zaposlenega → PIN) na živem strežniku:
//   A) device VE lokacijo (localStorage ključ 'restaurantos-pos-device-location',
//      kanon: src/components/pos/pin-login/resolveDeviceLocation.ts
//      DEVICE_LOCATION_STORAGE_KEY) → grid zaposlenih (aria-label
//      'Prijava kot <ime>') → PIN keypad (KLIK tipke — touch pot) → prijava
//      z { employeeId, pin } bindingom (R95-a) → prijavljen POS UI.
//   B) NEZNANA lokacija (veljaven format, neobstoječa) → GET /api/auth/employees
//      unificiran 404 'Lokacija ni najden' → fail-open na single-step PIN
//      (grid NI viden) — neznana lokacija NE SME blokirati prijave
//      (legacy {pin}-only kontrakt, e2e EDGE-15).
//   C) SVEŽ kontekst (brez localStorage in ?locationId=) → single-step PIN
//      (byte-kompatibilen R94 tok, BREZ fail-open notice-a). C NE zaključi
//      prijave: middleware vedro 'auth-login' (pattern /\/api\/auth$/ šteje
//      TUDI sejne GET /api/auth — A: POST+GET, B: POST+GET, C: GET = 5) ima
//      lokalno privzeto mejo 5/15min → C-jev login POST bi bil 6. = 429
//      (živo dokazano v lokalnem zagonu: DOM alert 'Preveč zahtev…').
//      CI (LOGIN_RATE_LIMIT_MAX=200) ne trpi, ampak spec mora biti
//      determinističen pod DEFAULT mejami — 'neznana lokacija NE blokira
//      prijave' dokazuje Scenarij B (prijavo zaključi); C dokazuje SAMO
//      UI byte-kompatibilnost (keypad viden, grid/notice odsotna).
//      Justifikacija za C: NOBEN obstoječ e2e spec ne zaključi UI prijave
//      (sosednji spec-i prijavljajo izključno API-level POST /api/auth;
//      cookie-consent.spec.ts gleda le layout prijavnega ekrana).
//
// Seed realnost (scripts/e2e-seed-data.mjs — EDIRNI vir fixture-ov za CI PG
// [e2e-seed.mjs] in lokalni PGlite [init-e2e-db.mjs]; MODEL A set):
//   - filiala-admin: ime 'Filiala Admin', vloga 'admin', PIN 2222,
//     locationId 'loc-2' → edini seeded zaposleni v gridu
//   - loc-2: ime 'Test Filiala' (isActive true)
//   - test-admin: ime 'Test Admin', PIN 1111, BREZ locationId → single-step {pin}
//   Seed sprememba NI bila potrebna (R96-c): filiala-admin že nosi locationId.
//
// 429 toleranca (hišni vzorec [200, 429] iz sosednjih specov):
//   - Scenario B pin-a employees GET [404, 429] — OBA legalno sprožita ISTI
//     fail-open UI (komponenta razlikuje le zdrav/nezdrav endpoint, ne vzroka).
//   - Login POST /api/auth: CI headroom LOGIN_RATE_LIMIT_MAX=200 (R95-d);
//     ta spec naredi 3 prijave → 429 ni pričakovan; API-level [200,429]
//     kontrakt je že pinan v dashboard-reports-edge.spec.ts (EDGE-4b/LOGIN).
//   - Employees bucket GENERAL_PUBLIC_LIMIT 20/min/IP ('auth-employees'):
//     ta spec naredi 2 klica (A + B) → daleč pod mejo tudi ob CI retryjih.
// ============================================
import { test, expect, type Page } from '@playwright/test'

test.describe('Dvostopenjska prijava (R95 UI tok)', () => {
  // Mrzel Turbopack compile prvega '/' obiska (hišni vzorec cookie-consent.spec.ts)
  test.use({ navigationTimeout: 120_000 })

  // ── Seed fixture konstante (glej header komentar — scripts/e2e-seed-data.mjs) ──
  // Kanon imena ključa: DEVICE_LOCATION_STORAGE_KEY v
  // src/components/pos/pin-login/resolveDeviceLocation.ts (literal, da spec
  // ostane samostojen — hišni vzorec 'restaurantos-cookie-consent' v
  // cookie-consent.spec.ts).
  const DEVICE_LOCATION_STORAGE_KEY = 'restaurantos-pos-device-location'
  const SEEDED_LOCATION_ID = 'loc-2'
  const SEEDED_LOCATION_NAME = 'Test Filiala'
  const SEEDED_EMPLOYEE_NAME = 'Filiala Admin'
  const SEEDED_EMPLOYEE_PIN = '2222'
  // test-admin je seedan BREZ locationId → deterministični lastnik PIN-a 1111
  // (legacy single-step kontrakt).
  const NULL_LOCATION_ADMIN_PIN = '1111'
  // Veljaven UUID format, ki ga LOCATION_ID_RE (/^[a-zA-Z0-9_-]{5,50}$/ na
  // /api/auth/employees) spusti skozi, baza pa ga ne pozna → unificiran 404
  // (ni obstoja-oraklja).
  const UNKNOWN_LOCATION_ID = '00000000-0000-4000-8000-000000000000'

  // ── Helperji (hišni vzorci: cookie-consent.spec.ts banner, PinLogin DOM) ──

  /** Cookie banner (svež kontekst) umaknjen, da ne more interceptati klikov. */
  async function dismissCookieBannerIfVisible(page: Page): Promise<void> {
    const banner = page.locator('[role="dialog"][aria-label*="piškotkov"]')
    try {
      await banner.waitFor({ state: 'visible', timeout: 3_000 })
    } catch {
      return // banner ne pride vedno (npr. consent že odložen) — nič zlomljenega
    }
    await page.getByRole('button', { name: 'Samo nujni' }).click()
    await expect(banner).toBeHidden()
  }

  /** PIN vnesi s KLIKOM keypad tipk (touch pot, ne keyboard) in potrdi.
   *  Opomba: auto-submit je ŠELE pri 6 stevkah (PIN_MAX_LENGTH) — 4-mestni
   *  seed PIN-i potrebujejo izrecen klik 'Potrdi PIN'. */
  async function enterPinViaKeypad(page: Page, pin: string): Promise<void> {
    for (const digit of pin) {
      await page.getByRole('button', { name: `Stevka ${digit}` }).click()
    }
    await page.getByRole('button', { name: 'Potrdi PIN' }).click()
  }

  /** Marker prijavljenega POS UI-ja: page.tsx renderira main#main-content
   *  IZKLJUČNO onstran prijave; PIN-dialog pa je takrat poskenjen. */
  async function expectLoggedInUi(page: Page): Promise<void> {
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('[role="dialog"][aria-label="PIN prijava"]')).toBeHidden()
  }

  // ═══════════════════════════════════════════════════════════════
  // SCENARIJ A — binding aktiven (srečna pot)
  // ═══════════════════════════════════════════════════════════════

  test('A: znana lokacija → grid zaposlenih → PIN za izbranega → prijava', async ({ page }) => {
    // Device lokacija PRED app load-om (plain string — hišna konvencija
    // persistDeviceLocation; parse preživi tudi JSON-string zapis)
    await page.addInitScript(
      ({ key, value }) => window.localStorage.setItem(key, value),
      { key: DEVICE_LOCATION_STORAGE_KEY, value: SEEDED_LOCATION_ID },
    )

    await page.goto('/')
    await dismissCookieBannerIfVisible(page)

    // Korak 1: grid zaposlenih (podnaslov je ekspliciten select-step marker;
    // kratkotrajni single-step pred post-hidracijsko resolucijo lokacije
    // pregleda auto-retry)
    await expect(page.getByText('Izberite svoje ime')).toBeVisible({ timeout: 20_000 })
    // Badge lokacije iz GET /api/auth/employees odgovora (R95-a kontrakt)
    await expect(page.locator(`[aria-label="Lokacija: ${SEEDED_LOCATION_NAME}"]`)).toBeVisible()
    // Gumb seeded zaposlenega (aria-label kontrakt EmployeeSelectStep)
    const employeeButton = page.getByRole('button', { name: `Prijava kot ${SEEDED_EMPLOYEE_NAME}` })
    await expect(employeeButton).toBeVisible()
    await employeeButton.click()

    // Korak 2: trak izbranega zaposlenega + PIN keypad (lazy-mount → čakaj)
    await expect(page.locator('[data-testid="selected-employee-bar"]')).toContainText(SEEDED_EMPLOYEE_NAME)
    await expect(page.getByText(`Vnesite PIN za ${SEEDED_EMPLOYEE_NAME}`)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Stevka 1' })).toBeVisible({ timeout: 20_000 })

    // Prijava z bindingom: performLogin pošlje { pin, employeeId } — strog
    // binding proti filiala-admin (pravi PIN, pravi zaposleni → 200)
    await enterPinViaKeypad(page, SEEDED_EMPLOYEE_PIN)
    await expectLoggedInUi(page)
  })

  // ═══════════════════════════════════════════════════════════════
  // SCENARIJ B — fail-open na neznani lokaciji
  // ═══════════════════════════════════════════════════════════════

  test('B: neznana lokacija → fail-open single-step, prijava NI blokirana', async ({ page }) => {
    await page.addInitScript(
      ({ key, value }) => window.localStorage.setItem(key, value),
      { key: DEVICE_LOCATION_STORAGE_KEY, value: UNKNOWN_LOCATION_ID },
    )

    // House 429-toleranca na API meji: OBA 404 (neznana lokacija) IN 429
    // (rate limit) sta legalna sprožilca ISTEGA fail-open UI-ja.
    const employeesResponse = page.waitForResponse(
      (res) => res.url().includes('/api/auth/employees') && res.request().method() === 'GET',
    )

    await page.goto('/')
    await dismissCookieBannerIfVisible(page)

    expect([404, 429]).toContain((await employeesResponse).status())

    // Fail-open: single-step PIN keypad VIDEN, grid NI viden (med kratkotrajnim
    // load state-om so samo skeletoni, ne gumbi — count 0 drži skozi vse faze)
    await expect(page.getByRole('button', { name: 'Stevka 1' })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: /Prijava kot / })).toHaveCount(0)
    // Fail-open notice (EMPLOYEE_SELECT_UNAVAILABLE) + klasičen podnaslov
    await expect(page.getByText('Izbira zaposlenih ni na voljo')).toBeVisible()
    await expect(page.getByText('Vnesite PIN za prijavo')).toBeVisible()

    // Neznana lokacija NE SME blokirati prijave: legacy {pin}-only kontrakt
    // (test-admin — deterministični lastnik PIN-a 1111)
    await enterPinViaKeypad(page, NULL_LOCATION_ADMIN_PIN)
    await expectLoggedInUi(page)
  })

  // ═══════════════════════════════════════════════════════════════
  // SCENARIJ C — brez bindinga (svež kontekst, R94 kompatibilnost)
  // ═══════════════════════════════════════════════════════════════

  test('C: svež kontekst brez device lokacije → single-step PIN (R94 kompatibilnost)', async ({ page }) => {
    await page.goto('/')
    await dismissCookieBannerIfVisible(page)

    await expect(page.getByRole('button', { name: 'Stevka 1' })).toBeVisible({ timeout: 20_000 })
    // Grid NI viden IN fail-open notice TUDI ne (brez lokacije ni niti fetcha
    // proti /api/auth/employees — enabled: !!deviceLocationId)
    await expect(page.getByRole('button', { name: /Prijava kot / })).toHaveCount(0)
    await expect(page.getByText('Izbira zaposlenih ni na voljo')).toHaveCount(0)
    await expect(page.getByText('Vnesite PIN za prijavo')).toBeVisible()

    // Namerna NE-prijava (glej header komentar): middleware 'auth-login' vedro
    // je lokalno 5/15min in vključuje sejne GET /api/auth — A+B+ČETRTI klic je
    // že pri meji. Prijava po neznani lokaciji je pokrita v Scenariju B.
  })
})
