// ============================================
// RestaurantOS — E2E DeviceTab (Settings → Naprava, R97-b)
// ============================================
// Pokrije R96-b admin UI za device-location binding (prvi e2e spec, ki doseže
// avtenticiran Settings UI čez sidebar: Sistem → Nastavitve → tab 'Naprava'):
//   A) vezana naprava (localStorage ključ 'restaurantos-pos-device-location' =
//      'loc-2' prek addInitScript) → prijava filiala-admin (dvostopenjski tok:
//      grid → PIN 2222) → status 'Naprava je vezana na: Test Filiala' +
//      Badge '✓ Dvostopenjska prijava aktivna' + select prednastavljen na
//      binding + 'Shrani' disabled (izbira == binding — nič za shranit).
//   B) SPREMEMBA bindinga prek select-a: neznana lokacija (veljaven format,
//      neobstoječa — R96-c konstanta) → fail-open single-step → prijava
//      test-admin ({pin}-only kontrakt) → status 'Naprava je vezana na:
//      neznana lokacija' + opomba → izbira druge seedane lokacije ('Test
//      Restavracija') → 'Shrani' → status se osveži + Badge aktiven +
//      localStorage persistiran (page.evaluate getItem).
//   C) 'Pobriši binding' (storageState seje iz B — brez nove prijave) →
//      not-bound status 'Naprava ni vezana — prijava je klasična (samo PIN)' +
//      Badge 'Klasična prijava (samo PIN)' + localStorage ključ ODSTRANJEN.
//
// ZAKAJ B PREK NEZNAME LOKACIJE (forenzika, ne arbitrariness): sprememba
// bindinga na DRUGO lokacijo zahteva globalni /api/locations scope — to ima
// SAMO admin brez locationId (test-admin; resolveTenantLocationIdOrThrow:
// TENANT_ADMIN_ROLES + null lokacija = scope null → vse lokacije).
// filiala-admin je vezan na loc-2 → njegov select vidi IZKLJUČNO 'Test
// Filiala' (R86-2c1 tenant-scope) → sprememba na loc-1 je pri njem nemogoča.
// Test-admin pa se pri lokaciji loc-2 ne more prijaviti (dvostopenjski grid
// ponuja samo filiala-admin) → njegova prijava potrebuje fail-open tok, torej
// neznan device binding. B torej pokriva hkrati: unknown-location prikaz,
// fail-open prijavo in cross-location spremembo bindinga.
//
// Seed realnost (scripts/e2e-seed-data.mjs — edini vir fixture-ov, NIČ
// sprememb seeda): loc-1 'Test Restavracija' + loc-2 'Test Filiala' (oba
// isActive), filiala-admin (PIN 2222, loc-2, role admin), test-admin
// (PIN 1111, BREZ locationId, role admin — globalni scope).
//
// 429 BUDGET (R96-c forenzika: middleware vedro 'auth-login', vzorec
// /\/api\/auth$/, šteje TUDI sejne GET /api/auth; lokalni privzeti 5/15min):
//   A: GET status seje (401) + POST prijava        = 2 mesti
//   B: GET status seje (401) + POST prijava        = 2 mesti
//      (GET /api/auth/employees gre v route-level 'auth-employees'/api-general
//      vedro, NE v 'auth-login'; [404, 429] toleranca = hišni vzorec)
//   C: BREZ prijave — storageState iz B → samo GET /api/auth z Bearer
//      (validacija seje v usePOSAuth)               = 1 mesto
//   Skupaj 5/5 = TOČNO kot two-step-login.spec.ts (dokazano deterministično
//   pod privzetimi mejami). Scenarij C NE sme dodati lastne prijave — 6. mesto
//   bi bilo 429. CI (LOGIN_RATE_LIMIT_MAX=200, e2e.yml) je daleč pod mejo.
//   Settings UI klice (/api/locations, /api/settings, …) sodijo v api-general
//   vedro (300/min default; 600 v e2e webServer env) — ne v auth-login.
//
// R97-a konkurenčna varnost: vsi pini uporabljajo IZKLJUČNO obstoječe
// DeviceTab nize (status vrstica, Badge, aria-labeli gumib, select label) —
// sibling R97-a doda WebAuthn sekcijo ADDITIVNO pod obstoječim UI-jem brez
// spremembe teh nizov (frozen kontrakt).
// ============================================
import { test, expect, type Page } from '@playwright/test'
import { existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

// StorageState za scenarij C: zapiše ga scenarij B (konec seje: prijavljen
// test-admin + binding loc-1). Če B ni tekel (npr. izoliran zagon C), se C
// preskoči — C brez seje NE more doseči Settings UI-ja, lastna prijava pa bi
// presegla auth-login vedro (glej budget komentar zgoraj).
const STORAGE_STATE_PATH = join(tmpdir(), 'restaurantos-device-tab-admin.json')

test.describe('DeviceTab (Settings → Naprava, R96-b binding UI)', () => {
  // Mrzel Turbopack compile prvega '/' obiska (hišni vzorec two-step-login.spec.ts)
  test.use({ navigationTimeout: 120_000 })

  // ── Seed fixture konstante (scripts/e2e-seed-data.mjs; literal localStorage
  //    ključ po hišnem vzorcu — kanon: DEVICE_LOCATION_STORAGE_KEY v
  //    src/components/pos/pin-login/resolveDeviceLocation.ts) ──
  const DEVICE_LOCATION_STORAGE_KEY = 'restaurantos-pos-device-location'
  const SEEDED_LOCATION_ID = 'loc-2'
  const SEEDED_LOCATION_NAME = 'Test Filiala'
  // Druga seedana lokacija (cilj spremembe bindinga v B)
  const OTHER_SEEDED_LOCATION_ID = 'loc-1'
  const OTHER_SEEDED_LOCATION_NAME = 'Test Restavracija'
  const SEEDED_ADMIN_NAME = 'Filiala Admin'
  const SEEDED_ADMIN_PIN = '2222'
  // test-admin: seedan BREZ locationId → deterministični lastnik PIN-a 1111
  // (legacy single-step kontrakt) + globalni /api/locations scope.
  const NULL_LOCATION_ADMIN_PIN = '1111'
  // Veljaven format, ki ga LOCATION_ID_RE spusti, baza pa ga ne pozna →
  // unified 404 (fail-open) / DeviceTab 'neznana lokacija' (ni obstoja-oraklja).
  const UNKNOWN_LOCATION_ID = '00000000-0000-4000-8000-000000000000'
  // Pre-existing DeviceTab nizi (R96-b; frozen proti R97-a additivni spremembi)
  const DEVICE_TAB_NOT_BOUND = 'Naprava ni vezana — prijava je klasična (samo PIN)'
  const SAVE_BUTTON_LABEL = 'Shrani lokacijo naprave'
  const CLEAR_BUTTON_LABEL = 'Pobriši binding lokacije naprave'
  const SELECT_LABEL = 'Nova lokacija naprave'

  // ── Helperji (hišni vzorci: two-step-login.spec.ts / cookie-consent.spec.ts) ──

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

  /** PIN vnesi s KLIKOM keypad tipk (touch pot) in potrdi (4-mestni seed PIN
   *  potrebuje izrecen klik — auto-submit šele pri 6 stevkah, PIN_MAX_LENGTH). */
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

  /** Navigacija do DeviceTab: sidebar 'Sistem' grupa (privzeto zložena) →
   *  'Nastavitve' (adminOnly nav item, aria-label = t('nav.settings')) →
   *  SettingsManager tab 'Naprava' (Radix role="tab"). */
  async function openDeviceTab(page: Page): Promise<void> {
    const systemGroup = page.getByRole('button', { name: 'Sistem', exact: true })
    await expect(systemGroup).toBeVisible({ timeout: 20_000 })
    if ((await systemGroup.getAttribute('aria-expanded')) === 'false') {
      await systemGroup.click()
    }
    await page.getByRole('button', { name: 'Nastavitve', exact: true }).click()
    const deviceTabTrigger = page.getByRole('tab', { name: 'Naprava' })
    // SettingsManager se dynamic-importa + useSettingsManager fetch (isLoading
    // skeleton najprej) — toplo čakanje na tab seznam
    await expect(deviceTabTrigger).toBeVisible({ timeout: 30_000 })
    await deviceTabTrigger.click()
  }

  /** Status vrstica DeviceTab (role="status"): filter po hasText, ker tudi
   *  NetworkStatusBar (vsaka stran) nosi role="status" ('Online'). */
  function boundStatusLine(page: Page): ReturnType<Page['getByRole']> {
    return page.getByRole('status').filter({ hasText: 'Naprava je vezana na:' })
  }

  function notBoundStatusLine(page: Page): ReturnType<Page['getByRole']> {
    return page.getByRole('status').filter({ hasText: DEVICE_TAB_NOT_BOUND })
  }

  // ═══════════════════════════════════════════════════════════════
  // SCENARIJ A — vezana naprava (srečna pot, prikaz bindinga)
  // ═══════════════════════════════════════════════════════════════

  test('A: vezana lokacija (loc-2) → Settings → Naprava pokaže binding + aktivni badge', async ({ page }) => {
    // Device lokacija PRED app load-om (plain string — hišna konvencija
    // persistDeviceLocation; parse preživi tudi JSON-string zapis)
    await page.addInitScript(
      ({ key, value }) => window.localStorage.setItem(key, value),
      { key: DEVICE_LOCATION_STORAGE_KEY, value: SEEDED_LOCATION_ID },
    )

    await page.goto('/')
    await dismissCookieBannerIfVisible(page)

    // Dvostopenjska prijava filiala-admin (R95 UI tok, grid iz device lokacije)
    await expect(page.getByText('Izberite svoje ime')).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: `Prijava kot ${SEEDED_ADMIN_NAME}` }).click()
    await expect(page.getByRole('button', { name: 'Stevka 1' })).toBeVisible({ timeout: 20_000 })
    await enterPinViaKeypad(page, SEEDED_ADMIN_PIN)
    await expectLoggedInUi(page)

    await openDeviceTab(page)

    // Status vrstica: ime lokacije iz ISTEGA /api/locations vira kot ostali tabi
    // (pred fetch-om se pokaže raw id / skeleton — toContainText auto-waita)
    await expect(boundStatusLine(page)).toContainText(`Naprava je vezana na: ${SEEDED_LOCATION_NAME}`)
    // Badge aktivnega bindinga
    await expect(page.getByText('Dvostopenjska prijava aktivna')).toBeVisible()
    // Select prednastavljen na binding; Shrani disabled (izbira == binding)
    const select = page.getByLabel(SELECT_LABEL)
    await expect(select).toBeVisible({ timeout: 20_000 })
    await expect(select).toHaveValue(SEEDED_LOCATION_ID)
    await expect(page.getByRole('button', { name: SAVE_BUTTON_LABEL })).toBeDisabled()
  })

  // ═══════════════════════════════════════════════════════════════
  // SCENARIJ B — sprememba bindinga prek select-a + Shrani
  // ═══════════════════════════════════════════════════════════════

  test('B: neznana lokacija → sprememba na drugo seedano lokacijo → Shrani persista', async ({ page }) => {
    await page.addInitScript(
      ({ key, value }) => window.localStorage.setItem(key, value),
      { key: DEVICE_LOCATION_STORAGE_KEY, value: UNKNOWN_LOCATION_ID },
    )

    // House 429-toleranca na API meji: 404 (neznana lokacija) IN 429 (rate
    // limit) sprožita ISTI fail-open single-step UI (two-step-login vzorec).
    const employeesResponse = page.waitForResponse(
      (res) => res.url().includes('/api/auth/employees') && res.request().method() === 'GET',
    )

    await page.goto('/')
    await dismissCookieBannerIfVisible(page)

    expect([404, 429]).toContain((await employeesResponse).status())
    await expect(page.getByRole('button', { name: 'Stevka 1' })).toBeVisible({ timeout: 20_000 })

    // Fail-open single-step prijava test-admin ({pin}-only kontrakt)
    await enterPinViaKeypad(page, NULL_LOCATION_ADMIN_PIN)
    await expectLoggedInUi(page)

    await openDeviceTab(page)

    // Vezan id, ki ga seznam ne pozna → 'neznana lokacija' + razlagalna opomba
    // (prikazana ŠELE ko je seznam pregledan — nikoli ob fetch napaki)
    await expect(boundStatusLine(page)).toContainText('Naprava je vezana na: neznana lokacija')
    await expect(page.getByText('Vezana lokacija ni več v sistemu')).toBeVisible()

    // Sprememba bindinga: globalni admin (brez locationId) vidi VSE seedane
    // lokacije → izberi 'Test Restavracija' (loc-1) → Shrani
    const select = page.getByLabel(SELECT_LABEL)
    await expect(select).toBeVisible({ timeout: 20_000 })
    await select.selectOption({ label: OTHER_SEEDED_LOCATION_NAME })
    await page.getByRole('button', { name: SAVE_BUTTON_LABEL }).click()

    // Status se osveži + Badge aktiven binding
    await expect(boundStatusLine(page)).toContainText(`Naprava je vezana na: ${OTHER_SEEDED_LOCATION_NAME}`)
    await expect(page.getByText('Dvostopenjska prijava aktivna')).toBeVisible()

    // localStorage persist (page.evaluate — hišni vzorec cookie-consent.spec.ts)
    const persisted = await page.evaluate(
      (key) => window.localStorage.getItem(key),
      DEVICE_LOCATION_STORAGE_KEY,
    )
    expect(persisted).toBe(OTHER_SEEDED_LOCATION_ID)

    // Seja + binding za Scenarij C (brez nove prijave — glej 429 budget komentar)
    await page.context().storageState({ path: STORAGE_STATE_PATH })
  })

  // ═══════════════════════════════════════════════════════════════
  // SCENARIJ C — Pobriši binding (storageState seja iz B)
  // ═══════════════════════════════════════════════════════════════

  test.describe('C: brisanje bindinga (zahteva storageState iz scenarija B)', () => {
    test.skip(!existsSync(STORAGE_STATE_PATH), 'Scenarij B ni tekel (storageState manjka) — zaženi cel spec fajl')

    test.use({ storageState: STORAGE_STATE_PATH })

    test('C: Pobriši binding → not-bound status + localStorage ključ odstranjen', async ({ page }) => {
      // storageState: prijavljen test-admin + binding loc-1 iz B — usePOSAuth
      // validira Bearer GET /api/auth (1 mesto v auth-login vedru, brez POST-a)
      await page.goto('/')
      await expectLoggedInUi(page)

      await openDeviceTab(page)
      await expect(boundStatusLine(page)).toContainText(`Naprava je vezana na: ${OTHER_SEEDED_LOCATION_NAME}`)

      await page.getByRole('button', { name: CLEAR_BUTTON_LABEL }).click()

      // Not-bound status + Badge klasične prijave
      await expect(notBoundStatusLine(page)).toBeVisible()
      await expect(page.getByText('Klasična prijava (samo PIN)')).toBeVisible()

      // localStorage ključ ODSTRANJEN (clearDeviceLocation — R96-b)
      const persisted = await page.evaluate(
        (key) => window.localStorage.getItem(key),
        DEVICE_LOCATION_STORAGE_KEY,
      )
      expect(persisted).toBeNull()
    })
  })
})
