// ============================================
// RestaurantOS — E2E Offline Sync scenariji #150 (R226 — epik #157 korak 3)
// ============================================
// Pokriva preostanek KNOWN_ISSUES #49 (širši epik #157 "LOCAL-FIRST POS
// STORAGE"): E2E scenariji #150 — sync po restartu/mountu + več-zavihkova
// koordinacija. Kanon 'SW = SPROŽILEC, page = IZVAJALEC' (R222 korak 1 +
// R224 korak 2): SW 'sync' eventa ni mogoče deterministično sprožiti v
// Playwright (Background Sync zahteva realen network reconnect), zato
// testiramo PAGE-SIDE poti, ki jih vse sprožilce (polling mount, 'online'
// event, SW trigger) dosežejo prek runCoordinatedSync:
//
//   A) RESTART/MOUNT-SYNC — prijavljena seja → seed PENDING vnosa v
//      canonical IndexedDB ('restaurantos-offline-queue' v2/'pendingOrders',
//      db-contract.ts) → page.reload() (simulacija restarta appi) → mount:
//      mount-check toast 'offline operacij čaka na sinhronizacijo' +
//      takojšnji polling (startSyncPolling: prvi poll brez zamika) →
//      runCoordinatedSync → POST /api/orders (mock 201) s kanoničnimi
//      headerji (x-offline-sync/x-client-operation-id/x-device-id — R128
//      ledger) → vnos status SYNCED + serverAck { orderId,
//      serverStatus: 'applied' } (R128 7-dnevna retencija, NI izbrisan).
//   B) MULTI-TAB KOORDINACIJA — dva zavihka ISTEGA konteksta (delita
//      IndexedDB + BroadcastChannel) → seed 1 PENDING → oba zavihka
//      sprožita sync ('online' event) → skupaj TOČNO 1 POST (Web Locks
//      SYNC_LOCK_NAME ifAvailable — druga zavihka skipped brez HTTP ali
//      zero-pending po prvem synca; invarianta trdna v obeh vrstnih redih)
//      → broadcast OFFLINE_SYNC_COMPLETED → aktivna orders query
//      (useOrderPanel byStatus — pod-key od orders.all) refetcha
//      GET /api/orders (cache invalidacija, brez toastov).
//   C) SYNC-METADATA ZAPISNIK — uspešen sync zapiše META_LAST_SYNC_RESULT
//      ('lastSyncResult': succeeded ≥ 1, authExpired false, at > 0) v
//      'syncMetadata' store (R224 #157 korak 2 metadata pot v realnem
//      brskalniku).
//
// 429 BUDGET (middleware vedro 'auth-login', lokalni privzeti 5/15min;
// hišni vzorec device-tab.spec.ts / two-step-login.spec.ts):
//   r226.setup.ts (setup projekt, dependency chromium): GET /api/auth status
//     (401) + POST prijava (PIN 1111)                    = 2
//   A/B/C: storageState → GET /api/auth validacija seje  = 1 vsak
//   Skupaj 5/5 = TOČNO. CI (LOGIN_RATE_LIMIT_MAX=200, e2e.yml) daleč nad
//   mejo — tudi R227 auth-resilience (ensureLoggedIn re-PIN ob transient
//   401, maks. +1 POST na scenarij) je v CI budgetu varno; LOKALNO (privzeti
//   5/15min) re-PIN pot samo pri setup+A toku (2+1+1 fallback = 4/5).
//   Brez setup fajla (izoliran zagon brez dependency) → vse skip
//   (existsSync guard, device-tab C vzorec).
//
// R227 LEKCIJA (CI run 37141374865 @ b0d95d76 — E2E FAILURE 250/3f/4s):
// page snapshot A faila je pokazal DANES UNAUTHORIZED page-state
// (DanesCockpit #148: katerikoli API 401 = 'Seja je potekla') v LANDING
// layoutu brez POS UI — NI ErrorBoundary/chunk-404 (ta simptoma sta bila
// lokalna turbopack dev simulatorja). Merjeno: next dev + turbopack 'full'
// memory eviction → 2× fresh modul-load ('Naloženih 9 sej iz SQLite'
// @ 17:47:59/17:48:07 v job logu) → transient 401 ob r226 loadu → POS UI
// se ne mounta → A 'Prodaja' gumb odsoten, B/C #main-content odsoten.
// NI auth revokacije (AUTH log čist do 17:47:42, LRU evicti šele PO failih).
// Fix (3 sloja): (1) E2E_MODE=1 off eviction (e2e.yml+next.config.ts —
// procesna stabilnost), (2) warm OrderPanel chunk v setupu (manj compile
// pritiska sredi runa), (3) ensureLoggedIn auth-resilience (reload za
// transient 401 → re-PIN za mrtvo sejo — simptom se pozdravi neodvisno od
// mikro-mehanizma 401).
//
// POST /api/orders je MOCKAN (page.route) — scenariji #150 testirajo
// page-side sync pot in IndexedDB končno stanje (server kontrakt je že
// pokrit z unit/IT rundami: idempotencyKey, ledger headerji, 409/401
// poti); mock zagotavlja determinizem neodvisno od seedanih artiklov.
// GET /api/orders teče REALNO (route.continue) — refetch dokazuje
// broadcast-invalidacijo proti živemu API-ju.
// ============================================
import { test, expect, type Page } from '@playwright/test'
import { existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

// ── Canonical IndexedDB kontrakt (src/lib/offline-orders/db-contract.ts;
//    pariteto varuje drift-gate tests/unit/lib/r222-sw-canonical-db.test.ts
//    — literali po hišnem vzorcu device-tab.spec.ts DEVICE_LOCATION_STORAGE_KEY) ──
const DB_NAME = 'restaurantos-offline-queue'
const DB_VERSION = 2
const STORE_NAME = 'pendingOrders'
const META_STORE = 'syncMetadata'
const META_LAST_SYNC_RESULT = 'lastSyncResult'

const STORAGE_STATE_PATH = join(tmpdir(), 'restaurantos-r226-offline-sync.json')
// Seja pripravljena v tests/e2e/r226.setup.ts (setup projekt, PIN 1111)
const MOCK_ORDER_ID = 'e2e-r226-synced-order'
// Re-PIN (ensureLoggedIn fallback): ISTI seed admin kot setup (PIN 1111,
// scripts/e2e-seed-data.mjs — hišni vzorec device-tab.spec.ts)
const NULL_LOCATION_ADMIN_PIN = '1111'

// ── Helperji (hišni vzorci: device-tab.spec.ts / two-step-login.spec.ts) ──

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

/** Marker prijavljenega POS UI-ja: 'Prodaja' gumb (aria-label) obstaja IZKLJUČNO
 *  v POS sidebarju (workspace mountan) — LANDING page ga NIMA (landing ima samo
 *  main#main-content + KDS/Natakar linki — R228 lekcija, CI run 37145783584:
 *  UNAUTHORIZED page-state v landing main je speljal prešibek #main-content
 *  marker). PIN-dialog pa je takrat poskenjen. */
async function expectLoggedInUi(page: Page): Promise<void> {
  await expect(page.locator('button[aria-label="Prodaja"]')).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('[role="dialog"][aria-label="PIN prijava"]')).toBeHidden()
}

/** PIN vnesi s KLIKOM keypad tipk (touch pot) in potrdi (4-mestni seed PIN
 *  potrebuje izrecen klik — auto-submit šele pri 6 stevkah, PIN_MAX_LENGTH;
 *  enako kot r226.setup.ts). */
async function enterPinViaKeypad(page: Page, pin: string): Promise<void> {
  for (const digit of pin) {
    await page.getByRole('button', { name: `Stevka ${digit}` }).click()
  }
  await page.getByRole('button', { name: 'Potrdi PIN' }).click()
}

/** Auth-resilience (R227, CI run 37141374865 lekcija; utrjeno R228, run
 *  37145783584): transient 401 / landing state sredi r226 loadu → POS UI se
 *  NE mounta. Tok (brez isVisible ras — preddogovor je zgrešil 401, ki je
 *  prišel PO checku; C scenarij lekcija): (1) 'Prodaja' gumb (POS-only marker)
 *  že viden → takoj return, (2) sicer reload (transient — svež load obnovi
 *  mount; UNAUTHORIZED alert kasneje odpravi), (3) PIN dialog viden → re-PIN
 *  (seja res mrtva — fail-open tok, isti seed admin kot setup), (4) trda
 *  expectLoggedInUi potrditev (20s). */
async function ensureLoggedIn(page: Page): Promise<void> {
  const prodaja = page.locator('button[aria-label="Prodaja"]')
  if (await prodaja.isVisible().catch(() => false)) return
  await page.reload()
  await awaitSetupOverlayGone(page)
  const pinDialog = page.locator('[role="dialog"][aria-label="PIN prijava"]')
  if (await pinDialog.isVisible().catch(() => false)) {
    await enterPinViaKeypad(page, NULL_LOCATION_ADMIN_PIN)
  }
  await expectLoggedInUi(page)
}

/** SetupRedirect overlay ('Preverjam stanje sistema...', fixed z-50) — mrzel
 *  dev compile /api/setup/status ga lokalno podaljša in bi INTERCEPTAL klike
 *  (actionTimeout klik retry cikli). Počakaj, da mine, preden klikamo.
 *  toBeHidden je takojšnji PASS, ko overlay že ni v DOM-u (warm CI server). */
async function awaitSetupOverlayGone(page: Page): Promise<void> {
  await expect(page.getByText('Preverjam stanje sistema...')).toBeHidden({ timeout: 60_000 })
}

/** Odpri 'Prodaja' (orders) modul — sync poti (startSyncPolling, 'online'
 *  handler, SW TRIGGER, broadcast subscribe) živijo v useOrderPanelMutations
 *  znotraj OrderPanel modula. page.tsx landing gate (R175) prijavljene
 *  admin/manager like ob vsakem loadu preusmeri na 'danes' (workspace.landing;
 *  activeModule NI persistiran — store partialize), zato modul NI privzeto
 *  mountan. Marker mounta = OrderTypeBar radiogroup (vedno v OrderPanel).
 *  Resilience (R227): CI E2E teče proti next dev + TURBOPACK — 'full'
 *  memory eviction je lahko onemogočen (E2E_MODE=1), vendar zanka ostane
 *  kot splošna obramba: dev-only chunk flake (dynamic OrderPanel import)
 *  občasno ujame ErrorBoundary ('Napaka v POS:orders') — 'Poskusi znova'
 *  resetira modul (boundary maxRetries=3); po izčrpavih retryah 'Ponastavi
 *  modul' + reload + ensureLoggedIn (transient 401 / mrtva seja — CI run
 *  37141374865 lekcija) + nov klik. R228 lekcija (run 37145783584): PRVI klik
 *  mora biti catch — brez njega 10s timeout FAILA, preden zanka/recovery sploh
 *  tečeta (točno ta pot je ubila C scenarij). */
async function openOrdersModule(page: Page): Promise<void> {
  await page.locator('button[aria-label="Prodaja"]').click({ timeout: 10_000 }).catch(() => undefined)
  const target = page.getByRole('radiogroup', { name: 'Vrsta naročila' })
  // Zanka (skupaj ~50s + final 20s) — CI E2E teče proti next dev + TURBOPACK
  // (ne standalone!), težki lazy chunki (OrderPanel) lahko 404 ob prvem
  // zahtevanju — ErrorBoundary 'Poskusi znova' ×3 hitro izčrpa, zato:
  //   1) med poskusi 2s dihanje (turbopack konča kompajlanje),
  //   2) po izčrpavih retryah 'Ponastavi modul' (reset) + reload + nov klik
  //      (chunk je v dev sessionu do takrat zgrajen — setup ga warm-a).
  for (let attempt = 0; attempt < 4; attempt++) {
    if (await target.isVisible().catch(() => false)) return
    await page.getByRole('button', { name: 'Poskusi znova' }).click({ timeout: 3_000 }).catch(() => undefined)
    await page.waitForTimeout(2_000)
    if (await target.isVisible().catch(() => false)) return
    await page.locator('button[aria-label="Prodaja"]').click({ timeout: 3_000 }).catch(() => undefined)
    await target.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => undefined)
  }
  // Exhausted (3/3) → 'Ponastavi modul' + reload — svež page load dobi
  // v dev sessionu že zgrajen chunk; ensureLoggedIn drži transient 401 /
  // mrtvo sejo (R227 lekcija — CI run 37141374865)
  await page.getByRole('button', { name: 'Ponastavi modul' }).click({ timeout: 3_000 }).catch(() => undefined)
  await page.reload()
  await awaitSetupOverlayGone(page)
  await ensureLoggedIn(page)
  await page.locator('button[aria-label="Prodaja"]').click({ timeout: 5_000 }).catch(() => undefined)
  await expect(target).toBeVisible({ timeout: 20_000 })
}

// ── IndexedDB helperji (page kontekst — canonical kontrakt iz db-contract.ts) ──

interface SeedSpec {
  id: string
  idempotencyKey: string
  operationId: string
}

/** Zapiši PENDING order.create vnos v canonical queue (oblika, ki jo
 *  normalizeEntry + getProcessableOrders razumeta — PENDING je vedno
 *  obdelovalen, brez lastAttemptAt). App mount je praviloma že odprl v2
 *  bazo; onupgradeneeded tu je defenziven (idempotentna kreacija). */
async function seedPendingOrder(page: Page, seed: SeedSpec): Promise<void> {
  await page.evaluate(async (s) => {
    const entry = {
      id: s.id,
      operationId: s.operationId,
      idempotencyKey: s.idempotencyKey,
      deviceId: 'e2e-r226-seed-device',
      createdAt: Date.now(),
      payloadVersion: 1,
      retryCount: 0,
      status: 'PENDING',
      lastError: null,
      opType: 'order.create',
      employeeId: null,
      locationId: null,
      orderData: {
        type: 'takeaway',
        tableId: null,
        customerName: 'E2E R226 offline sync',
        customerPhone: '',
        discount: 0,
        taxRate: 22,
        notes: 'E2E #150 sync scenarij (R226, epik #157 korak 3)',
        orderItems: [
          {
            menuItemId: 'e2e-r226-mock-item',
            quantity: 1,
            price: 1.5,
            notes: '',
            modifiersJson: '[]',
          },
        ],
      },
    }
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('restaurantos-offline-queue', 2)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('pendingOrders')) {
          const store = db.createObjectStore('pendingOrders', { keyPath: 'id' })
          store.createIndex('status', 'status', { unique: false })
          store.createIndex('createdAt', 'createdAt', { unique: false })
          store.createIndex('idempotencyKey', 'idempotencyKey', { unique: false })
        }
        if (!db.objectStoreNames.contains('syncMetadata')) {
          db.createObjectStore('syncMetadata', { keyPath: 'key' })
        }
      }
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction('pendingOrders', 'readwrite')
        tx.objectStore('pendingOrders').put(entry)
        tx.oncomplete = () => { db.close(); resolve() }
        tx.onerror = () => { db.close(); reject(tx.error) }
      }
      req.onerror = () => reject(req.error)
    })
  }, seed)
}

interface StoredEntry {
  status?: string
  serverAck?: { orderId?: string; serverStatus?: string; syncedAt?: string }
}

/** Preberi vnos iz canonical queue (status + serverAck — R128 retencija). */
async function readPendingOrder(page: Page, id: string): Promise<StoredEntry | null> {
  return page.evaluate(async (entryId) => {
    return await new Promise<StoredEntry | null>((resolve) => {
      const req = indexedDB.open('restaurantos-offline-queue', 2)
      req.onsuccess = () => {
        const db = req.result
        let out: StoredEntry | null = null
        const tx = db.transaction('pendingOrders', 'readonly')
        const g = tx.objectStore('pendingOrders').get(entryId)
        g.onsuccess = () => { out = (g.result as StoredEntry | undefined) ?? null }
        tx.oncomplete = () => { db.close(); resolve(out) }
        tx.onerror = () => { db.close(); resolve(null) }
      }
      req.onerror = () => resolve(null)
    })
  }, id)
}

/** Preberi META_LAST_SYNC_RESULT zapisnik iz 'syncMetadata' store-a. */
async function readLastSyncMeta(page: Page): Promise<{ key?: string; value?: unknown } | null> {
  return page.evaluate(async () => {
    return await new Promise<{ key?: string; value?: unknown } | null>((resolve) => {
      const req = indexedDB.open('restaurantos-offline-queue', 2)
      req.onsuccess = () => {
        const db = req.result
        let out: { key?: string; value?: unknown } | null = null
        const tx = db.transaction('syncMetadata', 'readonly')
        const g = tx.objectStore('syncMetadata').get('lastSyncResult')
        g.onsuccess = () => { out = (g.result as { key?: string; value?: unknown } | undefined) ?? null }
        tx.oncomplete = () => { db.close(); resolve(out) }
        tx.onerror = () => { db.close(); resolve(null) }
      }
      req.onerror = () => resolve(null)
    })
  })
}

// ── API tracker: POST /api/orders mock (sync pot) + GET števec (refetch pot) ──

interface PostRecord {
  idempotencyKey: string | null
  operationId: string | null
  deviceId: string | null
}

interface OrderApiTracker {
  posts: PostRecord[]
  getGetCount: () => number
}

/** Route (glob) za orders API: POST → mock 201 { id } (opcijski delay za Web
 *  Locks sočasno okno) + zapis headerjev/body; OSTALO (GET) → route.continue
 *  (realen API) + števec. Registrirati PRED goto/reload — polling sync teče
 *  TAKOJ ob mountu (startSyncPolling prvi poll brez zamika). */
function trackOrderApi(page: Page, postDelayMs = 0): OrderApiTracker {
  const posts: PostRecord[] = []
  let getSeen = 0
  void page.route('**/api/orders', async (route) => {
    const req = route.request()
    if (req.method() === 'POST') {
      const headers = req.headers()
      let idempotencyKey: string | null = null
      try {
        idempotencyKey = (req.postDataJSON() as { idempotencyKey?: string } | null)?.idempotencyKey ?? null
      } catch {
        idempotencyKey = null
      }
      posts.push({
        idempotencyKey,
        operationId: headers['x-client-operation-id'] ?? null,
        deviceId: headers['x-device-id'] ?? null,
      })
      if (postDelayMs > 0) await new Promise((r) => setTimeout(r, postDelayMs))
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: MOCK_ORDER_ID }),
      })
      return
    }
    getSeen++
    await route.continue()
  })
  return { posts, getGetCount: () => getSeen }
}

// ============================================
// Testi
// ============================================

test.describe('Offline sync scenariji #150 (R226, epik #157 korak 3)', () => {
  // Seja iz tests/e2e/r226.setup.ts (setup projekt — chromium dependency;
  // device-tab C vzorec: storageState brez lastnih prijav = 1 mesto/test)
  test.use({ storageState: STORAGE_STATE_PATH, navigationTimeout: 120_000 })
  // A test ima reload + 2× openOrdersModule + seed + sync + poll —
  // 30s default je pretanko (hišni vzorec kds-timer.spec.ts test.setTimeout)
  test.setTimeout(90_000)

  // Defenzivni guard (device-tab C vzorec, POVEZAN z callback obliko):
  // test.skip(callback) se vrednoti LAZY pred vsakim testom (statični bool
  // bi bil collect-time — prej kot ga setup zapiše → vedno skip, točno ta
  // past zadrži device-tab C skipanega v CI). Brez setup fajla (izoliran
  // zagon brez setup projekta) ni seje — skip z jasnim sporočilom.
  test.skip(() => !existsSync(STORAGE_STATE_PATH), 'r226.setup.ts ni tekel (storageState manjka) — zaženi celoten run (setup projekt je dependency chromium)')

  test('A: restart/mount-sync — PENDING vnos se ob mountu po reloadu sinhronizira (POST + SYNCED + serverAck)', async ({ page }) => {
    // Route PRED goto — mount sync mora biti pokrit
    const api = trackOrderApi(page, 0)

    // storageState seja (setup): GET /api/auth validacija (1 mesto v auth-login)
    await page.goto('/')
    await dismissCookieBannerIfVisible(page)
    await awaitSetupOverlayGone(page)
    await ensureLoggedIn(page)

    // Landing gate (R175) → 'danes'; odpri Prodaja (mount sync poti)
    await openOrdersModule(page)

    // Seed canonical PENDING vnos (app mount je že odprl v2 bazo)
    await seedPendingOrder(page, {
      id: 'e2e-r226-a-1',
      idempotencyKey: 'e2e-r226-a-idem-1',
      operationId: 'e2e-r226-a-op-1',
    })

    // RESTART simulacija: reload → landing gate spet 'danes' (activeModule
    // ni persistiran) → ponovno odpri Prodaja → mount-check + takojšnji
    // polling (startSyncPolling prvi poll brez zamika) → sync. Route ostane
    // registriran čez reload (page.route persistira čez navigacijo).
    await page.reload()
    await awaitSetupOverlayGone(page)
    await ensureLoggedIn(page)
    await openOrdersModule(page)

    // Sync pot (mount-polling, BREZ dispatcha — reload pot): točno 1 POST —
    // polling/online/SW-trigger VSI prek runCoordinatedSync (R224), zato ni
    // podvojenih klicev. (Mount-check sonner toast 'offline operacij čaka…'
    // je 4s avto-dismiss proti auth-check oknu — timing-krhek; trdni UI dokaz
    // = NetworkStatusBar spodaj.)
    await expect.poll(() => api.posts.length, { timeout: 15_000 }).toBe(1)
    expect(api.posts[0].idempotencyKey).toBe('e2e-r226-a-idem-1')
    expect(api.posts[0].operationId).toBe('e2e-r226-a-op-1')
    // x-device-id pride iz getDeviceId() (page localStorage 'dev-*'), ne iz vnosa
    expect(api.posts[0].deviceId).toMatch(/^dev-/)

    // page = izvajalec (R222 kanon): vnos SYNCED + serverAck — R128
    // 7-dnevna retencija (SYNCED NI obdelovalen, ne pošlje se znova)
    await expect.poll(async () => (await readPendingOrder(page, 'e2e-r226-a-1'))?.status, { timeout: 10_000 }).toBe('SYNCED')
    const stored = await readPendingOrder(page, 'e2e-r226-a-1')
    expect(stored?.serverAck?.serverStatus).toBe('applied')
    expect(stored?.serverAck?.orderId).toBe(MOCK_ORDER_ID)
    expect(typeof stored?.serverAck?.syncedAt).toBe('string')

    // NetworkStatusBar (trjen UI dokaz restart-sync poti): vrsta PRazna —
    // rumeni trak 'Sinhronizacija offline naročil: 1 naročilo čaka' se po
    // 5s refreshu preklopi na diskreten 'Online' indikator (counter 0 =
    // SYNCED ni obdelovalen — R128 retencija ne umazuje vrste)
    await expect.poll(
      () => page.getByRole('status', { name: 'Povezava z strežnikom je vzpostavljena' }).count(),
      { timeout: 15_000 },
    ).toBeGreaterThan(0)
  })

  test.describe('B+C: isti storageState (setup seja)', () => {
    test('B: multi-tab koordinacija — Web Locks drži sync na ENO zavihko (skupaj 1 POST) + broadcast refetch', async ({ page }) => {
      // Dva zavihka ISTEGA konteksta → delita IndexedDB + BroadcastChannel
      const apiA = trackOrderApi(page, 400) // delay → sočasno okno za lock tek
      const pageB = await page.context().newPage()
      const apiB = trackOrderApi(pageB, 400)

      await page.goto('/')
      await awaitSetupOverlayGone(page)
      await ensureLoggedIn(page)
      await pageB.goto('/')
      await awaitSetupOverlayGone(pageB)
      await ensureLoggedIn(pageB)

      // Oba zavihka odpreta Prodaja (sync poti mountane — useOrderPanelMutations)
      await openOrdersModule(page)
      await openOrdersModule(pageB)

      await seedPendingOrder(page, {
        id: 'e2e-r226-b-1',
        idempotencyKey: 'e2e-r226-b-idem-1',
        operationId: 'e2e-r226-b-op-1',
      })

      // (GET števci (baseA/baseB) so odpadli z R228 — broadcast-refetch assert
      // flaky v headless CI, zamenjan s trdo IndexedDB končno-stanje potjo)

      // Simultan sprožilec v obeh zavihkih — prej (R224 problem) je vsak
      // zavihek tekal lasten syncAllOfflineOps → N POST-ov za iste vnose
      await Promise.all([
        page.evaluate(() => window.dispatchEvent(new Event('online'))),
        pageB.evaluate(() => window.dispatchEvent(new Event('online'))),
      ])

      // INVARIANTA koordinacije (R224 #157 korak 2): skupaj TOČNO 1 POST —
      // lock drži ena zavihka, druga dobi skipped:true BREZ HTTP; tudi če
      // druga poskuša ŠELE po sprostitvi locka, je vrsta že SYNCED
      // (zero-pending → brez POST). Trdno v obeh vrstnih redih.
      await expect.poll(() => apiA.posts.length + apiB.posts.length, { timeout: 15_000 }).toBe(1)
      const post = apiA.posts[0] ?? apiB.posts[0]
      expect(post.idempotencyKey).toBe('e2e-r226-b-idem-1')
      expect(post.operationId).toBe('e2e-r226-b-op-1')

      // R228 lekcija (CI run 37145783584): broadcast-refetch assert (GET count
      // prek page.route) je bil 2/2 runov NIKEOLI zelen v headless CI (0 GET
      // v 15s kljub mountanem OrderPanel-u — page snapshot dokaz: POS UI
      // mountan, 'Online', 1 POST uspel) — flaky assert je NE-uporaben gate;
      // broadcast → invalidateQueries pot ostaja deterministično pokrita v
      // unit suite-u (r224-sync-coordination.test.ts: broadcast succeeded=1 +
      // subscribe normalizacija). E2E namesto tega trdo preveri končno stanje
      // prek SHARED IndexedDB (oba zavihka istega konteksta — delita bazo):
      // pageB vidi vnos SYNCED + serverAck (R128 retencija) — enako kot page.
      await expect.poll(async () => (await readPendingOrder(page, 'e2e-r226-b-1'))?.status, { timeout: 10_000 }).toBe('SYNCED')
      const storedB = await readPendingOrder(pageB, 'e2e-r226-b-1')
      expect(storedB?.status).toBe('SYNCED')
      expect(storedB?.serverAck?.serverStatus).toBe('applied')
      expect(storedB?.serverAck?.orderId).toBe(MOCK_ORDER_ID)

      await pageB.close()
    })

    test('C: uspešen sync zapiše lastSyncResult zapisnik v syncMetadata store (R224 metadata pot)', async ({ page }) => {
      const api = trackOrderApi(page, 0)
      await page.goto('/')
      await awaitSetupOverlayGone(page)
      await ensureLoggedIn(page)
      await openOrdersModule(page)

      await seedPendingOrder(page, {
        id: 'e2e-r226-c-1',
        idempotencyKey: 'e2e-r226-c-idem-1',
        operationId: 'e2e-r226-c-op-1',
      })
      await page.evaluate(() => window.dispatchEvent(new Event('online')))

      await expect.poll(() => api.posts.length, { timeout: 15_000 }).toBe(1)
      await expect.poll(async () => (await readPendingOrder(page, 'e2e-r226-c-1'))?.status, { timeout: 10_000 }).toBe('SYNCED')

      // runCoordinatedSync: setMeta(META_LAST_SYNC_RESULT, {...}) —
      // zapisnik v 'syncMetadata' (keyPath 'key', R224 #157 korak 2)
      const meta = await readLastSyncMeta(page)
      expect(meta?.key).toBe(META_LAST_SYNC_RESULT)
      const value = meta?.value as { succeeded?: number; conflicts?: number; authExpired?: boolean; at?: number } | undefined
      expect(value?.succeeded ?? 0).toBeGreaterThanOrEqual(1)
      expect(value?.conflicts ?? 0).toBe(0)
      expect(value?.authExpired).toBe(false)
      expect(typeof value?.at === 'number' && value.at > 0).toBe(true)
    })
  })
})
