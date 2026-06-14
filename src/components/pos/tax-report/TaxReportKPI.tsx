'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { BarChart3, Calculator, Shield, FileText } from 'lucide-react'
import type { TaxReportData } from './constants'
import { formatCurrency } from './constants'

interface TaxReportKPIProps {
  data: TaxReportData
}

export const TaxReportKPI = memo(function TaxReportKPI({
  data,
}: TaxReportKPIProps) {
  return (
    <div className="grid grid-cols-4 gap-3">
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="h-4 w-4 text-blue-500" />
            <span className="text-xs text-muted-foreground">Skupaj prihodek</span>
          </div>
          <p className="text-xl font-bold">{formatCurrency(data.totalRevenue)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <Calculator className="h-4 w-4 text-emerald-500" />
            <span className="text-xs text-muted-foreground">Skupaj DDV</span>
          </div>
          <p className="text-xl font-bold">{formatCurrency(data.totalTax)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="h-4 w-4 text-purple-500" />
            <span className="text-xs text-muted-foreground">FURS oddano</span>
          </div>
          <p className="text-xl font-bold">{data.fursSubmissions}</p>
          {data.fursPending > 0 && <p className="text-xs text-amber-600">{data.fursPending} čakajočih</p>}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-4 w-4 text-orange-500" />
            <span className="text-xs text-muted-foreground">Z-poročila</span>
          </div>
          <p className="text-xl font-bold">{data.zReportsCount}</p>
        </CardContent>
      </Card>
    </div>
  )
})
