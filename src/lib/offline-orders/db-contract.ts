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

/** Canonical verzija — dvig Z VEJO (migracijska veriga #157 korak 2). */
export const OFFLINE_DB_VERSION = 1

/** Canonical object store (od R170: edini store — FURS store izbrisan). */
export const OFFLINE_STORE_NAME = 'pendingOrders'

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

/** Inventar trgovin (Issue #42 dokumentacijska resnica; R170: 1 store). */
export const INDEXEDDB_STORES = ['pendingOrders'] as const
export const INDEXEDDB_STORE_COUNT = INDEXEDDB_STORES.length // = 1
