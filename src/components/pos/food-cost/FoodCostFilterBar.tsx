'use client'

import { memo } from 'react'
import { FILTER_OPTIONS } from './types'

// ============================================
// FILTRI IN SORTIRANJE
// ============================================

interface FoodCostFilterBarProps {
  filter: string
  setFilter: (_filter: string) => void
  sortBy: string
  setSortBy: (_sortBy: string) => void
  filteredCount: number
  totalCount: number
}

export const FoodCostFilterBar = memo(function FoodCostFilterBar({
  filter,
  setFilter,
  sortBy,
  setSortBy,
  filteredCount,
  totalCount,
}: FoodCostFilterBarProps) {
  return (
    <div className="flex items-center gap-2 p-3 border-b flex-wrap">
      <span className="text-xs text-gray-500">Filter:</span>
      {FILTER_OPTIONS.map(f => (
        <button
          key={f.key}
          onClick={() => setFilter(f.key)}
          className={`text-xs px-2 py-1 rounded-full transition ${
            filter === f.key
              ? 'bg-gray-800 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {f.label}
        </button>
      ))}
      <span className="text-xs text-gray-500 ml-2">|</span>
      <select
        value={sortBy}
        onChange={e => setSortBy(e.target.value)}
        aria-label="Razvrsti artikle"
        className="text-xs border rounded px-2 py-1"
      >
        <option value="foodCostDesc">Food cost ↓</option>
        <option value="foodCostAsc">Food cost ↑</option>
        <option value="marginDesc">Marža ↓</option>
        <option value="marginAsc">Marža ↑</option>
        <option value="name">Po imenu</option>
      </select>
      <span className="text-xs text-gray-500 ml-auto">
        {filteredCount} od {totalCount} artiklov
      </span>
    </div>
  )
})
