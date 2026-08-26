'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3 } from 'lucide-react'

// ============================================
// STROŠKOVNA ANALIZA — 5 kartic s stroški
// ============================================

interface CostAnalysisCardProps {
  totalRevenue: number
  procurementCost: number
  cogs: number
  writeOffCost: number
  grossProfit: number
  grossMargin: number
  fmt: (_n: number) => string
  fmtPct: (_n: number) => string
}

export const CostAnalysisCard = memo(function CostAnalysisCard({
  totalRevenue,
  procurementCost,
  cogs,
  writeOffCost,
  grossProfit,
  grossMargin,
  fmt,
  fmtPct,
}: CostAnalysisCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          Stroškovna analiza
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20">
            <p className="text-xs text-muted-foreground mb-1">Prihodek</p>
            <p className="text-lg font-bold text-blue-600">{fmt(totalRevenue)}</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-orange-50 dark:bg-orange-900/20">
            <p className="text-xs text-muted-foreground mb-1">Nabavni stroški</p>
            <p className="text-lg font-bold text-orange-600">{fmt(procurementCost)}</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-red-50 dark:bg-red-900/20">
            <p className="text-xs text-muted-foreground mb-1">Stroški prodanih (COGS)</p>
            <p className="text-lg font-bold text-red-600">{fmt(cogs)}</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
            <p className="text-xs text-muted-foreground mb-1">Odpisi</p>
            <p className="text-lg font-bold text-yellow-600">{fmt(writeOffCost)}</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
            <p className="text-xs text-muted-foreground mb-1">Bruto dobiček</p>
            <p className="text-lg font-bold text-green-600">{fmt(grossProfit)}</p>
            <p className="text-xs text-green-600">Marža: {fmtPct(grossMargin)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})
