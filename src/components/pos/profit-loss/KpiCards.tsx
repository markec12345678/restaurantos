'use client'

// ─── KPI kartice za P&L porocilo ──────────────────────────────

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { DollarSign, Calculator, ArrowUpRight, ArrowDownRight, Receipt } from 'lucide-react'
import { formatCurrency, formatPercent, type KpiCardsProps } from './constants'

export const KpiCards = memo(function KpiCards({ data, isProfitable }: KpiCardsProps) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {/* Skupaj prihodek */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="h-4 w-4 text-blue-500" />
            <span className="text-xs text-muted-foreground">Skupaj prihodek</span>
          </div>
          <p className="text-xl font-bold">{formatCurrency(data.revenue.total)}</p>
        </CardContent>
      </Card>
      {/* Bruto dobidzek */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <Calculator className="h-4 w-4 text-green-500" />
            <span className="text-xs text-muted-foreground">Bruto dobidzek</span>
          </div>
          <p className="text-xl font-bold">{formatCurrency(data.grossProfit)}</p>
          <p className="text-xs text-muted-foreground">{formatPercent(data.grossMargin)} marza</p>
        </CardContent>
      </Card>
      {/* Neto dobidzek */}
      <Card className={isProfitable ? 'border-green-200 dark:border-green-800' : 'border-red-200 dark:border-red-800'}>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1">
            {isProfitable ? (
              <ArrowUpRight className="h-4 w-4 text-green-500" />
            ) : (
              <ArrowDownRight className="h-4 w-4 text-red-500" />
            )}
            <span className="text-xs text-muted-foreground">Neto dobidzek</span>
          </div>
          <p className={`text-xl font-bold ${isProfitable ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(data.netProfit)}
          </p>
          <p className="text-xs text-muted-foreground">{formatPercent(data.netMargin)} marza</p>
        </CardContent>
      </Card>
      {/* Povprecni racun */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <Receipt className="h-4 w-4 text-purple-500" />
            <span className="text-xs text-muted-foreground">Povprecni racun</span>
          </div>
          <p className="text-xl font-bold">{formatCurrency(data.avgCheck)}</p>
          <p className="text-xs text-muted-foreground">{data.covers} racunov</p>
        </CardContent>
      </Card>
    </div>
  )
})
