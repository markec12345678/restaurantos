'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CATEGORIES } from './constants'

// ============================================
// Category breakdown
// ============================================
interface CategoryBreakdownProps {
  byCategory: Record<string, { total: number; count: number }>
  totalExpenses: number
}

export const CategoryBreakdown = memo(function CategoryBreakdown({ byCategory, totalExpenses }: CategoryBreakdownProps) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-lg">Po kategorijah</CardTitle></CardHeader>
      <CardContent>
        <div className="space-y-3">
          {CATEGORIES.map(cat => {
            const catData = byCategory[cat.id]
            if (!catData) return null
            const CatIcon = cat.icon
            const pct = totalExpenses ? (catData.total / totalExpenses) * 100 : 0
            return (
              <div key={cat.id} className="flex items-center gap-3">
                <div className={`h-8 w-8 rounded-full bg-${cat.color}-100 dark:bg-${cat.color}-900/30 flex items-center justify-center`}>
                  <CatIcon className={`h-4 w-4 text-${cat.color}-600`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm font-medium">{cat.label}</span>
                    <span className="text-sm font-bold">€{catData.total.toFixed(2)}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full bg-${cat.color}-500 rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{catData.count} vnosov · {pct.toFixed(1)}%</p>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
})
