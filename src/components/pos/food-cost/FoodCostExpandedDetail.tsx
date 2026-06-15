'use client'

import { memo } from 'react'
import type { FoodCostItem } from './types'
import { CLASSIFICATION_COLORS, CLASSIFICATION_LABELS } from './types'

interface FoodCostExpandedDetailProps {
  item: FoodCostItem
}

export const FoodCostExpandedDetail = memo(function FoodCostExpandedDetail({ item }: FoodCostExpandedDetailProps) {
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
      <div className={`rounded-lg p-2 mb-3 text-xs ${CLASSIFICATION_COLORS[item.classification]}`}>
        {CLASSIFICATION_LABELS[item.classification]}
      </div>
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
      {item.priceDifference > 0.5 && (
        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs">
          💡 <strong>Predlagana cena:</strong> €{item.suggestedPrice.toFixed(2)} (razlika: +€{item.priceDifference.toFixed(2)})
          — glede na ciljni food cost 28%
        </div>
      )}
    </div>
  )
})
