'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { WasteByCategoryTabProps } from './constants'

// ============================================
// ODPADKI PO KATEGORIJI
// ============================================
export const WasteByCategoryTab = memo(function WasteByCategoryTab({
  summary,
  formatCurrency: fmtCurrency,
}: WasteByCategoryTabProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Odpadki po kategoriji</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {summary.wasteByCategory.map(cat => {
            const percent = summary.totalWasteCost > 0 ? (cat.cost / summary.totalWasteCost) * 100 : 0
            return (
              <div key={cat.category} className="flex items-center justify-between p-2 rounded-lg border">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{cat.category}</Badge>
                  <span className="text-sm text-muted-foreground">{cat.count} dogodkov</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-red-600">{fmtCurrency(cat.cost)}</span>
                  <span className="text-xs text-muted-foreground">({Math.round(percent)}%)</span>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
})
