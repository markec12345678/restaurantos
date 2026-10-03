// ============================================
// R222 (#157 korak 1) — CANONICAL IndexedDB KONTRAKT
// ============================================
// Enota izvora resnice za offline order queue shemo (KNOWN_ISSUES #49):
// prej je page pisal v 'restaurantos-offline-queue' v1, Service Worker pa
// odpiral POVSEM DRUGO bazo 'restaurantos-offline' v2 — Background Sync je
// bil end-to-end mrtva pot (syncPendingOrders pobere 0 vnosov).
//
// Ta modul je EDINI vir imen/verzij store-ov:
//   - page (src/lib/offline-orders/index.ts) importira od tu,
//   - sw.js (plain JS, brez bundlerja) zrcali vrednosti — pariteto varuje
//     drift-gate tests/unit/lib/r222-sw-canonical-db.test.ts.
//
// R222 kanon avtenticiranja (zapira varnostno ploskev #155 §26 / #157 §14):
// requireAuth je Bearer-only + POST potrebuje x-csrf-token (cookie) —
// auth kontekst obstaja IZKLJUČNO v page kontekstu. Service Worker zato
// NIKOLI ne odpira IndexedDB in NIKOLI ne drži tokena: 'sync' event je
// SPROŽILEC (notifyClient → page izvede syncAllOfflineOps z authFetch).
// Zaprt page: PENDING vnosi počakajo naslednji open (mount-sync + polling
// + online listener). SW bearer-token-iz-IndexedDB mehanika IZBRISANA.

/** Canonical page/SW queue baza — EDINO ime, ki sme obstajati. */
export const OFFLINE_DB_NAME = 'restaurantos-offline-queue'

/** Canonical verzija — R224 (#157 korak 2): dvignjena 1→2 Z migracijsko verigo
 *  (dodan 'syncMetadata' store; obstoječe v1 baze dobijo store prek
 *  onupgradeneeded — pendingOrders podatki ostanejo nedotaknjeni). */
export const OFFLINE_DB_VERSION = 2

/** Canonical object store (od R170: edini store — FURS store izbrisan). */
export const OFFLINE_STORE_NAME = 'pendingOrders'

/**
 * R224 (#157 korak 2): metadata store — KV zapisnik sinhronizacije
 * (zadnji sync poskus/izid, revizija legacy SW migracije). keyPath: 'key'.
 * SW ga NIKOLI ne odpira (kanon: SW = sprožilec, page = izvajalec).
 */
export const OFFLINE_METADATA_STORE = 'syncMetadata'

/**
 * LEGACY SW baza ('restaurantos-offline' v2) — dual-DB defekt #49.
 * Nikoli je ni smela obstajati; migrateLegacySwDb (index.ts) obstoječe
 * operacionalne vnose PRED pisanjem SKOPIRA in šele potem izbriše
 * ("delete and hope" prepovedano), terminalne/history vnose pusti v arhivu.
 */
export const LEGACY_SW_DB_NAME = 'restaurantos-offline'
export const LEGACY_SW_DB_VERSION = 2

/** SW → page sporočilo: Background Sync sprožil takojšnjo sinhronizacijo. */
export const SYNC_TRIGGER_MESSAGE_TYPE = 'TRIGGER_ORDER_SYNC'

// ── R224 (#157 korak 2): več-zavihkova koordinacija synca ──
// Web Locks: izključni lock — v istem trenutku sync izvaja TOČNO ENA zavihka
// (prej: N zavihkov = N vzporednih syncAllOfflineOps — dvojni POST-i so
// sicer pokriti z idempotencyKey, PROCESSING pa je tekal po vseh).
export const SYNC_LOCK_NAME = 'restaurantos-offline-sync-lock'

/** BroadcastChannel kanal — izvorna zavihka obvesti ostale o izidu synca
 *  (ostale osvežijo query cache; brez toastov — izvorna že obvesti). */
export const SYNC_BROADCAST_CHANNEL = 'restaurantos-offline-sync-bc'

/** Broadcast sporočilo: sync zaključen (spremlja succeeded/conflicts/authExpired). */
export const SYNC_BROADCAST_COMPLETED = 'OFFLINE_SYNC_COMPLETED'

/** Well-known metadata ključi (KV zapisnik v 'syncMetadata' store-u). */
export const META_LAST_SYNC_RESULT = 'lastSyncResult'
export const META_LEGACY_MIGRATION = 'legacySwMigration'

/** Inventar trgovin (Issue #42 dokumentacijska resnica; R170: 1 store →
 *  R224 #157 korak 2: 2 — + syncMetadata; 'pendingReceipts' FURS vrsta
 *  ostaja izbrisana R170). */
export const INDEXEDDB_STORES = ['pendingOrders', 'syncMetadata'] as const
export const INDEXEDDB_STORE_COUNT = INDEXEDDB_STORES.length // = 2
