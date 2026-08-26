'use client'

import { useQuery } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { authFetch } from '@/components/pos/PinLogin'
import type { MenuItemRow } from '@/lib/types'
import { queryKeys } from '@/lib/query-keys'
import type { MenuEngineeringData, MenuItemAnalysis, ViewMode } from '../menu-engineering/constants'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Custom hook za Menu Engineering podatke
// Profitability (gross profit %) vs Popularity (prodaja kolicina)
// ═══════════════════════════════════════════════════════════════

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
      let foodCostMap: Record<string, number> = {}
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

      // Analiziraj artikle
      const items: MenuItemAnalysis[] = popular.popularItems.map((item: MenuItemRow, idx: number) => {
        const price = (item.revenue as number) / (item.quantity as number)
        const foodCost = foodCostMap[item.id] || price * 0.3 // Fallback 30%
        const grossProfit = price - foodCost
        const grossProfitPercent = price > 0 ? (grossProfit / price) * 100 : 0

        return {
          id: item.id || String(idx),
          name: item.name,
          category: item.category,
          price,
          foodCost,
          grossProfit,
          grossProfitPercent,
          quantitySold: item.quantity,
          revenue: item.revenue,
          popularityRank: 0,
          profitabilityRank: 0,
          quadrant: 'dog' as const,
        }
      })

      // Izračunaj mediane
      const sortedByPopularity = [...items].sort((a, b) => b.quantitySold - a.quantitySold)
      const sortedByProfit = [...items].sort((a, b) => b.grossProfitPercent - a.grossProfitPercent)

      const medianPopularity = sortedByPopularity.length > 0
        ? sortedByPopularity[Math.floor(sortedByPopularity.length / 2)].quantitySold
        : 0
      const medianProfitability = sortedByProfit.length > 0
        ? sortedByProfit[Math.floor(sortedByProfit.length / 2)].grossProfitPercent
        : 50

      // Dodeli kvadrante in range
      items.forEach((item) => {
        item.popularityRank = sortedByPopularity.findIndex(i => i.id === item.id) + 1
        item.profitabilityRank = sortedByProfit.findIndex(i => i.id === item.id) + 1

        const isHighPopularity = item.quantitySold >= medianPopularity
        const isHighProfitability = item.grossProfitPercent >= medianProfitability

        if (isHighPopularity && isHighProfitability) item.quadrant = 'star'
        else if (!isHighPopularity && isHighProfitability) item.quadrant = 'puzzle'
        else if (isHighPopularity && !isHighProfitability) item.quadrant = 'plowhorse'
        else item.quadrant = 'dog'
      })

      return {
        items,
        medianPopularity,
        medianProfitability,
        totalItems: items.length,
        stars: items.filter(i => i.quadrant === 'star').length,
        puzzles: items.filter(i => i.quadrant === 'puzzle').length,
        plowhorses: items.filter(i => i.quadrant === 'plowhorse').length,
        dogs: items.filter(i => i.quadrant === 'dog').length,
      } as MenuEngineeringData
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
