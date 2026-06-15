'use client'

import { memo } from 'react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EodData = any

interface EodSummaryStatsProps {
  eodData: EodData
}

export const EodSummaryStats = memo(function EodSummaryStats({ eodData }: EodSummaryStatsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div className="text-center p-3 rounded-lg bg-primary/5 border">
        <p className="text-xs text-muted-foreground">Prihodek</p>
        <p className="text-lg font-bold text-primary">&euro;{eodData.summary.totalRevenue.toFixed(2)}</p>
      </div>
      <div className="text-center p-3 rounded-lg bg-muted/50 border">
        <p className="text-xs text-muted-foreground">Naročila</p>
        <p className="text-lg font-bold">{eodData.summary.completedOrders}</p>
        <p className="text-[10px] text-muted-foreground">{eodData.summary.cancelledOrders} preklicanih</p>
      </div>
      <div className="text-center p-3 rounded-lg bg-muted/50 border">
        <p className="text-xs text-muted-foreground">Povprečno</p>
        <p className="text-lg font-bold">&euro;{eodData.summary.avgOrderValue.toFixed(2)}</p>
      </div>
      <div className="text-center p-3 rounded-lg bg-muted/50 border">
        <p className="text-xs text-muted-foreground">Napitnine</p>
        <p className="text-lg font-bold text-emerald-600">&euro;{eodData.summary.totalTips.toFixed(2)}</p>
      </div>
    </div>
  )
})
