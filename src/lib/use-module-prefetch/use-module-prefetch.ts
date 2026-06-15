'use client'

// ============================================
// HOOK: useModulePrefetch
// ============================================

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { authFetch } from '@/components/pos/PinLogin'
import { logger } from '@/lib/logger'
import { modulePrefetchMap } from './config'
import type { ModuleName } from './config'

/**
 * Hook, ki ob preklopu modula prednaloži podatke z React Query prefetch.
 *
 * Delovanje:
 * 1. Sledi spremembam `activeModule` iz Zustand store-a
 * 2. Ob spremembi modula poišče ustrezne prefetch konfiguracije
 * 3. Za vsako konfiguracijo pokliče `queryClient.prefetchQuery()`
 * 4. Podatki so na voljo v predpomnilniku, ko se komponenta montira
 *
 * Prednosti:
 * - Uporabnik ne čaka na nalaganje podatkov ob preklopu modula
 * - React Query samodejno upravlja s predpomnilnikom (gcTime, staleTime)
 * - Ne vpliva na delovanje, če prefetch odpove — komponenta naloži podatke sama
 *
 * @param activeModule - Trenutno aktivni modul iz Zustand store-a
 */
export function useModulePrefetch(activeModule: ModuleName): void {
  const queryClient = useQueryClient()
  const prefetchedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const configs = modulePrefetchMap[activeModule]
    if (!configs || configs.length === 0) return

    for (const config of configs) {
      const cacheKey = JSON.stringify(config.queryKeys)

      // Če je `once: true`, preskoči že prefetchane ključe
      if (config.once && prefetchedRef.current.has(cacheKey)) continue

      // Označi kot prefetchan (tudi če še ni končan — prepreči podvojene klice)
      prefetchedRef.current.add(cacheKey)

      queryClient.prefetchQuery({
        queryKey: config.queryKeys as unknown[],
        queryFn: async () => {
          if (!config.endpoint) return null
          try {
            const res = await authFetch(config.endpoint)
            if (!res.ok) return null
            return res.json()
          } catch (error: unknown) {
            // Prefetch napake ne motijo uporabnika — tiho zabeleži
            logger.warn('Prefetch', `Napaka pri prefetch za ${activeModule}`, { error: error instanceof Error ? error.message : String(error) })
            return null
          }
        },
        // Uporabi krajši staleTime za prefetch — če uporabnik ne odpre modula, se cache hitro počisti
        staleTime: 60 * 1000, // 1 minuta
      }).catch(() => {
        // Tiho ignoriraj prefetch napake — ne vplivajo na uporabnika
      })
    }
  }, [activeModule, queryClient])
}
