'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { TaxReportData } from './constants'
import { formatCurrency } from './constants'

interface TaxBreakdownTableProps {
  data: TaxReportData
}

export const TaxBreakdownTable = memo(function TaxBreakdownTable({
  data,
}: TaxBreakdownTableProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">DDV razčlenitev po stopnjah</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Header */}
          <div className="grid grid-cols-4 gap-2 text-xs font-medium text-muted-foreground pb-2 border-b">
            <span>Stopnja DDV</span>
            <span className="text-right">Osnova</span>
            <span className="text-right">DDV</span>
            <span className="text-right">Skupaj</span>
          </div>

          {data.taxBreakdown.map(tax => (
            <div key={tax.rate} className="grid grid-cols-4 gap-2 text-sm">
              <span className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">{tax.rate}%</Badge>
                {tax.label}
              </span>
              <span className="text-right font-medium">{formatCurrency(tax.base)}</span>
              <span className="text-right font-medium text-emerald-600">{formatCurrency(tax.tax)}</span>
              <span className="text-right font-medium">{formatCurrency(tax.total)}</span>
            </div>
          ))}

          <div className="grid grid-cols-4 gap-2 text-sm font-bold pt-3 border-t">
            <span>SKUPAJ</span>
            <span className="text-right">{formatCurrency(data.taxableRevenue)}</span>
            <span className="text-right text-emerald-600">{formatCurrency(data.totalTax)}</span>
            <span className="text-right">{formatCurrency(data.totalWithTax)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
})
