'use client'

// ═══════════════════════════════════════════════════════════════
// PROFITABILITETA + POPUSTI/VOID — kartici z dobičkom in popusti
// ═══════════════════════════════════════════════════════════════

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3, TrendingDown, DollarSign, AlertTriangle, Receipt } from 'lucide-react'
import { formatCurrency } from './constants'
import { safeToFixed, safeNum } from '@/lib/safe-format'
import type { ProfitDiscountSectionProps } from './constants'

export const ProfitDiscountSection = memo(function ProfitDiscountSection({ report }: ProfitDiscountSectionProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Profitabiliteta */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Profitabiliteta
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Stroški (Food Cost)</span>
              <span className="font-medium text-red-600">{formatCurrency(report.totalCost)}</span>
            </div>
            <div className="flex justify-between py-2 border-b">
              <span className="text-muted-foreground">Bruto dobiček</span>
              <span className="font-medium text-green-600">{formatCurrency(report.grossProfit)}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="font-medium">Bruto marža</span>
              <span className={`font-bold text-lg ${
                report.grossMargin > 65 ? 'text-green-600' :
                report.grossMargin > 50 ? 'text-amber-600' : 'text-red-600'
              }`}>
                {safeToFixed(report.grossMargin, 1)}%
              </span>
            </div>
            {/* Vizualna vrstica marže */}
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mt-1" role="progressbar" aria-valuenow={Math.min(report.grossMargin, 100)} aria-valuemin={0} aria-valuemax={100} aria-valuetext={report.grossMargin > 65 ? 'Visoka marža' : report.grossMargin > 50 ? 'Zadostna marža' : 'Nizka marža'}>
              <div
                className={`h-3 rounded-full ${
                  report.grossMargin > 65 ? 'bg-green-500' :
                  report.grossMargin > 50 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(report.grossMargin, 100)}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Popusti, napitnine in poničitve */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Popusti, napitnine in poničitve</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="flex items-center gap-2 text-muted-foreground">
                <TrendingDown className="h-4 w-4 text-red-500" /> Popusti
              </span>
              <span className="font-medium text-red-600">{formatCurrency(report.totalDiscounts)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="flex items-center gap-2 text-muted-foreground">
                <DollarSign className="h-4 w-4 text-green-500" /> Napitnine
              </span>
              <span className="font-medium text-green-600">{formatCurrency(report.totalTips)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="flex items-center gap-2 text-muted-foreground">
                <AlertTriangle className="h-4 w-4 text-yellow-500" /> Poničeno
              </span>
              <span className="font-medium text-yellow-600">{formatCurrency(report.totalVoided)}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="flex items-center gap-2 text-muted-foreground">
                <Receipt className="h-4 w-4 text-red-500" /> Storno
              </span>
              <span className="font-medium text-red-600">{formatCurrency(report.totalStorno)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
})
