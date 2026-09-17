'use client'

// ============================================
// STORE: Nedavno dodani artikli (Recents)
// NOVO (QA 2026-09-17, runda 25 — UI/UX primerjava z najboljšimi POS):
// Square POS ima "Recents" hitro vrstico — kelner z ENIM tapom ponovno
// doda artikla, ki ga je pravkar naročil (kava, pivo, namizne rezervacije).
// Toast/Lightspeed imajo enak vzorec ("Recent items" / "Quick re-order").
//
// Persist v localStorage (per naprava — vsaka tablica ima svojo zgodovino,
// kar je OK za hitrost delovanja). Brez server round-tripa.
// Kliče se iz MenuItemsGrid prek lastAddedId (potrjen dodatek v košarico).
// ============================================

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

/** Največje število nedavnih artiklov v hitri vrstici (Square prikazuje ~10) */
export const RECENTS_MAX = 8

/**
 * Čista funkcija — vstavi id na začetek, odstrani duplikate, obreže na max.
 * Ločena od store-a za testabilnost brez localStorage/DOM.
 */
export function recordRecentId(prev: string[], id: string, max = RECENTS_MAX): string[] {
  const next = [id, ...prev.filter((x) => x !== id)]
  return next.slice(0, max)
}

interface RecentsState {
  /** ID-ji nedavno dodanih artiklov (najnovejši prvi) */
  ids: string[]
  /** Zabeleži potrjen dodatek artikla v košarico */
  record: (id: string) => void
  clear: () => void
}

export const useRecentsStore = create<RecentsState>()(
  persist(
    (set) => ({
      ids: [],
      record: (id) => set((s) => ({ ids: recordRecentId(s.ids, id) })),
      clear: () => set({ ids: [] }),
    }),
    {
      name: 'pos-recents-v1',
      storage: createJSONStorage(() => localStorage),
      // SSR varnost: hydrate šele na clientu (grid se renda šele po prijavi)
      skipHydration: true,
    },
  ),
)
