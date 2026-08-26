'use client'

import { memo } from 'react'
import { safeToFixed, safeNum } from '@/lib/safe-format'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EodData = any

interface EodCostAnalysisProps {
  eodData: EodData
}

export const EodCostAnalysis = memo(function EodCostAnalysis({ eodData }: EodCostAnalysisProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      <div className="text-center p-2 rounded-lg bg-orange-50 dark:bg-orange-900/10">
        <p className="text-[10px] text-muted-foreground">Nabava</p>
        <p className="font-bold text-orange-600 text-sm">&euro;{safeToFixed(eodData.costs.procurementCost, 2)}</p>
      </div>
      <div className="text-center p-2 rounded-lg bg-red-50 dark:bg-red-900/10">
        <p className="text-[10px] text-muted-foreground">COGS</p>
        <p className="font-bold text-red-600 text-sm">&euro;{safeToFixed(eodData.costs.cogs, 2)}</p>
      </div>
      <div className="text-center p-2 rounded-lg bg-amber-50 dark:bg-amber-900/10">
        <p className="text-[10px] text-muted-foreground">Odpisi</p>
        <p className="font-bold text-amber-600 text-sm">&euro;{safeToFixed(eodData.costs.writeOffCost, 2)}</p>
      </div>
      <div className="text-center p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/10">
        <p className="text-[10px] text-muted-foreground">Bruto marža</p>
        <p className="font-bold text-emerald-600 text-sm">&euro;{safeToFixed(eodData.costs.grossProfit, 2)} ({safeToFixed(eodData.costs.grossMargin, 1)}%)</p>
      </div>
    </div>
  )
})
