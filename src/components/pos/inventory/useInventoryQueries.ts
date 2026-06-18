'use client'

// ============================================
// HOOK: Poizvedbe za zalogo
// Izvlečeno iz useInventoryState.ts
// ============================================

import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import type { InventoryItemData } from './constants'

interface UseInventoryQueriesParams {
  activeTab: string
  filterCategory: string
  txTypeFilter: string
  txDateFrom: string
  txDateTo: string
}

export function useInventoryQueries({ activeTab, filterCategory, txTypeFilter, txDateFrom, txDateTo }: UseInventoryQueriesParams) {
  const { data: dbCategories } = useQuery<string[]>({
    queryKey: ['inventory-categories'],
    queryFn: async () => {
      const res = await authFetch('/api/inventory?distinctCategories=true')
      if (!res.ok) return ['general']
      const data = await res.json()
      return Array.isArray(data) ? data : (data.categories || data.items || [])
    },
    staleTime: 60000,
  })

  const invCategories = useMemo(() => ['all', ...(dbCategories || ['general'])], [dbCategories])

  const { data: items, isLoading } = useQuery<InventoryItemData[]>({
    queryKey: [...queryKeys.inventory.all, filterCategory],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filterCategory !== 'all') params.set('category', filterCategory)
      const res = await authFetch(`/api/inventory?${params}`)
      if (!res.ok) return []
      const data = await res.json()
      return Array.isArray(data) ? data : (data.items || [])
    },
  })

  const { data: menuItems } = useQuery({
    queryKey: queryKeys.menuItems.all,
    queryFn: async () => {
      const res = await authFetch('/api/menu-items')
      if (!res.ok) return []
      const data = await res.json()
      return Array.isArray(data) ? data : (data.menuItems || data.items || [])
    },
  })

  const { data: transactionsData, isLoading: txLoading } = useQuery({
    queryKey: [...queryKeys.inventory.transactions, txTypeFilter, txDateFrom, txDateTo],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (txTypeFilter !== 'all') params.set('type', txTypeFilter)
      if (txDateFrom) params.set('from', txDateFrom)
      if (txDateTo) params.set('to', txDateTo)
      params.set('limit', '200')
      const res = await authFetch(`/api/inventory/transactions?${params}`)
      if (!res.ok) return { transactions: [], summary: [] }
      const data = await res.json()
      if (Array.isArray(data)) return { transactions: data, summary: [] }
      return { transactions: data.transactions || [], summary: data.summary || [] }
    },
    enabled: activeTab === 'history',
  })

  return { invCategories, items, isLoading, menuItems, transactionsData, txLoading }
}
