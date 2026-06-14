'use client'

import { memo } from 'react'
import type { FoodCostItem } from './types'
import { CLASSIFICATION_COLORS, CLASSIFICATION_LABELS } from './types'

// ============================================
// VRSTICA ARTIKLA S RAZŠIRJENIM PODROBNOSTMI
// ============================================

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
        {/* Classification Badge */}
        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${CLASSIFICATION_COLORS[item.classification]}`}>
          {item.classification === 'Star' ? '⭐' : item.classification === 'Plowhorse' ? '🐴' : item.classification === 'Puzzle' ? '🧩' : '🐕'}
        </span>

        {/* Name & Category */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{item.name}</p>
          <p className="text-[10px] text-gray-500">{item.category} • {item.salesCategory}</p>
        </div>

        {/* Food Cost */}
        <div className="text-right">
          <p className={`text-sm font-bold ${
            item.foodCostPercent > 35 ? 'text-red-600' : item.foodCostPercent > 28 ? 'text-amber-600' : 'text-green-600'
          }`}>
            {item.hasRecipe ? `${item.foodCostPercent}%` : '—'}
          </p>
          <p className="text-[10px] text-gray-500">food cost</p>
        </div>

        {/* Price */}
        <div className="text-right w-20">
          <p className="text-sm font-medium">€{item.sellingPriceInclVat.toFixed(2)}</p>
          {item.priceDifference > 0.5 && (
            <p className="text-[10px] text-red-500">Predlagano: €{item.suggestedPrice.toFixed(2)}</p>
          )}
        </div>

        {/* Expand indicator */}
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Expanded Detail */}
      {isExpanded && (
        <ExpandedDetail item={item} />
      )}
    </div>
  )
})

// ============================================
// RAZŠIRJENE PODROBNOSTI ARTIKLA
// ============================================

interface ExpandedDetailProps {
  item: FoodCostItem
}

const ExpandedDetail = memo(function ExpandedDetail({ item }: ExpandedDetailProps) {
  if (!item.hasRecipe) {
    return (
      <div className="px-3 pb-3 ml-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
          📝 Za ta artikel ni definiranega recepta. Dodajte recept v upravljanju receptov za izračun food cost.
        </div>
      </div>
    )
  }

  return (
    <div className="px-3 pb-3 ml-8">
      {/* Margin Breakdown */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        <div className="bg-gray-50 rounded p-2 text-center">
          <p className="text-xs text-gray-500">Prodajna cena</p>
          <p className="font-bold text-sm">€{item.sellingPriceInclVat.toFixed(2)}</p>
        </div>
        <div className="bg-red-50 rounded p-2 text-center">
          <p className="text-xs text-gray-500">Strošek sestavin</p>
          <p className="font-bold text-sm text-red-600">€{item.totalIngredientCost.toFixed(2)}</p>
        </div>
        <div className="bg-green-50 rounded p-2 text-center">
          <p className="text-xs text-gray-500">Bruto dobiček</p>
          <p className="font-bold text-sm text-green-600">€{item.grossProfit.toFixed(2)}</p>
        </div>
        <div className="bg-blue-50 rounded p-2 text-center">
          <p className="text-xs text-gray-500">Bruto marža</p>
          <p className="font-bold text-sm text-blue-600">{item.grossMarginPercent}%</p>
        </div>
      </div>

      {/* Classification Explanation */}
      <div className={`rounded-lg p-2 mb-3 text-xs ${CLASSIFICATION_COLORS[item.classification]}`}>
        {CLASSIFICATION_LABELS[item.classification]}
      </div>

      {/* Ingredients Table */}
      <table className="w-full text-xs">
        <thead>
          <tr className="text-gray-500 border-b">
            <th className="text-left py-1">Sestavina</th>
            <th className="text-right py-1">Količina</th>
            <th className="text-right py-1">Cena/enoto</th>
            <th className="text-right py-1">Skupaj</th>
            <th className="text-right py-1">Zaloga</th>
          </tr>
        </thead>
        <tbody>
          {item.ingredients.map((ing, i) => (
            <tr key={i} className="border-b border-gray-100">
              <td className="py-1">{ing.name}</td>
              <td className="text-right">{ing.quantity} {ing.unit}</td>
              <td className="text-right">€{(ing.costPerUnit || 0).toFixed(2)}</td>
              <td className="text-right font-medium">€{ing.totalCost.toFixed(2)}</td>
              <td className="text-right">
                <span className={(ing.stockLevel as number) <= 5 ? 'text-red-500' : 'text-gray-500'}>
                  {(ing.stockLevel as number)} {(ing.stockUnit as string)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Price Suggestion */}
      {item.priceDifference > 0.5 && (
        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs">
          💡 <strong>Predlagana cena:</strong> €{item.suggestedPrice.toFixed(2)} (razlika: +€{item.priceDifference.toFixed(2)})
          — glede na ciljni food cost 28%
        </div>
      )}
    </div>
  )
})
