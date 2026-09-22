'use client'

// ============================================
// HOOK: OFFLINE QUEUE — IndexedDB stanje prek React Query
// ============================================
// P1-15/P1-16: podpora admin preglednemu panelu za CONFLICT /
// MANUAL_REVIEW vnose offline vrste.
//
// IndexedDB je NA NAPRAVI (ne strežnik!) — hook je SSR-varen:
// queryFn se izvede samo v brskalniku. Osvježevanje:
//   - refetchInterval 10 s (tiho)
//   - manual refetch po akciji (retry/discard)
//   - online/offline events

import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import {
  getAllOrders,
  getQueueStats,
  getReviewCount,
  type PendingOrder,
  type OfflineOpStatus,
} from '@/lib/offline-orders'

/** Vsi vnosi vrste (normalizirani), najnovejši najprej. */
export function useOfflineQueueEntries() {
  return useQuery<PendingOrder[]>({
    queryKey: queryKeys.offlineQueue.entries,
    queryFn: async () => {
      const all = await getAllOrders()
      return [...all].sort((a, b) => b.createdAt - a.createdAt)
    },
    refetchInterval: 10_000,
    // IndexedDB — samo brskalnik (ssr: false komponente)
    enabled: typeof window !== 'undefined',
    staleTime: 5_000,
  })
}

/** Statistika po statusih za kartice. */
export function useOfflineQueueStats() {
  return useQuery<Record<OfflineOpStatus, number>>({
    queryKey: queryKeys.offlineQueue.stats,
    queryFn: getQueueStats,
    refetchInterval: 10_000,
    enabled: typeof window !== 'undefined',
    staleTime: 5_000,
  })
}

/**
 * Število konfliktov za ročni pregled (CONFLICT + MANUAL_REVIEW).
 * Uporablja ga sidebar badge + notranji indikatorji.
 */
export function useOfflineQueueReviewCount() {
  const queryClient = useQueryClient()

  const query = useQuery<number>({
    queryKey: queryKeys.offlineQueue.reviewCount,
    queryFn: getReviewCount,
    refetchInterval: 15_000,
    enabled: typeof window !== 'undefined',
    staleTime: 5_000,
  })

  // Ob spremembi online stanja takoj osveži (SW sporočila sprožijo
  // toasting; badge mora slediti)
  useEffect(() => {
    const refetch = () => queryClient.invalidateQueries({ queryKey: queryKeys.offlineQueue.all })
    window.addEventListener('online', refetch)
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const handler = (event: MessageEvent) => {
        const data = event.data as { type?: string } | null
        if (data?.type?.startsWith('SYNC_')) refetch()
      }
      navigator.serviceWorker.addEventListener('message', handler)
      return () => {
        window.removeEventListener('online', refetch)
        navigator.serviceWorker.removeEventListener('message', handler)
      }
    }
    return () => window.removeEventListener('online', refetch)
  }, [queryClient])

  return query
}

/** Invalidiraj vse offline queue queryje (po akciji). */
export function useInvalidateOfflineQueue() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.offlineQueue.all })
}
