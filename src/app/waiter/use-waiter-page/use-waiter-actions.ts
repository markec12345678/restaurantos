'use client'

import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import type { Order } from '../types'

// ═══════════════════════════════════════════════════════════════
// Waiter Actions — Mark served
// ═══════════════════════════════════════════════════════════════

export function useWaiterActions(allOrders: Order[]) {
  const queryClient = useQueryClient()

  const handleMarkServed = async (orderId: string, itemIds?: string[]) => {
    try {
      // FIX WAITER CRASH: tudi tu uporabljamo več token ključev + Array.isArray zaščito
      const token = localStorage.getItem('pos_token')
        || localStorage.getItem('pos_auth_token')
        || sessionStorage.getItem('pos_auth_token')
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`

      if (itemIds && itemIds.length > 0) {
        await Promise.all(itemIds.map(itemId =>
          fetch(`/api/orders/${orderId}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ action: 'item_status', itemId, status: 'served' }),
          })
        ))
      } else {
        const order = allOrders.find(o => o.id === orderId)
        if (!order) return
        // FIX WAITER CRASH: order.items je lahko undefined — Array.isArray preverba
        const readyItems = Array.isArray(order.items) ? order.items.filter(i => i.status === 'ready') : []
        await Promise.all(readyItems.map(item =>
          fetch(`/api/orders/${orderId}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ action: 'item_status', itemId: item.id, status: 'served' }),
          })
        ))
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.waiter })
    } catch { /* toast.error('Napaka') */ }
  }

  return { handleMarkServed }
}
