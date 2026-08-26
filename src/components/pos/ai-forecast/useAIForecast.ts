'use client'

// ============================================
// HOOK: AI Prediktivna analitika — podatki
// Poizvedbe, mutacije in handlerji
// Izvlečeno iz AIForecastDashboard.tsx
// ============================================

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import type { ForecastItem, ReorderSuggestion } from './constants'

export function useAIForecast() {
  const queryClient = useQueryClient()
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())

  // Fetch napovedi
  const { data: forecastData, isLoading: forecastLoading } = useQuery({
    queryKey: queryKeys.inventory.forecast,
    queryFn: async () => {
      const res = await authFetch('/api/inventory/forecast')
      return res.json() as Promise<{ summary: Record<string, number>; forecasts: ForecastItem[] }>
    },
    refetchInterval: 60000,
  })

  // Fetch predlogi naročil
  const { data: reorderData, isLoading: reorderLoading } = useQuery({
    queryKey: queryKeys.inventory.reorder,
    queryFn: async () => {
      const res = await authFetch('/api/inventory/reorder')
      return res.json() as Promise<{ summary: Record<string, unknown>; suggestions: ReorderSuggestion[] }>
    },
    refetchInterval: 60000,
  })

  // Ustvari naročilnico
  const reorderMutation = useMutation({
    mutationFn: async (items: Array<{ inventoryItemId: string; quantity: number; costPerUnit: number }>) => {
      const res = await authFetch('/api/inventory/reorder', {
        method: 'POST',
        body: JSON.stringify({ items, employeeName: 'Manager' }),
      })
      return res.json()
    },
    onSuccess: () => {
      toast.success('Naročilnica ustvarjena! Zaloga bo posodobljena ob dobavi.')
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.forecast })
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.reorder })
      queryClient.invalidateQueries({ queryKey: queryKeys.inventory.all })
      setSelectedItems(new Set())
    },
  })

  const forecasts = forecastData?.forecasts || []
  const reorders = reorderData?.suggestions || []
  const summary = forecastData?.summary

  const toggleItem = useCallback((id: string) => {
    const next = new Set(selectedItems)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedItems(next)
  }, [selectedItems])

  const handleCreateReorder = useCallback(() => {
    const items = reorders
      .filter(r => selectedItems.has(r.inventoryItemId))
      .map(r => ({
        inventoryItemId: r.inventoryItemId,
        quantity: r.suggestedQty,
        costPerUnit: r.costPerUnit,
      }))
    if (items.length === 0) {
      toast.error('Izberite artikle za naročilo')
      return
    }
    reorderMutation.mutate(items)
  }, [reorders, selectedItems, reorderMutation])

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.inventory.forecast })
    queryClient.invalidateQueries({ queryKey: queryKeys.inventory.reorder })
  }, [queryClient])

  const handleSelectAll = useCallback(() => {
    setSelectedItems(new Set(reorders.map(r => r.inventoryItemId)))
  }, [reorders])

  return {
    forecasts,
    forecastLoading,
    reorders,
    reorderLoading,
    summary,
    selectedItems,
    toggleItem,
    handleCreateReorder,
    handleRefresh,
    handleSelectAll,
    reorderMutation,
  }
}
