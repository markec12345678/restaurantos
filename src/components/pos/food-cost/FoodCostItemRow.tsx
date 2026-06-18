'use client'

import { memo } from 'react'
import type { FoodCostItem } from './types'
import { CLASSIFICATION_COLORS } from './types'
import dynamic from 'next/dynamic'
import { safeToFixed, safeNum } from '@/lib/safe-format'

const FoodCostExpandedDetail = dynamic(() => import('./FoodCostExpandedDetail').then(m => ({ default: m.FoodCostExpandedDetail })), { ssr: false })

interface FoodCostItemRowProps {
  item: FoodCostItem
  isExpanded: boolean
  onToggleExpand: () => void
}

export const FoodCostItemRow = memo(function FoodCostItemRow({
  item,
  isExpanded,
  onToggleExpand,
}: FoodCostItemRowProps) {
  return (
    <div className="border-b">
      <div
        className="p-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50"
        role="button"
        tabIndex={0}
        onClick={onToggleExpand}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggleExpand() } }}
      >
        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${CLASSIFICATION_COLORS[item.classification]}`}>
          {item.classification === 'Star' ? '⭐' : item.classification === 'Plowhorse' ? '🐴' : item.classification === 'Puzzle' ? '🧩' : '🐕'}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{item.name}</p>
          <p className="text-[10px] text-gray-500">{item.category} • {item.salesCategory}</p>
        </div>
        <div className="text-right">
          <p className={`text-sm font-bold ${
            item.foodCostPercent > 35 ? 'text-red-600' : item.foodCostPercent > 28 ? 'text-amber-600' : 'text-green-600'
          }`}>
            {item.hasRecipe ? `${item.foodCostPercent}%` : '—'}
          </p>
          <p className="text-[10px] text-gray-500">food cost</p>
        </div>
        <div className="text-right w-20">
          <p className="text-sm font-medium">€{safeToFixed(item.sellingPriceInclVat, 2)}</p>
          {item.priceDifference > 0.5 && (
            <p className="text-[10px] text-red-500">Predlagano: €{safeToFixed(item.suggestedPrice, 2)}</p>
          )}
        </div>
        <svg className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      {isExpanded && <FoodCostExpandedDetail item={item} />}
    </div>
  )
})
