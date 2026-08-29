'use client'

// ============================================
// HOOK: useModulePrefetch
// ============================================

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { authFetch, getAuthToken } from '@/components/pos/PinLogin'
import { setPrefetchPhase } from '@/components/pos/pin-login/usePinAuth'
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
 * FIX BUG #1 (Table dropdown prazen): Če uporabnik ni prijavljen (ni auth tokena),
 * prefetch se preskoči. Prej je bil cache vrednosti `null`, kar je React Query
 * obravnaval kot veljaven rezultat — zato UI ni nikoli naložil tabel/meni artiklov.
 *
 * FIX: Tudi če authFetch vrže napako (npr. 401), se napaka re-throw-a, da
 * React Query ne shrani napačnega rezultata v predpomnilnik.
 *
 * @param activeModule - Trenutno aktivni modul iz Zustand store-a
 */
export function useModulePrefetch(activeModule: ModuleName): void {
  const queryClient = useQueryClient()
  const prefetchedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const configs = modulePrefetchMap[activeModule]
    if (!configs || configs.length === 0) return

    // FIX BUG #1: Preskoči prefetch, če uporabnik ni prijavljen — drugače
    // bi se null/error predpomnilo kot podatke in blokiralo dejansko nalaganje
    const token = getAuthToken()
    if (!token) {
      logger.debug('Prefetch', `Preskakujem prefetch za ${activeModule} — uporabnik ni prijavljen`)
      return
    }

    setPrefetchPhase(true)
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
          // FIX BUG #1: authFetch VŽI vrže napako na non-OK response.
          // Re-throw da React Query označi cache kot error (ne kot podatke).
          // Komponenta bo ob mount-u samodejno ponovno poskusila.
          const res = await authFetch(config.endpoint)
          return res.json()
        },
        // FIX BUG #1: Krajši staleTime (10s) — prej 60s je blokiralo refetch
        // Ko uporabnik odpre modul, naj se podatki hitro osvežijo
        staleTime: 10 * 1000, // 10 sekund
      }).catch((error: unknown) => {
        // FIX BUG #1: Tiho ignoriraj prefetch napake — ne vplivajo na uporabnika
        // (komponenta bo ob mount-u samostojno poskusila ponovno)
        logger.debug('Prefetch', `Prefetch neuspešen za ${activeModule} (normalno pred prijavo)`, {
          error: error instanceof Error ? error.message : String(error),
        })
      })
    }
    setPrefetchPhase(false)
  }, [activeModule, queryClient])
}
