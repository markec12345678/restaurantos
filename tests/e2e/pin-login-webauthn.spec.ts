// ============================================
// RestaurantOS — E2E WebAuthn prijava na prijavnem ekranu (R99-b)
// ============================================
// Pokrije R99-a integracijo WebAuthn device attestation-a v prijavni ekran
// (PinLogin) z CDP VIRTUAL AUTHENTICATORJEM (prava FIDO2 ceremony v Chromium-u,
// brez fizične naprave). R99-a NI bil še v src ob pisanju spec-a (vzporedno
// delo) — spec pina ZAMRZNJEN UI KONTRAKT (R99-a ga implementira točno takole):
//
//   Gumb:       vidno besedilo 'Prijava s ključem naprave', aria-label
//               'Prijava z WebAuthn ključem naprave', data-testid
//               'pin-webauthn-button'
//   Uspeh:      badge 'Naprava potrjena s ključem' (data-testid
//               'pin-webauthn-attested', role="status")
//   Neuspeh:    notice 'Prijava s ključem ni uspela — uporabite PIN.'
//               (data-testid 'pin-webauthn-error', role="alert")
//   Vidnost:    gumb SAMO na napravi z ZNANO lokacijo + podprt WebAuthn
//               (window.PublicKeyCredential) + lokacija IMA registrirane
//               ključe (allowCredentials ne-prazen iz GET
//               /api/auth/webauthn/options — edini javni vir resnice za
//               "ima ključe" na neprijavljenem zaslonu)
//   Ceremonija: klik → fresh GET options → navigator.credentials.get →
//               POST /api/auth/webauthn/verify → uspeh = badge + localStorage
//               'restaurantos-pos-device-location' dobi AUTHORITATIVNO
//               lokacijo iz odgovora verify ({ location: { id, name } } —
//               R97-a ruta; kanon shrambe je ID lokacije, plain string,
//               resolveDeviceLocation.ts)
//   Server gate: WEBAUTHN_ENABLED=false → GET options 503 → gumb skrit (tiho)
//               — e2e ga NE pokriva (zahteval bi restart strežnika s
//               flipanim env); gate pokrije R99-a unit sloj. webServer env
//               (lokalno) in e2e.yml (CI) oba pinata WEBAUTHN_ENABLED="true"
//               (sandbox .env ima "false" — webServer env ga OVRČE).
//
// SCENARIJI:
//   A) SREČNA POT (register + login; LIVE pokritost registra — R97 backlog
//      "B vir WebAuthnCredential seed/e2e pokritost registra" je bil
//      NISEDEL, zato registracija poteka PREK DeviceTab UI-ja, ne prek
//      seeda): svež kontekst (brez bindinga → single-step) → prijava
//      test-admin (PIN 1111, BREZ locationId → globalni scope) → Settings →
//      Naprava → select loc-1 'Test Restavracija' → Shrani
//      (persistDeviceLocation → localStorage) → 'Registriraj ključ'
//      (virtual authenticator opravi attestation ceremony samodejno; seznam
//      ključev se osveži ŠELE po 201 od POST /api/settings/webauthn/register
//      — dokaz registracije v bazi) → odjava (UserIndicator, DELETE
//      /api/auth) → prijavni zaslon: loc-1 je brez seedanih zaposlenih →
//      fail-open single-step + gumb VIDEK → klik → ceremony avtomatsko uspe
//      → badge + localStorage == 'loc-1' (page.evaluate) → PIN prijava
//      (1111) normalno → logged in (#main-content).
//   B) CEREMONY/VERIFY NEUSPEH → PIN unaffected: svež kontekst z bindingom loc-1
//      (ključ iz A živi v bazi) → gumb VIDEK → ceremony USPE (virtual authenticator
//      avtomatsko), vendar POST /api/auth/webauthn/verify odgovor INTERCEPT-amo z
//      401 (page.route fulfill — deterministično in HITRO; server-401 pot
//      pokrije r97 unit sloj, tu testiramo KLIJENTSKI kontrakt neuspeha):
//      notice pin-webauthn-error (role=alert) → badge NI viden → PIN keypad
//      še vedno deluje → prijava 1111 uspe (fail-open na UX; varnostna
//      odločitev ostaja na strežniku — verify ruta je fail-closed).
//      (Predhodna verzija je odstranila virtualni authenticator → navigator.
//      credentials.get visi do options timeouta 60 s (NotAllowedError šele
//      potem) → notice ne pride v okviru testa; intercept je kanonična hitra
//      pot do ISTEGA klient kodevca (catch → notice) brez 60-s čakanja.)
//   C) BREZ KLJUČEV → gumb NE obstaja: binding loc-2 (BREZ registriranih
//      ključev — noben scenarij ne registrira za loc-2) + virtual
//      authenticator VSEENO pripet (izolira pogoj "podprt WebAuthn" — edini
//      preostali discriminator vidnosti je allowCredentials) → options GET
//      200 z allowCredentials [] → gumb toHaveCount(0) na select koraku
//      (grid) IN na pin koraku (po izbiri zaposlenega — pokrijemo obe
//      možni umestitvi gumba; NE-samo-disabled, temveč INVISIBLE). C NE
//      zaključi prijave (budget, spodaj).
//
// ZAKAJ LOC-1 ZA A/B (in ne loc-2): na loc-1 NI seedanih zaposlenih
// (edini seeded je filiala-admin @ loc-2, scripts/e2e-seed-data.mjs) →
// prijavni zaslon je fail-open SINGLE-STEP (usePinLogin: employeesBroken =
// potrjen prazen seznam → notice 'Izbira zaposlenih ni na voljo') → gumb +
// keypad sta na istem zaslonu NEODVISNO od umestitve R99-a komponente, PIN
// prijava pa gre po legacy {pin}-only kontraktu test-admina (deterministični
// lastnik PIN-a 1111). Na loc-2 bi bil dvostepni tok in gumb bi lahko živel
// samo v enem od korakov — umestitev po korakih NI del kontrakta.
//
// VIRTUAL AUTHENTICATOR (CDP — ta fajl matcha IZKLJUČNO chromium project:
// mobile-safari testMatch je *.mobile.spec.ts, setup je *.setup.ts):
// protocol 'ctap2' + transport 'internal' = PLATFORM authenticator →
// window.PublicKeyCredential + isUVPAA() deterministično true;
// hasResidentKey + isUserVerified + automaticPresenceSimulation → ceremony
// (credentials.create/get) se zaključita brez uporabniške interakcije.
// Authenticator je FRESH per test → vsak run registrira NOVO poverilnico
// (credentialId unikaten; stare vrstice ostanejo v bazi — allowCredentials
// raste, ceremony vedno vrne assertion za poverilnico TEGA runa, counter
// 0→1 strogo narašča) → spec je idempotenten čez rune.
//
// 429 BUDGET (R96-c forenzika: middleware vedro 'auth-login', vzorec
// /\/api\/auth$/, lokalni privzeti 5/15min). NOVO dognanje R99-b: vedro je
// METODNO-NEGAJUJOČE (pattern.test(pathname), src/lib/middleware/
// api-protection.ts) → tudi DELETE /api/auth (odjava, UserIndicator) porabi
// mesto! Ta spec:
//   A: GET /api/auth (load 1, 401) + POST (prijava test-admin)
//      + DELETE (odjava) + GET /api/auth (login-screen remount — PinLogin
//      remount + 'pos:auth-changed' invalidateQueries → refetch auth.status)
//      + POST (prijava po badge-u)                      = 5 mest
//   B: GET (load, 401) + POST (prijava test-admin)     = 2 mesti
//   C: GET (load, 401) — namerna NE-prijava            = 1 mesto
//   Skupaj 8 > 5 → webServer env v playwright.config.ts dvigne
//   LOGIN_RATE_LIMIT_MAX na CI-pariteto 200 (isti kanon kot e2e.yml:71;
//   R97-b audit: "200 odstrani 429 nevidno knjigovodstvo"). Brez dviga bi
//   B-jev POST (6. klic v 15-min oknu) dobil 429.
//   NI v vedru: /api/auth/employees (route vedro 'auth-employees'),
//   /api/auth/webauthn/options|verify (route vedri GENERAL_PUBLIC_LIMIT
//   20/min), /api/settings/webauthn/* (api-general 600/min v e2e env) ter
//   legacy BiometricLogin GET /api/auth/webauthn (route vedro
//   'webauthn-challenge' = LOGIN_LIMIT, ENV-skalirano; ta spec porabi 4:
//   A×2 single-step mounta, B×1, C×1 ob pin-stepu).
//   CI (e2e.yml LOGIN_RATE_LIMIT_MAX=200) pogone cel spec v enem runu.
//
// ODVISNOST SCENARIJEV: B zahteva A (registriran ključ za loc-1 v bazi
// istega strežniškega session-a) — zaženi CEL spec fajl (hišni precedens:
// device-tab.spec.ts scenarij C). C je neodvisen.
//
// ORIGIN KANON: WebAuthn verifikacija veže origin (getWebAuthnConfig:
// NEXTAUTH_URL || NEXT_PUBLIC_APP_URL || 'http://localhost:3000') —
// strežnik MORA teči na ujemajočem origin-u (lokalno in CI: port 3000 +
// NEXTAUTH_URL http://localhost:3000); ob neskladju bi register/verify
// vrnila 400. Brief-ov "port 3010" je zastarel — config + CI kanon je 3000.
// ============================================
import { test, expect, type Page } from '@playwright/test'

test.describe('WebAuthn prijava na prijavnem ekranu (R99-a kontrakt, virtual authenticator)', () => {
  // Mrzel Turbopack compile prvega '/' obiska (hišni vzorec two-step-login.spec.ts)
  test.use({ navigationTimeout: 120_000 })

  // ── Seed fixture konstante (scripts/e2e-seed-data.mjs; literal localStorage
  //    ključ po hišnem vzorcu — kanon: DEVICE_LOCATION_STORAGE_KEY v
  //    src/components/pos/pin-login/resolveDeviceLocation.ts) ──
  const DEVICE_LOCATION_STORAGE_KEY = 'restaurantos-pos-device-location'
  // Lokacija, za katero scenarij A registrira ključ (brez seedanih zaposlenih
  // → fail-open single-step prijavni zaslon — glej header)
  const KEY_LOCATION_ID = 'loc-1'
  const KEY_LOCATION_NAME = 'Test Restavracija'
  // Lokacija BREZ registriranih ključev (scenarij C); tu je seedan filiala-admin
  const NO_KEY_LOCATION_ID = 'loc-2'
  const NO_KEY_LOCATION_EMPLOYEE_NAME = 'Filiala Admin'
  // test-admin: seedan BREZ locationId → deterministični lastnik PIN-a 1111
  // (legacy {pin}-only kontrakt) + globalni /api/locations + register scope.
  const SUPER_ADMIN_PIN = '1111'

  // ── ZAMRZNJEN R99-a UI kontrakt (pinaš dobesedno — glej header) ──
  const WEBAUTHN_BUTTON_TESTID = 'pin-webauthn-button'
  const WEBAUTHN_BUTTON_TEXT = 'Prijava s ključem naprave'
  const WEBAUTHN_BUTTON_ARIA = 'Prijava z WebAuthn ključem naprave'
  const WEBAUTHN_ATTESTED_TESTID = 'pin-webauthn-attested'
  const WEBAUTHN_ATTESTED_TEXT = 'Naprava potrjena s ključem'
  const WEBAUTHN_ERROR_TESTID = 'pin-webauthn-error'
  const WEBAUTHN_ERROR_TEXT = 'Prijava s ključem ni uspela — uporabite PIN.'

  // ── DeviceTab stringi (R96-b/R97-a frozen kontrakt — spec jih NE spreminja) ──
  const SAVE_BUTTON_LABEL = 'Shrani lokacijo naprave'
  const SELECT_LABEL = 'Nova lokacija naprave'
  const WEBAUTHN_SECTION_TITLE = 'WebAuthn ključi naprave'
  const WEBAUTHN_REGISTER_ARIA = 'Registriraj WebAuthn ključ za vezano lokacijo'
  const WEBAUTHN_LIST_NAME = 'Seznam WebAuthn ključev'

  // ── Helperji (hišni vzorci: two-step-login.spec.ts / device-tab.spec.ts) ──

  /**
   * CDP virtualni authenticator (chromium): prava FIDO2 ceremony brez
   * fizične naprave. transport 'internal' = platform authenticator →
   * window.PublicKeyCredential obstaja in isUVPAA() je true (deterministično).
   * Vrne handle z id-jem, da ga scenarij B lahko EXPLICITNO odstrani
   * (WebAuthn.removeVirtualAuthenticator) — negativna pot. (Vračanje brez
   * eksplicitnega tipa: CDPSession ni re-izvožen iz @playwright/test —
   * inferenca iz newCDPSession je čista in brez dodatnega importa.)
   */
  async function setupVirtualAuthenticator(page: Page) {
    const client = await page.context().newCDPSession(page)
    await client.send('WebAuthn.enable')
    const { authenticatorId } = await client.send('WebAuthn.addVirtualAuthenticator', {
      options: {
        protocol: 'ctap2',
        transport: 'internal',
        hasResidentKey: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    })
    return { client, authenticatorId }
  }

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
   *  'Nastavitve' → SettingsManager tab 'Naprava' (Radix role="tab"). */
  async function openDeviceTab(page: Page): Promise<void> {
    const systemGroup = page.getByRole('button', { name: 'Sistem', exact: true })
    await expect(systemGroup).toBeVisible({ timeout: 20_000 })
    if ((await systemGroup.getAttribute('aria-expanded')) === 'false') {
      await systemGroup.click()
    }
    await page.getByRole('button', { name: 'Nastavitve', exact: true }).click()
    const deviceTabTrigger = page.getByRole('tab', { name: 'Naprava' })
    await expect(deviceTabTrigger).toBeVisible({ timeout: 30_000 })
    await deviceTabTrigger.click()
  }

  /** Fail-open single-step prijavni zaslon na KEY_LOCATION (brez zaposlenih):
   *  notice + klasičen PIN podnaslov (two-step-login B kanon). */
  async function expectSingleStepLoginScreen(page: Page): Promise<void> {
    await expect(page.getByRole('button', { name: 'Stevka 1' })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Izbira zaposlenih ni na voljo')).toBeVisible()
    await expect(page.getByText('Vnesite PIN za prijavo')).toBeVisible()
  }

  // ═══════════════════════════════════════════════════════════════
  // SCENARIJ A — srečna pot: LIVE registracija prek DeviceTab UI-ja,
  // odjava, WebAuthn ceremony na prijavnem zaslonu, PIN prijava normalno
  // ═══════════════════════════════════════════════════════════════

  test('A: registracija ključa (DeviceTab) → odjava → WebAuthn ceremony uspe (badge + avtoritativna lokacija) → PIN prijava normalno', async ({ page }) => {
    // Virtual authenticator PRED app load — pokrije register IN login ceremony
    await setupVirtualAuthenticator(page)

    // Svež kontekst: brez bindinga → single-step (legacy {pin}-only kontrakt)
    await page.goto('/')
    await dismissCookieBannerIfVisible(page)
    await expect(page.getByRole('button', { name: 'Stevka 1' })).toBeVisible({ timeout: 20_000 })
    // Grid NI viden (brez lokacije ni dvostopenjskega toka)
    await expect(page.getByRole('button', { name: /Prijava kot / })).toHaveCount(0)

    // Prijava test-admin (brez locationId → globalni scope za register)
    await enterPinViaKeypad(page, SUPER_ADMIN_PIN)
    await expectLoggedInUi(page)

    // Settings → Naprava: vezava lokacije (R96-b UI) + WebAuthn sekcija (R97-a)
    await openDeviceTab(page)
    const select = page.getByLabel(SELECT_LABEL)
    await expect(select).toBeVisible({ timeout: 20_000 })
    await select.selectOption({ label: KEY_LOCATION_NAME })
    await page.getByRole('button', { name: SAVE_BUTTON_LABEL }).click()

    // Shrani persista binding (persistDeviceLocation — page.evaluate kanon)
    const persistedBinding = await page.evaluate(
      (key) => window.localStorage.getItem(key),
      DEVICE_LOCATION_STORAGE_KEY,
    )
    expect(persistedBinding).toBe(KEY_LOCATION_ID)

    // LIVE registracija ključa prek UI (attestation ceremony v virtualnem
    // authenticatorju): seznam se osveži ŠELE po uspešnem 201 — dokaz baze.
    await expect(page.getByText(WEBAUTHN_SECTION_TITLE)).toBeVisible({ timeout: 20_000 })
    await page.getByRole('button', { name: WEBAUTHN_REGISTER_ARIA }).click()
    const credentialList = page.getByRole('list', { name: WEBAUTHN_LIST_NAME })
    await expect(credentialList.getByRole('listitem').first()).toBeVisible({ timeout: 20_000 })

    // Odjava (UserIndicator v sidebarju) → SPA se vrne na prijavni zaslon
    await page.getByRole('button', { name: 'Odjava', exact: true }).click()
    await expect(page.locator('[role="dialog"][aria-label="PIN prijava"]')).toBeVisible({ timeout: 20_000 })

    // Prijavni zaslon @ loc-1: brez zaposlenih → fail-open single-step
    await expectSingleStepLoginScreen(page)

    // GUMB VIDEK (frozen kontrakt: testid + vidno besedilo + aria ime).
    // Vidnost = znana lokacija + podprt WebAuthn + allowCredentials ne-prazen
    // (ključ registriran zgoraj).
    const waButton = page.getByTestId(WEBAUTHN_BUTTON_TESTID)
    await expect(waButton).toBeVisible({ timeout: 20_000 })
    await expect(waButton).toHaveText(WEBAUTHN_BUTTON_TEXT)
    await expect(waButton).toHaveAccessibleName(WEBAUTHN_BUTTON_ARIA)

    // Klik → ceremony: fresh GET options → navigator.credentials.get (virtualni
    // authenticator samodejno) → POST verify 200 (avtoritativna lokacija).
    const verifyResponse = page.waitForResponse(
      (res) => res.url().includes('/api/auth/webauthn/verify') && res.request().method() === 'POST',
    )
    await waButton.click()
    expect((await verifyResponse).status()).toBe(200)

    // Uspeh: badge (role="status" + frozen besedilo + testid)
    const badge = page.getByTestId(WEBAUTHN_ATTESTED_TESTID)
    await expect(badge).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('status').filter({ hasText: WEBAUTHN_ATTESTED_TEXT })).toBeVisible()

    // localStorage dobi AUTHORITATIVNO lokacijo iz odgovora verify (ne
    // klientovo trditev) — kanon shrambe je ID, plain string.
    const persistedAfterAttestation = await page.evaluate(
      (key) => window.localStorage.getItem(key),
      DEVICE_LOCATION_STORAGE_KEY,
    )
    expect(persistedAfterAttestation).toBe(KEY_LOCATION_ID)

    // Nato PIN prijava NORMALNO (WebAuthn je dodatek, ne zamenjava)
    await enterPinViaKeypad(page, SUPER_ADMIN_PIN)
    await expectLoggedInUi(page)
  })

  // ═══════════════════════════════════════════════════════════════
  // SCENARIJ B — verify neuspeh (401 intercept) → notice, PIN keypad
  // unaffected (fail-open na UX). Zahteva A (ključ v bazi).
  // ═══════════════════════════════════════════════════════════════

  test('B: verify neuspeh (401 intercept) → notice (role=alert) → PIN prijava NEovirjena', async ({ page }) => {
    await setupVirtualAuthenticator(page)

    // Znana lokacija z registriranim ključem (A) — naprava je "istega sveta"
    await page.addInitScript(
      ({ key, value }) => window.localStorage.setItem(key, value),
      { key: DEVICE_LOCATION_STORAGE_KEY, value: KEY_LOCATION_ID },
    )

    await page.goto('/')
    await dismissCookieBannerIfVisible(page)
    await expectSingleStepLoginScreen(page)

    // Gumb VIDEK (allowCredentials ne-prazen — dokaz, da je ključ iz A v bazi)
    const waButton = page.getByTestId(WEBAUTHN_BUTTON_TESTID)
    await expect(waButton).toBeVisible({ timeout: 20_000 })

    // NEGATIVNA POT: ceremony uspe (authenticator prisoten), verify odgovor pa
    // intercept-amo z 401 (unificiran body rute) — deterministično in hitro;
    // klient catch → notice (ISTI kontrakt kot server-401, brez 60-s visenja
    // NotAllowedError ob odstranjenem authenticatorju).
    await page.route('**/api/auth/webauthn/verify', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'WebAuthn verifikacija ni uspela.' }),
      }),
    )
    await waButton.click()

    // Neuspeh: notice (role="alert" + frozen besedilo + testid); badge NI viden
    const notice = page.getByTestId(WEBAUTHN_ERROR_TESTID)
    await expect(notice).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('alert').filter({ hasText: WEBAUTHN_ERROR_TEXT })).toBeVisible()
    await expect(page.getByTestId(WEBAUTHN_ATTESTED_TESTID)).toHaveCount(0)

    // Fail-open na UX: PIN keypad še vedno deluje → prijava uspe
    await expect(page.getByRole('button', { name: 'Stevka 1' })).toBeVisible()
    await enterPinViaKeypad(page, SUPER_ADMIN_PIN)
    await expectLoggedInUi(page)

    // Neuspela ceremony NE pokvari bindinga (verify ni uspel → ni persista)
    const persistedAfterFailure = await page.evaluate(
      (key) => window.localStorage.getItem(key),
      DEVICE_LOCATION_STORAGE_KEY,
    )
    expect(persistedAfterFailure).toBe(KEY_LOCATION_ID)
  })

  // ═══════════════════════════════════════════════════════════════
  // SCENARIJ C — znana lokacija BREZ registriranih ključev → gumb NE
  // obstaja v DOM (INVISIBLE, ne disabled). Neodvisen od A/B.
  // ═══════════════════════════════════════════════════════════════

  test('C: lokacija brez registriranih ključev → gumb ni v DOM (select IN pin korak)', async ({ page }) => {
    // Authenticator pripet tudi tu: WebAuthn je "podprt", edini preostali
    // pogoj vidnosti je allowCredentials — izolacija tretjega pogoja.
    await setupVirtualAuthenticator(page)

    await page.addInitScript(
      ({ key, value }) => window.localStorage.setItem(key, value),
      { key: DEVICE_LOCATION_STORAGE_KEY, value: NO_KEY_LOCATION_ID },
    )

    // Komponenta MORA poizvedeti options (allowCredentials je edini javni vir
    // resnice za "lokacija ima ključe") — čakamo na 200 in prazen seznam.
    const optionsResponse = page.waitForResponse(
      (res) =>
        res.url().includes('/api/auth/webauthn/options') &&
        res.url().includes(`locationId=${NO_KEY_LOCATION_ID}`) &&
        res.request().method() === 'GET',
    )

    await page.goto('/')
    await dismissCookieBannerIfVisible(page)

    // loc-2 IMA seedanega zaposlenega → dvostepni tok, korak 1 (grid)
    const employeeButton = page.getByRole('button', { name: `Prijava kot ${NO_KEY_LOCATION_EMPLOYEE_NAME}` })
    await expect(employeeButton).toBeVisible({ timeout: 20_000 })

    // Gumb NE obstaja (ne samo disabled — INVISIBLE) na select koraku
    await expect(page.getByTestId(WEBAUTHN_BUTTON_TESTID)).toHaveCount(0)
    await expect(page.getByTestId(WEBAUTHN_ATTESTED_TESTID)).toHaveCount(0)
    await expect(page.getByTestId(WEBAUTHN_ERROR_TESTID)).toHaveCount(0)

    // Korak 2 (pin) — pokrijemo tudi drugo možno umestitev gumba
    await employeeButton.click()
    await expect(page.locator('[data-testid="selected-employee-bar"]')).toContainText(NO_KEY_LOCATION_EMPLOYEE_NAME)

    // Server je potrdil prazen allowCredentials (200) — komponenta je imela
    // podatke za odločitev o skritju
    const options = await optionsResponse
    expect(options.status()).toBe(200)
    const optionsBody = (await options.json()) as {
      authentication?: { allowCredentials?: unknown[] } | null
    }
    expect(optionsBody.authentication?.allowCredentials ?? []).toEqual([])

    await expect(page.getByTestId(WEBAUTHN_BUTTON_TESTID)).toHaveCount(0)

    // Namerna NE-prijava — glej 429 budget analizo v headerju (C = 1 mesto)
  })
})
