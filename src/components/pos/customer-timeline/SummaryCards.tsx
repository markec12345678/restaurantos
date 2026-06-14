'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { UserCircle, TrendingUp, Star, Award } from 'lucide-react'
import { formatCurrency } from './constants'

// --- Props ---

interface SummaryCardsProps {
  totalGuests: number
  returningGuests: number
  avgSpendAll: number
  vipGuests: number
}

// --- Komponenta: Povzetek statistik ---

export const SummaryCards = memo(function SummaryCards({
  totalGuests,
  returningGuests,
  avgSpendAll,
  vipGuests,
}: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-4 gap-3">
      <Card>
        <CardContent className="p-3 text-center">
          <UserCircle className="h-5 w-5 text-blue-500 mx-auto mb-1" />
          <p className="text-xl font-bold">{totalGuests}</p>
          <p className="text-xs text-muted-foreground">Skupaj gostov</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3 text-center">
          <TrendingUp className="h-5 w-5 text-green-500 mx-auto mb-1" />
          <p className="text-xl font-bold">{totalGuests > 0 ? Math.round(returningGuests / totalGuests * 100) : 0}%</p>
          <p className="text-xs text-muted-foreground">Povratni gostje</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3 text-center">
          <Star className="h-5 w-5 text-amber-500 mx-auto mb-1" />
          <p className="text-xl font-bold">{formatCurrency(avgSpendAll)}</p>
          <p className="text-xs text-muted-foreground">Povprečna poraba</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3 text-center">
          <Award className="h-5 w-5 text-purple-500 mx-auto mb-1" />
          <p className="text-xl font-bold">{vipGuests}</p>
          <p className="text-xs text-muted-foreground">VIP gostje</p>
        </CardContent>
      </Card>
    </div>
  )
})
