'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import type { WasteByReasonTabProps } from './constants'

// ============================================
// ODPADKI PO RAZLOGU
// ============================================
export const WasteByReasonTab = memo(function WasteByReasonTab({
  summary,
  formatCurrency: fmtCurrency,
}: WasteByReasonTabProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Odpadki po razlogu</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {summary.wasteByReason.map(item => (
            <div key={item.reason}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium">{item.reason}</span>
                <div className="text-right">
                  <span className="text-sm font-medium text-red-600">{fmtCurrency(item.cost)}</span>
                  <span className="text-xs text-muted-foreground ml-2">({item.percentage}%)</span>
                </div>
              </div>
              <Progress
                value={item.percentage}
                className={`h-2 ${item.percentage >= 30 ? '[&>div]:bg-red-500' : item.percentage >= 15 ? '[&>div]:bg-amber-500' : '[&>div]:bg-blue-500'}`}
                aria-valuetext={item.percentage >= 30 ? 'Visok odpadek' : item.percentage >= 15 ? 'Zmeren odpadek' : 'Nizek odpadek'}
              />
              <p className="text-xs text-muted-foreground mt-1">{item.count} dogodkov</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
})
