'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar, CheckCircle, AlertCircle } from 'lucide-react'
import type { TaxReportData } from './constants'
import { formatCurrency } from './constants'

interface TaxDailyViewProps {
  data: TaxReportData
}

export const TaxDailyView = memo(function TaxDailyView({
  data,
}: TaxDailyViewProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Dnevni pregled</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          <div className="grid grid-cols-4 gap-2 text-xs font-medium text-muted-foreground pb-2 border-b">
            <span>Datum</span>
            <span className="text-right">Prihodek</span>
            <span className="text-right">DDV</span>
            <span className="text-right">Z-poročilo</span>
          </div>

          {data.dailyBreakdown.length === 0 ? (
            <div className="py-6 text-center">
              <Calendar className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Ni podatkov za izbrano obdobje</p>
            </div>
          ) : (
            data.dailyBreakdown.map(day => (
              <div key={day.date} className="grid grid-cols-4 gap-2 text-sm py-1">
                <span>{new Date(day.date).toLocaleDateString('sl-SI', { day: 'numeric', month: 'short' })}</span>
                <span className="text-right font-medium">{formatCurrency(day.revenue)}</span>
                <span className="text-right text-emerald-600">{formatCurrency(day.tax)}</span>
                <span className="text-right">
                  {day.zReport ? (
                    <CheckCircle className="h-4 w-4 text-green-500 inline" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-amber-500 inline" />
                  )}
                </span>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
})
