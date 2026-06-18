'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { TrendingDown, RefreshCw, Receipt, DollarSign } from 'lucide-react'
import { safeToFixed, safeNum } from '@/lib/safe-format'

// ============================================
// Expense stats cards
// ============================================
interface ExpenseStatsCardsProps {
  stats: { totalExpenses?: number; recurringExpenses?: number; count?: number } | undefined
  avgExpense: string
}

export const ExpenseStatsCards = memo(function ExpenseStatsCards({ stats, avgExpense }: ExpenseStatsCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <Card><CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1"><TrendingDown className="h-4 w-4 text-red-500" /><span className="text-xs text-muted-foreground">Skupni stroški</span></div>
        <p className="text-2xl font-bold">€{safeToFixed(stats?.totalExpenses || 0, 2)}</p>
      </CardContent></Card>
      <Card><CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1"><RefreshCw className="h-4 w-4 text-amber-500" /><span className="text-xs text-muted-foreground">Ponavljajoči</span></div>
        <p className="text-2xl font-bold">€{safeToFixed(stats?.recurringExpenses || 0, 2)}</p>
      </CardContent></Card>
      <Card><CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1"><Receipt className="h-4 w-4 text-blue-500" /><span className="text-xs text-muted-foreground">Število</span></div>
        <p className="text-2xl font-bold">{stats?.count || 0}</p>
      </CardContent></Card>
      <Card><CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1"><DollarSign className="h-4 w-4 text-purple-500" /><span className="text-xs text-muted-foreground">Povprečni</span></div>
        <p className="text-2xl font-bold">€{avgExpense}</p>
      </CardContent></Card>
    </div>
  )
})
