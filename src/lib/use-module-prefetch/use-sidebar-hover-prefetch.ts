'use client'

// ============================================
// HOOK: useSidebarHoverPrefetch
// ============================================

import { useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { authFetch, getAuthToken } from '@/components/pos/PinLogin'
import { modulePrefetchMap } from './config'
import { normalizePrefetchData } from './use-module-prefetch'
import type { ModuleName } from './config'

/**
 * Hook, ki prednaloži podatke, ko uporabnik hoverja nad gumbom modula v stranski vrstici.
 *
 * Hitrejši od čakanja na klik — podatki se začnejo nalagati
 * že ob hoverju, ki praviloma mine 100-300ms pred klikom.
 *
 * FIX NAPAKA 5 (HTTP 403): Preverja ali uporabnik sploh ima auth token
 * preden proži prefetch — drugače dobivamo nesmiselne 401/403 napake
 * za endpoint-e, ki jih uporabnik še nima dostopa do.
 *
 * @returns Object s `onHover` handlerjem za uporabo v Sidebar
 */
export function useSidebarHoverPrefetch() {
  const queryClient = useQueryClient()
  const prefetchedRef = useRef<Set<string>>(new Set())

  const onModuleHover = (moduleName: ModuleName) => {
    const configs = modulePrefetchMap[moduleName]
    if (!configs || configs.length === 0) return

    // FIX NAPAKA 5 (HTTP 403): Preskoči prefetch, če uporabnik ni prijavljen
    const token = getAuthToken()
    if (!token) return

    for (const config of configs) {
      const cacheKey = JSON.stringify(config.queryKeys)

      // Preskoči že prefetchane (v zadnji minuti)
      if (prefetchedRef.current.has(cacheKey)) continue

      // Preveri, ali so podatki že v cache-u in sveži
      const cachedState = queryClient.getQueryState(config.queryKeys as unknown[])
      if (cachedState && cachedState.status === 'success' && Date.now() - (cachedState.dataUpdatedAt ?? 0) < 30_000) {
        continue
      }

      prefetchedRef.current.add(cacheKey)

      queryClient.prefetchQuery({
        queryKey: config.queryKeys as unknown[],
        queryFn: async () => {
          if (!config.endpoint) return null
          // FIX (E2E 2026-09-17, runda 3): prej je `if (!res.ok) return null` in
          // `catch { return null }` CACHAL null kot USPEŠEN rezultat (staleTime 15 s)
          // → ob hitrem kliku je konsumer videl "uspešne prazne podatke" (0 artiklov,
          // brez napake) namesto lastnega refetch-a. Zdaj VŽI vrži napako → React Query
          // shrani error state → konsumer ob mount-u samodejno požene svoj queryFn.
          // (Zunanjega .catch(() => {}) tišina ostaja — napaka ne moti uporabnika.)
          const res = await authFetch(config.endpoint)
          if (!res.ok) throw new Error(`Hover prefetch ${config.endpoint} → ${res.status}`)
          return normalizePrefetchData(config.queryKeys, await res.json())
        },
        // FIX (E2E 2026-09-17, runda 3): staleTime 60s → 15s. Hover-prefetch piše v
        // ISTI cache ključ kot konsumer; če je vrednost zastarela, konsumerjev lastni
        // queryFn (z lastno normalizacijo) hitro popravi morebitne razlike.
        staleTime: 15 * 1000,
      }).catch(() => {
        // Tiho ignoriraj — prefetch napake ne motijo uporabnika
      })

      // Počisti oznako po 2 minutah — dovoli ponovni prefetch
      setTimeout(() => {
        prefetchedRef.current.delete(cacheKey)
      }, 120_000)
    }
  }

  return { onModuleHover }
}
