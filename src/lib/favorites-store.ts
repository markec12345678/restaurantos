'use client'

// ============================================
// STORE: Priljubljeni artikli (Favorites)
// NOVO (QA 2026-09-17, runda 4): natakar/kelner z enim tapom označi
// svoje najpogostejše artikle — "★ Priljubljeni" filter v POS mreži
// jih prikaže čez vse menije/kategorije.
//
// Persist v localStorage (per naprava — vsaka tablica ima svoje
// priljubljene, kar je OK za hitrost delovanja). Brez server round-tripa.
// ============================================

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface FavoritesState {
  /** ID-ji priljubljenih menu artiklov */
  ids: string[]
  toggle: (id: string) => void
  isFavorite: (id: string) => boolean
  clear: () => void
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      ids: [],
      toggle: (id) =>
        set((s) => ({
          ids: s.ids.includes(id) ? s.ids.filter((x) => x !== id) : [...s.ids, id],
        })),
      isFavorite: (id) => get().ids.includes(id),
      clear: () => set({ ids: [] }),
    }),
    {
      name: 'pos-favorites-v1',
      storage: createJSONStorage(() => localStorage),
      // SSR varnost: hydrate šele na clientu (grid se renda šele po prijavi)
      skipHydration: true,
    },
  ),
)
