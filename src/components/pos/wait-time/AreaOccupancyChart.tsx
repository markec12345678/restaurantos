'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3 } from 'lucide-react'
import type { AreaOccupancyChartProps } from './constants'
import { safeToFixed, safeNum } from '@/lib/safe-format'

// ============================================
// ZASEDENOST PO OBMOČJIH — Vizualizacija
// ============================================

export const AreaOccupancyChart = memo(function AreaOccupancyChart({ areaOccupancy }: AreaOccupancyChartProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-4 w-4" /> Zasedenost po območjih
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {areaOccupancy.map(({ area, label, occupied, total, pct }) => (
            <div key={area} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="font-medium">{label}</span>
                <span className="text-muted-foreground">{occupied}/{total} miz ({safeToFixed(pct, 0)}%)</span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2">
                <div className={`h-2 rounded-full ${
                  pct > 90 ? 'bg-red-500' :
                  pct > 70 ? 'bg-amber-500' :
                  'bg-green-500'
                }`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
})
