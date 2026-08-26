'use client'

// ============================================
// HOOK: useSidebarHoverPrefetch
// ============================================

import { useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { authFetch } from '@/components/pos/PinLogin'
import { modulePrefetchMap } from './config'
import type { ModuleName } from './config'

/**
 * Hook, ki prednaloži podatke, ko uporabnik hoverja nad gumbom modula v stranski vrstici.
 *
 * Hitrejši od čakanja na klik — podatki se začnejo nalagati
 * že ob hoverju, ki praviloma mine 100-300ms pred klikom.
 *
 * @returns Object s `onHover` handlerjem za uporabo v Sidebar
 */
export function useSidebarHoverPrefetch() {
  const queryClient = useQueryClient()
  const prefetchedRef = useRef<Set<string>>(new Set())

  const onModuleHover = (moduleName: ModuleName) => {
    const configs = modulePrefetchMap[moduleName]
    if (!configs || configs.length === 0) return

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
            return null
          }
        },
        staleTime: 60 * 1000,
      }).catch(() => {})

      // Počisti oznako po 2 minutah — dovoli ponovni prefetch
      setTimeout(() => {
        prefetchedRef.current.delete(cacheKey)
      }, 120_000)
    }
  }

  return { onModuleHover }
}
