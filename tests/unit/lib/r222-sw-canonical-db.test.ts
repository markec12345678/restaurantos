// ============================================
// R222 (#157 korak 1, KNOWN_ISSUES #49) — SW CANONICAL-DB KANON
//
// Dual-IndexedDB defekt (#49, R203 odkritje): page je pisal v
// 'restaurantos-offline-queue' v1, Service Worker pa odpiral POVSEM DRUGO
// bazo 'restaurantos-offline' v2 — SW syncPendingOrders je pobral 0 vnosov,
// Background Sync end-to-end mrtva pot. SW HTTP pot je ŠE brala Bearer
// token iz IndexedDB (order.authToken — polja v page shemi nikoli ni bilo
// → vedno 401) in pošiljala brez x-csrf-token.
//
// R222 kanon: SW = SPROŽILEC (TRIGGER_ORDER_SYNC notifyClient), page =
// IZVAJALEC (syncAllOfflineOps z authFetch — Bearer + CSRF obstajata
// izključno v page kontekstu; SW nikoli ne drži tokena — zapira #155 §26 /
// #157 §14 varnostno ploskev). Legacy SW baza se migrira page-side
// (migrateLegacySwDb — copy-verified, "delete and hope" prepovedano).
//
// Pariteta page↔SW kontrakta (sw.js je plain JS brez bundlerja — ne more
// importirati db-contract.ts) je varovana z drift-gate pini — isti vzorec
// kot json-fields-schema-parity (R197) in indexeddb-stores (Issue #42).
// ============================================

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  OFFLINE_DB_NAME,
  OFFLINE_DB_VERSION,
  OFFLINE_STORE_NAME,
  LEGACY_SW_DB_NAME,
  LEGACY_SW_DB_VERSION,
  SYNC_TRIGGER_MESSAGE_TYPE,
} from '@/lib/offline-orders/db-contract'
import { INDEXEDDB_STORES, INDEXEDDB_STORE_COUNT } from '@/lib/offline-orders'

const swSrc = readFileSync(path.join(process.cwd(), 'public', 'sw.js'), 'utf-8')
const indexSrc = readFileSync(path.join(process.cwd(), 'src', 'lib', 'offline-orders', 'index.ts'), 'utf-8')
const hookSrc = readFileSync(
  path.join(process.cwd(), 'src', 'components', 'pos', 'order', 'useOrderPanelMutations.ts'),
  'utf-8',
)

describe('R222 — canonical IndexedDB kontrakt (db-contract.ts)', () => {
  it('OFFLINE_DB_NAME je page-canonical ime (restaurantos-offline-queue)', () => {
    expect(OFFLINE_DB_NAME).toBe('restaurantos-offline-queue')
    expect(OFFLINE_DB_NAME).not.toBe('restaurantos-offline')
  })

  it('OFFLINE_DB_VERSION je 1 (dvig verzije gre Z migracijsko verigo, #157 korak 2)', () => {
    expect(OFFLINE_DB_VERSION).toBe(1)
  })

  it('OFFLINE_STORE_NAME je pendingOrders (R170: edini store)', () => {
    expect(OFFLINE_STORE_NAME).toBe('pendingOrders')
  })

  it('LEGACY_SW_DB_NAME/VERSION dokumentirata dual-DB defekt (arhivska markacija)', () => {
    expect(LEGACY_SW_DB_NAME).toBe('restaurantos-offline')
    expect(LEGACY_SW_DB_VERSION).toBe(2)
  })

  it('SYNC_TRIGGER_MESSAGE_TYPE je TRIGGER_ORDER_SYNC', () => {
    expect(SYNC_TRIGGER_MESSAGE_TYPE).toBe('TRIGGER_ORDER_SYNC')
  })

  it('index.ts re-exportira INDEXEDDB_STORES iz kontrakta (enoten vir resnice)', () => {
    expect(INDEXEDDB_STORES).toEqual(['pendingOrders'])
    expect(INDEXEDDB_STORE_COUNT).toBe(1)
  })

  it('index.ts NE deklarira več lokalnih DB konstant (importira od db-contract)', () => {
    expect(indexSrc).toContain("from './db-contract'")
    expect(indexSrc).not.toContain("const DB_NAME = 'restaurantos-offline-queue'")
    expect(indexSrc).not.toContain("const DB_VERSION = 1")
    expect(indexSrc).not.toContain("const STORE_NAME = 'pendingOrders'")
  })
})

describe('R222 — sw.js trigger kanon (mrtva HTTP/dual-DB mehanika izbrisana)', () => {
  it('sw.js NE odpira nobene IndexedDB (kanon: SW nikoli ne bere/piše queue)', () => {
    expect(swSrc).not.toContain('indexedDB.open')
    expect(swSrc).not.toContain('indexedDB.deleteDatabase')
    expect(swSrc).not.toContain('createObjectStore')
  })

  it('sw.js ne vsebuje več SW HTTP sync poti (Bearer iz IndexedDB / stale endpoint)', () => {
    expect(swSrc).not.toContain('function syncPendingOrders')
    expect(swSrc).not.toContain("fetch('/api/orders'")
    expect(swSrc).not.toContain("Authorization']")
    expect(swSrc).not.toContain('if (order.authToken)')
    expect(swSrc).not.toContain('X-Offline-Created-At')
  })

  it('sw.js ne vsebuje več IDB pomožnikov mrtve mehanike', () => {
    expect(swSrc).not.toContain('function openOfflineDB')
    expect(swSrc).not.toContain('function deletePendingOrder')
    expect(swSrc).not.toContain('function updatePendingOrderRetry')
    expect(swSrc).not.toContain('function markPendingOrderStatus')
    expect(swSrc).not.toContain('idbRequestToPromise')
  })

  it('sw.js sync handler je trigger kanon (obe registracijski taga pokrita)', () => {
    expect(swSrc).toContain("event.tag === 'sync-pending-orders'")
    expect(swSrc).toContain("event.tag === 'offline-order-sync'")
    expect(swSrc).toContain('event.waitUntil(triggerClientOrderSync())')
    expect(swSrc).toContain(SYNC_TRIGGER_MESSAGE_TYPE)
  })

  it('sw.js ohranja R170 opombo (FURS outbox kanon) + cache-refresh vejo', () => {
    expect(swSrc).toContain('server-side outbox')
    expect(swSrc).toContain('processors/furs.ts')
    expect(swSrc).toContain("event.tag === 'sync-cache-refresh'")
  })

  it('sw.js nosi R222 kanon opombo (trigger/izvajalec razdelitev)', () => {
    expect(swSrc).toContain('SPROŽILEC')
    expect(swSrc).toContain('requireAuth je Bearer-only')
    expect(swSrc).toContain('#155 §26')
  })
})

describe('R222 — page-side izvajalec (hook + migracija)', () => {
  it('useOrderPanelMutations posluša TRIGGER_ORDER_SYNC in izvede syncAllOfflineOps', () => {
    expect(hookSrc).toContain("data?.type === 'TRIGGER_ORDER_SYNC'")
    expect(hookSrc).toContain('handleSwTrigger')
    expect(hookSrc).toContain('syncAllOfflineOps')
  })

  it('index.ts ima migrateLegacySwDb (copy-verified migracija, ne "delete and hope")', () => {
    expect(indexSrc).toContain('export async function migrateLegacySwDb')
    expect(indexSrc).toContain('const okPut = await putOp(copied)')
    expect(indexSrc).toContain('deleteDatabase(LEGACY_SW_DB_NAME)')
    expect(indexSrc).toContain('"delete and hope" je prepovedano')
  })

  it('migracija NE prenaša Bearer tokena (#155 §26 — varnostna ploskev)', () => {
    expect(indexSrc).toContain('Bearer token (order.authToken) se NAMERNO ne prenaša')
  })

  it('migracija statusnih pravil: operacionalen = PENDING/RETRY/zastarel PROCESSING', () => {
    expect(indexSrc).toContain("status === 'PENDING' || status === 'RETRY'")
    expect(indexSrc).toContain("status === 'PROCESSING'")
  })

  it('migracija je gated na pravi brskalniški kontekst (testni IDB dvojniki delijo store čez imena)', () => {
    expect(indexSrc).toContain(
      "if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return 0",
    )
  })
})

describe('R222 — page↔SW kontraktna pariteta (cross-file drift-gate)', () => {
  it('SW trigger tip ≡ kontraktna konstanta (byte-exact, kot json-fields-schema-parity)', () => {
    // sw.js je plain JS — vrednost se zrcali ročno; pin uveljavlja enakost.
    const swMatch = swSrc.match(/const SYNC_TRIGGER_MESSAGE_TYPE = '([^']+)'/)
    expect(swMatch).not.toBeNull()
    expect(swMatch![1]).toBe(SYNC_TRIGGER_MESSAGE_TYPE)
  })

  it('LEGACY ime obstaja IZKLJUČNO v kontraktu/migraciji (sw.js ga ne pozna)', () => {
    // sw.js sme imeti samo zgodovinsko opombo v komentarju — brez odpiranja baze
    expect(swSrc).not.toContain("open('restaurantos-offline'")
    expect(LEGACY_SW_DB_NAME).toBe('restaurantos-offline')
  })
})
