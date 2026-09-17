'use client'

import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'

// ============================================
// INVALIDACIJA REACT QUERY PO WS DOGODKIH
// ============================================

/**
 * Skupine query key-ov, ki jih invalidiramo po WS dogodku.
 * Čista preslikava event → skupine (unit-testabilna brez React Query).
 */
export type QueryGroup =
  | 'kitchen'
  | 'orders'
  | 'dashboard'
  | 'ordersSidebar'
  | 'ordersWaiter'
  | 'kds'
  | 'inventory'
  | 'inventoryMenuStock'
  | 'inventoryLowStock'

/**
 * Runda 28 FIX (značilen bug iz rund 9–26): strežnik pošilja
 * 'ITEM_STATUS_UPDATE' (handle-item-status broadcastWS) in 'order_ready'
 * (wsBroadcastEvent lowercase) — stari switch je poslušal
 * 'ITEM_STATUS_CHANGED' in 'ORDER_READY' (uppercase, kot v WSEventType
 * union-u), ZATO KDS/natakar refetch po WS nikoli ne streže (delovalo je
 * samo prek polling intervalov). Preslikava zdaj pokriva OBE variante.
 */
const EVENT_GROUPS: Record<string, readonly QueryGroup[]> = {
  // Novo naročilo / sprememba / preklic
  NEW_ORDER: ['kitchen', 'orders', 'dashboard', 'ordersSidebar'],
  ORDER_UPDATED: ['kitchen', 'orders', 'dashboard', 'ordersSidebar'],
  ORDER_CANCELLED: ['kitchen', 'orders', 'dashboard', 'ordersSidebar'],
  // Sprememba statusa artikla (KDS → strežnik; VELJAVNO ime iz handle-item-status)
  ITEM_STATUS_UPDATE: ['kitchen', 'orders'],
  ITEM_STATUS_CHANGED: ['kitchen', 'orders'], // legacy alias (WSEventType union)
  // Artikel/naročilo pripravljeno (veljavno: lowercase iz strežnika + union alias)
  order_ready: ['orders', 'kitchen', 'dashboard', 'ordersWaiter'],
  ORDER_READY: ['orders', 'kitchen', 'dashboard', 'ordersWaiter'],
  // Kuhinja je "fired" naročilo
  ORDER_FIRED: ['orders', 'kitchen', 'dashboard'],
  // Zaloga
  STOCK_LOW: ['inventory', 'inventoryMenuStock', 'dashboard', 'inventoryLowStock'],
  STOCK_OUT: ['inventory', 'inventoryMenuStock', 'dashboard', 'inventoryLowStock'],
}

/** Vrni skupine query key-ov za invalidacijo po danem WS dogodku (čista fn). */
export function invalidationGroupsForEvent(eventType: string): readonly QueryGroup[] {
  return EVENT_GROUPS[eventType] ?? []
}

/**
 * Hook, ki vrne funkcijo za invalidacijo React Query poizvedb glede na tip WS dogodka.
 * Ločeno od glavnega hook-a za boljšo berljivost in testiranje.
 */
export function useWSQueryInvalidation() {
  const queryClient = useQueryClient()

  const invalidateRelevantQueries = useCallback(
    (eventType: string) => {
      const groups = invalidationGroupsForEvent(eventType)
      for (const group of groups) {
        switch (group) {
          case 'kitchen':
            queryClient.invalidateQueries({ queryKey: queryKeys.kitchen.all })
            break
          case 'orders':
            queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
            break
          case 'dashboard':
            queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
            break
          case 'ordersSidebar':
            queryClient.invalidateQueries({ queryKey: queryKeys.orders.sidebar })
            break
          case 'ordersWaiter':
            queryClient.invalidateQueries({ queryKey: queryKeys.orders.waiter })
            break
          case 'kds':
            queryClient.invalidateQueries({ queryKey: queryKeys.kitchen.all })
            break
          case 'inventory':
            queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all })
            break
          case 'inventoryMenuStock':
            queryClient.invalidateQueries({ queryKey: queryKeys.inventory.menuStock })
            break
          case 'inventoryLowStock':
            queryClient.invalidateQueries({ queryKey: queryKeys.inventory.lowStock })
            break
        }
      }
    },
    [queryClient]
  )

  return invalidateRelevantQueries
}
