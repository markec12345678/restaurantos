'use client'
import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp } from 'lucide-react'
import { safeToFixed, safeNum } from '@/lib/safe-format'

interface PeriodComparisonCardProps {
  periodComparison: {
    current: { revenue: number; orders: number; avgOrderValue: number; tips: number }
    previous: { revenue: number; orders: number; avgOrderValue: number; tips: number }
    changes: { revenue: number; orders: number; avgOrderValue: number; tips: number }
  }
  fmt: (_n: number) => string
}

export const PeriodComparisonCard = memo(function PeriodComparisonCard({ periodComparison, fmt }: PeriodComparisonCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Primerjava s prejšnjim obdobjem
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Prihodek', current: periodComparison.current.revenue, previous: periodComparison.previous.revenue, change: periodComparison.changes.revenue },
            { label: 'Naročila', current: periodComparison.current.orders, previous: periodComparison.previous.orders, change: periodComparison.changes.orders },
            { label: 'Povp. naročilo', current: periodComparison.current.avgOrderValue, previous: periodComparison.previous.avgOrderValue, change: periodComparison.changes.avgOrderValue },
            { label: 'Napitnine', current: periodComparison.current.tips, previous: periodComparison.previous.tips, change: periodComparison.changes.tips },
          ].map((item, idx) => (
            <div key={idx} className="text-center p-3 rounded-lg border">
              <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
              <p className="text-lg font-bold">{typeof item.current === 'number' && item.label !== 'Naročila' ? fmt(item.current) : item.current}</p>
              <div className="flex items-center justify-center gap-1 mt-1">
                <span className="text-xs text-muted-foreground">prej: {typeof item.previous === 'number' && item.label !== 'Naročila' ? fmt(item.previous) : item.previous}</span>
                {item.change !== 0 && (
                  <Badge variant={item.change > 0 ? 'default' : 'destructive'} className="text-[10px] px-1">
                    {item.change > 0 ? '+' : ''}{safeToFixed(item.change, 1)}%
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
})
