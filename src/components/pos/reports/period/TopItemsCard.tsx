'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// ============================================
// Najbolj prodajani artikli kartica
// ============================================

interface TopItem {
  name: string
  category: string
  quantity: number
  revenue: number
  avgPrice: number
}

interface TopItemsCardProps {
  itemBreakdown: TopItem[]
  fmt: (_n: number) => string
}

export const TopItemsCard = memo(function TopItemsCard({ itemBreakdown, fmt }: TopItemsCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Najbolj prodajani artikli</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
          {itemBreakdown.slice(0, 15).map((item, idx) => (
            <div key={idx} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-medium text-muted-foreground w-5">{idx + 1}.</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.category}</p>
                </div>
              </div>
              <div className="text-right flex-shrink-0 ml-2">
                <p className="text-sm font-semibold">{fmt(item.revenue)}</p>
                <p className="text-xs text-muted-foreground">{item.quantity}× @ {fmt(item.avgPrice)}</p>
              </div>
            </div>
          ))}
          {itemBreakdown.length === 0 && (
            <p className="text-center py-6 text-muted-foreground">Ni prodaje v tem obdobju</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
})
