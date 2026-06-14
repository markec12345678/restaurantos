'use client'

import { useState, useEffect, useCallback, useMemo, memo } from 'react'
import { authFetch } from '@/components/pos/PinLogin'
import { toast } from 'sonner'
import { FoodCostSummaryCards } from './FoodCostSummaryCards'
import { FoodCostFilterBar } from './FoodCostFilterBar'
import { FoodCostItemRow } from './FoodCostItemRow'
import type { FoodCostItem, FoodCostSummary } from './types'

// ============================================
// FOOD COST CALCULATOR - Glavna komponenta
// ============================================

export default memo(function FoodCostCalculator() {
  const [items, setItems] = useState<FoodCostItem[]>([])
  const [summary, setSummary] = useState<FoodCostSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('foodCostDesc')
  const [expandedItem, setExpandedItem] = useState<string | null>(null)

  const fetchAnalysis = useCallback(async () => {
    try {
      const res = await authFetch('/api/food-cost')
      if (!res.ok) throw new Error('Napaka pri nalaganju')
      const data = await res.json()
      setItems(Array.isArray(data?.items) ? data.items : [])
      setSummary(data?.summary || null)
    } catch {
      toast.error('Napaka pri nalaganju stroškov hrane')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAnalysis() }, [fetchAnalysis])

  const filteredItems = useMemo(() => items
    .filter(item => {
      if (filter === 'all') return true
      if (filter === 'no_recipe') return !item.hasRecipe
      if (filter === 'over_target') return item.foodCostPercent > 30
      return item.classification === filter
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'foodCostDesc': return b.foodCostPercent - a.foodCostPercent
        case 'foodCostAsc': return a.foodCostPercent - b.foodCostPercent
        case 'marginDesc': return b.grossMarginPercent - a.grossMarginPercent
        case 'marginAsc': return a.grossMarginPercent - b.grossMarginPercent
        case 'name': return a.name.localeCompare(b.name)
        default: return 0
      }
    }), [items, filter, sortBy])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-500 border-t-transparent mx-auto"></div>
          <p className="mt-3 text-gray-500">Analiziram stroške hrane...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold">💰 Izračun cene jedi</h2>
          <span className="text-xs text-gray-500">Food Cost Calculator</span>
        </div>
        <button
          onClick={fetchAnalysis}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          🔄 Osveži
        </button>
      </div>

      {/* Summary Cards */}
      {summary && <FoodCostSummaryCards summary={summary} />}

      {/* Filters */}
      <FoodCostFilterBar
        filter={filter}
        setFilter={setFilter}
        sortBy={sortBy}
        setSortBy={setSortBy}
        filteredCount={filteredItems.length}
        totalCount={items.length}
      />

      {/* Items List */}
      <div className="flex-1 overflow-y-auto">
        {filteredItems.map(item => (
          <FoodCostItemRow
            key={item.id}
            item={item}
            isExpanded={expandedItem === item.id}
            onToggleExpand={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
          />
        ))}
      </div>
    </div>
  )
})
