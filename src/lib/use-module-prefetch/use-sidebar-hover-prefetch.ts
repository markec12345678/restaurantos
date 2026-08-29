'use client'

// ============================================
// HOOK: useSidebarHoverPrefetch
// ============================================

import { useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { authFetch, getAuthToken } from '@/components/pos/PinLogin'
import { modulePrefetchMap } from './config'
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
          try {
            const res = await authFetch(config.endpoint)
            if (!res.ok) return null
            return res.json()
          } catch {
            // FIX NAPAKA 5 (HTTP 403): Tiho ignoriraj 403 — to pomeni da uporabnik nima
            // dovoljenja za ta endpoint (npr. natakar in admin-only modul).
            // Ni napaka — samo preskoči prefetch.
            return null
          }
        },
        staleTime: 60 * 1000,
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
