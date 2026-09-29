// ============================================
// INDEXEDDB STORES — Unit testi (Issue #42)
//
// Preverjamo da dokumentacija o številu IndexedDB trgovin ustreza
// dejanski kodi. V preteklosti je README trdil "22 trgovin" — napačno.
//
// R170 (R166-F7): FURS offline queue ('pendingReceipts' + modul
// offline-furs) izbrisana — mrtva veriga: registerFursBackgroundSync
// 0 klicalcev (tag se nikoli registriral), enqueueReceipt 0 klicalcev
// (queue se nikoli ni napolnila), sw.js POST pa bi bil 401 kljub
// napačnemu "cookie auth" komentarju (requireAuth je Bearer-only).
// Pravi FURS retry mehanizem = server-side outbox
// (src/lib/outbox/processors/furs.ts, retry + dead_letter).
// Dejansko število trgovin: 1 (pendingOrders).
// ============================================

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { INDEXEDDB_STORES, INDEXEDDB_STORE_COUNT } from '@/lib/offline-orders'

const swSrc = readFileSync(path.join(process.cwd(), 'public', 'sw.js'), 'utf-8')

describe('Issue #42 — IndexedDB store count documentation', () => {
  it('INDEXEDDB_STORE_COUNT je 1 (ne 22; 2→1 po R170)', () => {
    expect(INDEXEDDB_STORE_COUNT).toBe(1)
    expect(INDEXEDDB_STORE_COUNT).not.toBe(22)
  })

  it('INDEXEDDB_STORES vsebuje pendingOrders', () => {
    expect(INDEXEDDB_STORES).toContain('pendingOrders')
  })

  it('INDEXEDDB_STORES NE vsebuje pendingReceipts (FURS store izbrisan R170)', () => {
    expect(INDEXEDDB_STORES).not.toContain('pendingReceipts')
  })

  it('INDEXEDDB_STORES ima točno 1 vnos', () => {
    expect(INDEXEDDB_STORES).toHaveLength(1)
  })
})

describe('R170 (R166-F7) — FURS SW sync veriga izbrisana', () => {
  it('sw.js ne vsebuje več furs-receipt-sync CODE veje (komentarji smejo omenjati)', () => {
    expect(swSrc).not.toContain("event.tag === 'furs-receipt-sync'")
  })

  it('sw.js ne vsebuje več definicij syncFursReceipts / IndexedDB FURS helperjev', () => {
    expect(swSrc).not.toContain('function syncFursReceipts')
    expect(swSrc).not.toContain('function openFursQueueDB')
    expect(swSrc).not.toContain('function getFursPendingReceipts')
    expect(swSrc).not.toContain('function removeFursReceipt')
    expect(swSrc).not.toContain('syncFursReceipts()')
  })

  it('sw.js ohranja R170 opombo o izbrisani sekciji (dokumentacija namesto kode)', () => {
    expect(swSrc).toContain('server-side outbox')
    expect(swSrc).toContain('processors/furs.ts')
  })

  it('orders Background Sync veja ostane živa (sync-pending-orders + offline-order-sync)', () => {
    expect(swSrc).toContain("'sync-pending-orders'")
    expect(swSrc).toContain("'offline-order-sync'")
    expect(swSrc).toContain('syncPendingOrders()')
  })

  it('živi FURS retry = server-side outbox processor', () => {
    const procSrc = readFileSync(
      path.join(process.cwd(), 'src', 'lib', 'outbox', 'processors', 'furs.ts'),
      'utf-8'
    )
    expect(procSrc).toContain('verifyInvoiceWithFURS')
    expect(procSrc).toContain('getFursConfig')
  })
})
