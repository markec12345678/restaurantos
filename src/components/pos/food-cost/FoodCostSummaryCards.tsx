'use client'

import { memo } from 'react'
import type { FoodCostSummary } from './types'

// ============================================
// POVZETEK - Kartice s statistiko
// ============================================

interface FoodCostSummaryCardsProps {
  summary: FoodCostSummary
}

export const FoodCostSummaryCards = memo(function FoodCostSummaryCards({ summary }: FoodCostSummaryCardsProps) {
  return (
    <div className="grid grid-cols-5 gap-3 p-4 border-b bg-muted/50">
      <div className="bg-card rounded-lg p-3 text-center shadow-sm">
        <p className="text-2xl font-bold text-foreground">{summary.avgFoodCost}%</p>
        <p className="text-xs text-muted-foreground">Povpr. food cost</p>
      </div>
      <div className="bg-card rounded-lg p-3 text-center shadow-sm">
        <p className="text-2xl font-bold text-green-600">{summary.avgGrossMargin}%</p>
        <p className="text-xs text-muted-foreground">Povpr. bruto marža</p>
      </div>
      <div className="bg-card rounded-lg p-3 text-center shadow-sm">
        <p className="text-2xl font-bold text-amber-600">{summary.stars} ⭐</p>
        <p className="text-xs text-muted-foreground">Zvezde</p>
      </div>
      <div className="bg-card rounded-lg p-3 text-center shadow-sm">
        <p className="text-2xl font-bold text-purple-600">{summary.puzzles} 🧩</p>
        <p className="text-xs text-muted-foreground">Uganke</p>
      </div>
      <div className="bg-card rounded-lg p-3 text-center shadow-sm">
        <p className="text-2xl font-bold text-red-600">{summary.itemsOverTarget}</p>
        <p className="text-xs text-muted-foreground">Nad 30% FC</p>
      </div>
    </div>
  )
})
