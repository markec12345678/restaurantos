'use client'

// ─── Zavihek Prihodki za P&L porocilo ─────────────────────────

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, type RevenueTabProps } from './constants'

interface RevenueItem {
  label: string
  value: number
  color: string
}

export const RevenueTab = memo(function RevenueTab({ data }: RevenueTabProps) {
  const items: RevenueItem[] = [
    { label: 'Hrana', value: data.revenue.food, color: 'bg-blue-500' },
    { label: 'Pijaca', value: data.revenue.beverages, color: 'bg-purple-500' },
    { label: 'Dostava', value: data.revenue.delivery, color: 'bg-orange-500' },
    { label: 'Ostalo', value: data.revenue.other, color: 'bg-gray-500' },
  ]

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Razclenitev prihodkov</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {items.map(item => {
            const percent = data.revenue.total > 0 ? (item.value / data.revenue.total) * 100 : 0
            return (
              <div key={item.label}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm">
                    {item.label}
                  </span>
                  <div className="text-right">
                    <span className="font-medium text-sm">{formatCurrency(item.value)}</span>
                    <span className="text-xs text-muted-foreground ml-2">{percent.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full ${item.color} rounded-full transition-all`} style={{ width: `${percent}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
})
