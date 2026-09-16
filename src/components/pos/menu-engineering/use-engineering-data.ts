'use client'

import { useQuery } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import type { MenuEngineeringData, ViewMode } from './constants'
// REFAKTOR (QA 2026-09-17, runda 3): analitična logika prestavljena v čisto
// funkcijo analyzeEngineeringData(), da jo ponovno uporablja tudi Nadzorna
// plošča (MenuEngineeringKpi) brez podvajanja poslovnih pravil.
import { analyzeEngineeringData } from './analysis'

export function useEngineeringData() {
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [viewMode, setViewMode] = useState<ViewMode>('matrix')

  const { data, isLoading } = useQuery<MenuEngineeringData>({
    queryKey: queryKeys.menuEngineering.all,
    queryFn: async () => {
      const res = await authFetch('/api/reports/popular')
      if (!res.ok) throw new Error('Failed to fetch')
      const popular = await res.json()

      // Pridobi tudi food-cost podatke
      const foodCostMap: Record<string, number> = {}
      try {
        const fcRes = await authFetch('/api/food-cost')
        if (fcRes.ok) {
          const fcData = await fcRes.json()
          if (Array.isArray(fcData)) {
            fcData.forEach((item: Record<string, unknown>) => {
              foodCostMap[(item.menuItemId || item.id) as string] = (item.foodCost || item.costPerServing || 0) as number
            })
          }
        }
      } catch {
        // Napaka pri pridobivanju stroškov hrane — nadaljuj brez njih
      }

      return analyzeEngineeringData(popular, foodCostMap)
    },
  })

  // Kategorije za filter
  const categories = useMemo(() => {
    if (!data) return []
    const cats = new Set(data.items.map(i => i.category))
    return Array.from(cats).sort()
  }, [data])

  // Filtrirani artikli
  const filteredItems = useMemo(() => {
    if (!data) return []
    if (categoryFilter === 'all') return data.items
    return data.items.filter(i => i.category === categoryFilter)
  }, [data, categoryFilter])

  // Chart podatki
  const chartData = useMemo(() => filteredItems.map(item => ({
    x: item.quantitySold,
    y: item.grossProfitPercent,
    z: item.revenue,
    ...item,
  })), [filteredItems])

  return {
    data,
    isLoading,
    categories,
    filteredItems,
    chartData,
    categoryFilter,
    setCategoryFilter,
    viewMode,
    setViewMode,
  }
}
