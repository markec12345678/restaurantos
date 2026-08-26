'use client'

import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'

// ============================================
// INVALIDACIJA REACT QUERY PO WS DOGODKIH
// ============================================

/**
 * Hook, ki vrne funkcijo za invalidacijo React Query poizvedb glede na tip WS dogodka.
 * Ločeno od glavnega hook-a za boljšo berljivost in testiranje.
 */
export function useWSQueryInvalidation() {
  const queryClient = useQueryClient()

  const invalidateRelevantQueries = useCallback((eventType: string) => {
    switch (eventType) {
      case 'NEW_ORDER':
      case 'ORDER_UPDATED':
      case 'ORDER_CANCELLED':
        queryClient.invalidateQueries({ queryKey: queryKeys.kitchen.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.orders.sidebar })
        break
      case 'ITEM_STATUS_CHANGED':
        queryClient.invalidateQueries({ queryKey: queryKeys.kitchen.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
        break
      case 'STOCK_LOW':
      case 'STOCK_OUT':
        queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.inventory.menuStock })
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.inventory.lowStock })
        break
      case 'ORDER_FIRED':
      case 'ORDER_READY':
        queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.kitchen.all })
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
        break
    }
  }, [queryClient])

  return invalidateRelevantQueries
}
