'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Activity } from 'lucide-react'

// ============================================
// PODROBNOSTI IZBRE LOKACIJE
// ============================================

interface LocationStats {
  todayRevenue?: number
  todayOrders?: number
  avgOrderValue?: number
  tableOccupancy?: number
}

export const LocationDetailPanel = memo(function LocationDetailPanel({
  stats,
}: {
  stats: LocationStats
}) {
  const formatCurrency = (val: number) => `€${(val || 0).toFixed(2)}`

  return (
    <Card className="border-indigo-200 dark:border-indigo-800">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4 text-indigo-500" />
          Podrobnosti lokacije
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <div className="text-xs text-muted-foreground">Današnja prodaja</div>
            <div className="text-xl font-bold text-green-600">{formatCurrency(stats.todayRevenue || 0)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Naročila danes</div>
            <div className="text-xl font-bold">{stats.todayOrders || 0}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Povprečno naročilo</div>
            <div className="text-xl font-bold">{formatCurrency(stats.avgOrderValue || 0)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Zasedenost mize</div>
            <div className="text-xl font-bold">{stats.tableOccupancy || 0}%</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})
