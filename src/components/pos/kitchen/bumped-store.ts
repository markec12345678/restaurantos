'use client'

// ============================================
// KDS BUMP STORE (Toast vzorec — runda 26-b)
// ============================================
// "Bump" je pri Toast KDS akcija PRIKAZA, ne življenjskega cikla naročila:
// kuhar odstrani gotovo naročilo z ekrana (prevzem), naročilo pa ostane
// statusa 'ready' v bazi — plačilo/zaključek ostane naloga natakarja.
//
// Zato je bump čisto odjemalski state (zustand persist):
//  - ni tveganja bypass-a "neplačano → completed" (P2-UX potrditev ostane
//    nedotaknjena na natakarjevi strani),
//  - deluje tudi offline (KDS je pogosto na slabem WiFi),
//  - Recall vrne spremembo takoj, brez omrežnega klica.
// Vpisi se samodejno občudijo (2 h) — store ne raste neskončno.

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { EnrichedOrder } from './types'

/** Vpisi starejši od tega se štejejo za zastarele (2 h). */
export const BUMPED_MAX_AGE_MS = 2 * 60 * 60 * 1000

export type BumpedAtMap = Record<string, number>

// --------------------------------------------
// Čisti helperji (node-testabilni, brez react)
// --------------------------------------------

/** Zapiši bump — obstoječ vnos ostane (prvi timestamp je "kaj prej bumpal"). */
export function bumpEntry(map: BumpedAtMap, orderId: string, now: number): BumpedAtMap {
  if (map[orderId] !== undefined) return map
  return { ...map, [orderId]: now }
}

/** Odstrani bump (recall posameznega naročila). */
export function removeEntry(map: BumpedAtMap, orderId: string): BumpedAtMap {
  if (map[orderId] === undefined) return map
  const next = { ...map }
  delete next[orderId]
  return next
}

/** Občudi zastarele vpise (starejše od maxAgeMs). */
export function pruneBumpedEntries(map: BumpedAtMap, now: number, maxAgeMs = BUMPED_MAX_AGE_MS): BumpedAtMap {
  let changed = false
  const next: BumpedAtMap = {}
  for (const [id, ts] of Object.entries(map)) {
    if (now - ts <= maxAgeMs) {
      next[id] = ts
    } else {
      changed = true
    }
  }
  return changed ? next : map
}

/** Ready naročila, ki še NISO bumpana (starejši bumpani pushamo na konec za recall-red). */
export function getVisibleReadyOrders(readyOrders: EnrichedOrder[] | undefined, bumpedAt: BumpedAtMap): EnrichedOrder[] {
  const list = Array.isArray(readyOrders) ? readyOrders : []
  return list.filter(o => !bumpedAt[o.id])
}

// --------------------------------------------
// Store
// --------------------------------------------

interface KdsBumpedState {
  bumpedAt: BumpedAtMap
  /** Bump (odstrani z ekrana). Idempotentno. */
  bump: (orderId: string, now?: number) => void
  /** Recall posameznega naročila. */
  recall: (orderId: string) => void
  /** Recall vseh bumpanih (en klik — Toast vzorec "Recall All"). */
  recallAll: () => void
  /** Počisti zastarele vpise (pokliče rehydrate hook). */
  prune: (now?: number) => void
}

export const useKdsBumpedStore = create<KdsBumpedState>()(
  persist(
    (set) => ({
      bumpedAt: {},
      bump: (orderId, now) =>
        set(state => ({ bumpedAt: bumpEntry(state.bumpedAt, orderId, now ?? Date.now()) })),
      recall: orderId =>
        set(state => ({ bumpedAt: removeEntry(state.bumpedAt, orderId) })),
      recallAll: () => set({ bumpedAt: {} }),
      prune: now =>
        set(state => ({ bumpedAt: pruneBumpedEntries(state.bumpedAt, now ?? Date.now()) })),
    }),
    {
      name: 'kds-bumped-v1',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => state => {
        // Po rehydrataciji občudi zastarele vpise (npr. zaprt KDS čez vikend)
        state?.prune()
      },
    }
  )
)
