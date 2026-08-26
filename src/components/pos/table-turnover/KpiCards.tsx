'use client'

// ─── KPI kartice za analitiko obračuna miz ─────────────────────
import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import type { KpiCardsProps } from './constants'
import { safeToFixed, safeNum } from '@/lib/safe-format'

export const KpiCards = memo(function KpiCards({ analytics }: KpiCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      <Card>
        <CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground font-medium">Zasedenost</p>
          <p className="text-xl font-bold">{safeToFixed(analytics.occupancyRate, 0)}%</p>
          <Progress value={analytics.occupancyRate} className="h-1.5 mt-1" />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground font-medium">Mize</p>
          <p className="text-xl font-bold">{analytics.occupiedTables}/{analytics.totalTables}</p>
          <p className="text-[10px] text-muted-foreground">{analytics.availableTables} prostih</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground font-medium">Kapaciteta</p>
          <p className="text-xl font-bold">{safeToFixed(analytics.capacityUtilization, 0)}%</p>
          <p className="text-[10px] text-muted-foreground">{analytics.occupiedCapacity}/{analytics.totalCapacity} oseb</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground font-medium">Povpr. čas</p>
          <p className="text-xl font-bold">{safeToFixed(analytics.avgOccupancyTime, 0)} min</p>
          <p className="text-[10px] text-muted-foreground">zasedenosti</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground font-medium">Obračun</p>
          <p className="text-xl font-bold">{safeToFixed(analytics.turnoverRate, 1)}x</p>
          <p className="text-[10px] text-muted-foreground">na mizo</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground font-medium">Poraba/mizo</p>
          <p className="text-xl font-bold">{'\u20AC'}{safeToFixed(analytics.avgSpendPerTable, 2)}</p>
          <p className="text-[10px] text-muted-foreground">povprečno</p>
        </CardContent>
      </Card>
    </div>
  )
})
