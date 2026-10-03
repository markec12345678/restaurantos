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
//   mejo. Brez setup fajla (izoliran zagon brez dependency) → vse skip
//   (existsSync guard, device-tab C vzorec).
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

/** Marker prijavljenega POS UI-ja: page.tsx renderira main#main-content
 *  IZKLJUČNO onstran prijave; PIN-dialog pa je takrat poskenjen. */
async function expectLoggedInUi(page: Page): Promise<void> {
  await expect(page.locator('#main-content')).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('[role="dialog"][aria-label="PIN prijava"]')).toBeHidden()
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
 *  Resilience: dev-only turbopack chunk flake (dynamic OrderPanel import iz
 *  druge strani) občasno ujame ErrorBoundary ('Napaka v POS:orders') —
 *  'Poskusi znova' resetira modul (boundary maxRetries=3); CI standalone
 *  build chunk racea nima. */
async function openOrdersModule(page: Page): Promise<void> {
  await page.locator('button[aria-label="Prodaja"]').click()
  const target = page.getByRole('radiogroup', { name: 'Vrsta naročila' })
  // Zanka (skupaj ~40s + final 20s): pokrije mrzel turbopack compile (~30-60s
  // lokalno) in nestabilen transient (fallback blik → gumb izgine — vsi klik
  // z kratkim timeoutom + catch, da zanka vedno napreduje). CI standalone
  // (statični chunki): prvi isVisible() takoj PASS.
  for (let attempt = 0; attempt < 4; attempt++) {
    if (await target.isVisible().catch(() => false)) return
    await page.getByRole('button', { name: 'Poskusi znova' }).click({ timeout: 3_000 }).catch(() => undefined)
    if (await target.isVisible().catch(() => false)) return
    await page.locator('button[aria-label="Prodaja"]').click({ timeout: 3_000 }).catch(() => undefined)
    await target.waitFor({ state: 'visible', timeout: 4_000 }).catch(() => undefined)
  }
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
    await expectLoggedInUi(page)

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
    await expectLoggedInUi(page)
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
      await expectLoggedInUi(page)
      await pageB.goto('/')
      await awaitSetupOverlayGone(pageB)
      await expectLoggedInUi(pageB)

      // Oba zavihka odpreta Prodaja (sync poti mountane — useOrderPanelMutations)
      await openOrdersModule(page)
      await openOrdersModule(pageB)

      await seedPendingOrder(page, {
        id: 'e2e-r226-b-1',
        idempotencyKey: 'e2e-r226-b-idem-1',
        operationId: 'e2e-r226-b-op-1',
      })

      // Baseline GET števcev (mount refetchi so se zgodili pred tem)
      const baseA = apiA.getGetCount()
      const baseB = apiB.getGetCount()

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

      // Broadcast OFFLINE_SYNC_COMPLETED (succeeded=1) → OBADVA zavihka
      // invalidateQueries(orders.all) → aktivna byStatus useQuery
      // refetcha GET /api/orders (stale zavihka osvežena, brez toastov)
      await expect.poll(async () => apiB.getGetCount() - baseB, { timeout: 15_000 }).toBeGreaterThan(0)
      await expect.poll(async () => apiA.getGetCount() - baseA, { timeout: 15_000 }).toBeGreaterThan(0)

      await pageB.close()
    })

    test('C: uspešen sync zapiše lastSyncResult zapisnik v syncMetadata store (R224 metadata pot)', async ({ page }) => {
      const api = trackOrderApi(page, 0)
      await page.goto('/')
      await awaitSetupOverlayGone(page)
      await expectLoggedInUi(page)
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
