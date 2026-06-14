'use client'

// ─── Zavihek Povzetek za P&L porocilo ────────────────────────

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, Users, Home, Building, Package } from 'lucide-react'
import { formatCurrency, formatPercent, type SummaryTabProps } from './constants'

export const SummaryTab = memo(function SummaryTab({ data, isProfitable }: SummaryTabProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileText className="h-4 w-4" /> Izjava o poslovnem izidu
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {/* Prihodki */}
          <div className="flex justify-between items-center py-2 border-b font-medium">
            <span>PRIHODKI</span>
            <span>{formatCurrency(data.revenue.total)}</span>
          </div>
          <div className="flex justify-between items-center py-1 pl-4 text-sm text-muted-foreground">
            <span>Hrana</span>
            <span>{formatCurrency(data.revenue.food)}</span>
          </div>
          <div className="flex justify-between items-center py-1 pl-4 text-sm text-muted-foreground">
            <span>Pijaca</span>
            <span>{formatCurrency(data.revenue.beverages)}</span>
          </div>
          <div className="flex justify-between items-center py-1 pl-4 text-sm text-muted-foreground">
            <span>Dostava</span>
            <span>{formatCurrency(data.revenue.delivery)}</span>
          </div>
          <div className="flex justify-between items-center py-1 pl-4 text-sm text-muted-foreground">
            <span>Ostalo</span>
            <span>{formatCurrency(data.revenue.other)}</span>
          </div>
          {/* COGS */}
          <div className="flex justify-between items-center py-2 border-b font-medium text-red-600">
            <span>STROSKI BLAGA (COGS)</span>
            <span>-{formatCurrency(data.costOfGoods.total)}</span>
          </div>
          <div className="flex justify-between items-center py-1 pl-4 text-sm text-muted-foreground">
            <span>Hrana (30%)</span>
            <span>-{formatCurrency(data.costOfGoods.food)}</span>
          </div>
          <div className="flex justify-between items-center py-1 pl-4 text-sm text-muted-foreground">
            <span>Pijaca (25%)</span>
            <span>-{formatCurrency(data.costOfGoods.beverages)}</span>
          </div>
          {/* Bruto dobidzek */}
          <div className="flex justify-between items-center py-2 border-b font-medium text-green-600 bg-green-50 dark:bg-green-900/20 px-3 rounded">
            <span>BRUTO DOBIDZEK</span>
            <span>{formatCurrency(data.grossProfit)} ({formatPercent(data.grossMargin)})</span>
          </div>
          {/* Operativni stroski */}
          <div className="flex justify-between items-center py-2 border-b font-medium text-red-600">
            <span>OPERATIVNI STROSKI</span>
            <span>-{formatCurrency(data.operatingExpenses.total)}</span>
          </div>
          <div className="flex justify-between items-center py-1 pl-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-2"><Users className="h-3 w-3" /> Delo</span>
            <span>-{formatCurrency(data.operatingExpenses.labor)}</span>
          </div>
          <div className="flex justify-between items-center py-1 pl-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-2"><Home className="h-3 w-3" /> Najemnina</span>
            <span>-{formatCurrency(data.operatingExpenses.rent)}</span>
          </div>
          <div className="flex justify-between items-center py-1 pl-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-2"><Building className="h-3 w-3" /> Komunalije</span>
            <span>-{formatCurrency(data.operatingExpenses.utilities)}</span>
          </div>
          <div className="flex justify-between items-center py-1 pl-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-2"><Package className="h-3 w-3" /> Material</span>
            <span>-{formatCurrency(data.operatingExpenses.supplies)}</span>
          </div>
          {/* Operativni dobidzek */}
          <div className="flex justify-between items-center py-2 border-b font-medium bg-blue-50 dark:bg-blue-900/20 px-3 rounded">
            <span>OPERATIVNI DOBIDZEK</span>
            <span className={data.operatingProfit >= 0 ? 'text-green-600' : 'text-red-600'}>
              {formatCurrency(data.operatingProfit)} ({formatPercent(data.operatingMargin)})
            </span>
          </div>
          {/* Neto dobidzek */}
          <div className={`flex justify-between items-center py-3 font-bold text-lg ${isProfitable ? 'text-green-600 bg-green-50 dark:bg-green-900/20' : 'text-red-600 bg-red-50 dark:bg-red-900/20'} px-3 rounded`}>
            <span>NETO DOBIDZEK</span>
            <span>{formatCurrency(data.netProfit)} ({formatPercent(data.netMargin)})</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})
