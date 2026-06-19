'use client'

import { useQuery } from '@tanstack/react-query'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { type TableData } from '../constants'

// ============================================
// QUERIES: Pridobivanje podatkov o mizah
// ============================================

export function useTableQueries(selectedTableForOrders: TableData | null) {
  const { data: tables, isLoading } = useQuery({
    queryKey: queryKeys.tables.all,
    queryFn: async () => {
      const res = await authFetch('/api/tables')
      if (!res.ok) return []
      const json = await res.json()
      return Array.isArray(json) ? json : (json.tables ?? [])
    },
  })

  const { data: tableOrders } = useQuery({
    queryKey: queryKeys.tables.orders(selectedTableForOrders?.id as string),
    queryFn: async () => {
      if (!selectedTableForOrders) return []
      const res = await authFetch(`/api/orders?tableId=${selectedTableForOrders.id}&status=active`)
      const data = await res.json()
      return Array.isArray(data) ? data : (data.orders || [])
    },
    enabled: !!selectedTableForOrders,
  })

  return { tables, isLoading, tableOrders }
}
