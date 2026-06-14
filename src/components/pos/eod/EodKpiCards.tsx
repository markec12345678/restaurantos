'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import type { EodKpiCardsProps } from './constants'

// ============================================
// EOD KPI CARDS - Ključni kazalniki
// ============================================
export const EodKpiCards = memo(function EodKpiCards({ data }: EodKpiCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      <Card>
        <CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground">Prihodek</p>
          <p className="text-xl font-bold text-emerald-600">&euro;{data.orders.revenue.toFixed(2)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground">Naročila</p>
          <p className="text-xl font-bold">{data.orders.completed}</p>
          <p className="text-[9px] text-muted-foreground">{data.orders.cancelled} preklicanih</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground">Napitnine</p>
          <p className="text-xl font-bold text-amber-600">&euro;{data.payments.totalTips.toFixed(2)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground">Neto dobiček</p>
          <p className={`text-xl font-bold ${data.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            &euro;{data.netProfit.toFixed(2)}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground">FURS overjeno</p>
          <p className="text-xl font-bold">{data.furs.verified}</p>
          {data.furs.failed > 0 && <p className="text-[9px] text-red-500">{data.furs.failed} neuspešnih</p>}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground">Stroški</p>
          <p className="text-xl font-bold text-red-600">&euro;{data.expenses.total.toFixed(2)}</p>
        </CardContent>
      </Card>
    </div>
  )
})
