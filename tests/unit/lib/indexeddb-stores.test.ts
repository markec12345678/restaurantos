// ============================================
// INDEXEDDB STORES — Unit testi (Issue #42)
//
// Preverjamo da dokumentacija o številu IndexedDB trgovin ustreza
// dejanski kodi. V preteklosti je README trdil "22 trgovin" — napačno.
// Dejansko število: 2 (pendingOrders + pendingReceipts).
// ============================================

import { describe, it, expect } from 'vitest'
import { INDEXEDDB_STORES, INDEXEDDB_STORE_COUNT } from '@/lib/offline-furs'

describe('Issue #42 — IndexedDB store count documentation', () => {
  it('INDEXEDDB_STORE_COUNT je 2 (ne 22)', () => {
    expect(INDEXEDDB_STORE_COUNT).toBe(2)
    expect(INDEXEDDB_STORE_COUNT).not.toBe(22)
  })

  it('INDEXEDDB_STORES vsebuje pendingOrders + pendingReceipts', () => {
    expect(INDEXEDDB_STORES).toContain('pendingOrders')
    expect(INDEXEDDB_STORES).toContain('pendingReceipts')
  })

  it('INDEXEDDB_STORES ima točno 2 vnose', () => {
    expect(INDEXEDDB_STORES).toHaveLength(2)
  })

  it('INDEXEDDB_STORES je array z 2 elementoma', () => {
    // `as const` naredi TypeScript readonly tuple, ne runtime frozen
    expect(Array.isArray(INDEXEDDB_STORES)).toBe(true)
    expect(INDEXEDDB_STORES.length).toBe(2)
  })
})
