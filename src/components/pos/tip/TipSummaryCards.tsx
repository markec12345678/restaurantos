'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { DollarSign, Wallet, CreditCard, Users } from 'lucide-react'
import { formatCurrency } from './constants'

interface TipSummaryCardsProps {
  totalTips: number
  cashTips: number
  cardTips: number
  employeeCount: number
}

export const TipSummaryCards = memo(function TipSummaryCards({
  totalTips,
  cashTips,
  cardTips,
  employeeCount,
}: TipSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="h-4 w-4 text-green-600" />
            <span className="text-xs text-muted-foreground">Skupne napitnine</span>
          </div>
          <div className="text-2xl font-bold text-green-600">{formatCurrency(totalTips)}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="h-4 w-4 text-amber-600" />
            <span className="text-xs text-muted-foreground">Gotovinske</span>
          </div>
          <div className="text-xl font-bold text-amber-600">{formatCurrency(cashTips)}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="h-4 w-4 text-blue-600" />
            <span className="text-xs text-muted-foreground">Kartične</span>
          </div>
          <div className="text-xl font-bold text-blue-600">{formatCurrency(cardTips)}</div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-4 w-4 text-purple-600" />
            <span className="text-xs text-muted-foreground">Zaposlenih</span>
          </div>
          <div className="text-xl font-bold text-purple-600">{employeeCount}</div>
        </CardContent>
      </Card>
    </div>
  )
})
