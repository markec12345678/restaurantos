'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import type { WasteByItemTabProps } from './constants'

// ============================================
// TOP 5 ARTIKLOV Z NAJVEČ ODPADKI
// ============================================
export const WasteByItemTab = memo(function WasteByItemTab({
  summary,
  formatCurrency: fmtCurrency,
}: WasteByItemTabProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Top 5 artiklov z največ odpadki</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {summary.topWasteItems.map((item, idx) => (
            <div key={item.name} className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 font-bold text-sm">
                {idx + 1}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium">{item.name}</span>
                  <span className="text-sm font-medium text-red-600">{fmtCurrency(item.cost)}</span>
                </div>
                <Progress value={item.percentage} className="h-1.5 [&>div]:bg-red-500" aria-valuetext={`Odpadek: ${item.percentage}%`} />
              </div>
              <span className="text-xs text-muted-foreground w-10 text-right">{item.percentage}%</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
})
