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
      const json = await res.json()
      return Array.isArray(json) ? json : []
    },
    staleTime: 60000,
  })

  const invCategories = useMemo(() => ['all', ...(dbCategories || ['general'])], [dbCategories])

  // FIX (E2E 2026-09-17): prej je `if (!res.ok) return []` utišal 429/500 napake —
  // React Query je prazno polje cachesal kot VELJAVNE podatke → UI je pokazal
  // "Ni najdenih artiklov" namesto napake. Zdaj queryFn VŽI vrže napako,
  // da React Query aktivira retry + izpostavi isError/refetch UI-ju.
  //
  // FIX (E2E 2026-09-17, runda 3): obrambni `select` — če katerakoli prefetch pot
  // (modul ali hover) vpiše SUROVI wrapper {items:[...]} pod ta ključ, konsumer
  // VEDNO dobi polje (namesto crash-a "(items || []).filter is not a function").
  const selectItems = (d: unknown): InventoryItemData[] => {
    if (Array.isArray(d)) return d as InventoryItemData[]
    if (d && typeof d === 'object') {
      const obj = d as { items?: unknown }
      if (Array.isArray(obj.items)) return obj.items as InventoryItemData[]
    }
    return []
  }

  const { data: items, isLoading, isError, error, refetch } = useQuery<InventoryItemData[]>({
    queryKey: [...queryKeys.inventory.all, filterCategory],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filterCategory !== 'all') params.set('category', filterCategory)
      const res = await authFetch(`/api/inventory?${params}`)
      if (!res.ok) throw new Error(`Inventory API ${res.status}`)
      const json = await res.json()
      return json.items ?? []
    },
    select: selectItems,
  })

  const { data: menuItems } = useQuery({
    queryKey: queryKeys.menuItems.all,
    queryFn: async () => {
      const res = await authFetch('/api/menu-items')
      if (!res.ok) throw new Error(`Menu API ${res.status}`)
      const json = await res.json()
      return json.menuItems ?? json.items ?? []
    },
    select: (d: unknown) => {
      if (Array.isArray(d)) return d
      if (d && typeof d === 'object') {
        const obj = d as { menuItems?: unknown; items?: unknown }
        if (Array.isArray(obj.menuItems)) return obj.menuItems
        if (Array.isArray(obj.items)) return obj.items
      }
      return []
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
      if (!res.ok) return { transactions: [], total: 0, summary: [] }
      const json = await res.json()
      return { transactions: json.transactions ?? [], total: json.total ?? 0, summary: json.summary ?? [] }
    },
    enabled: activeTab === 'history',
  })

  return { invCategories, items, isLoading, isError, error, refetch, menuItems, transactionsData, txLoading }
}
