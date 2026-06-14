'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { CreditCard, CheckCircle2, Wallet, TrendingUp } from 'lucide-react'
import { formatCurrency } from './constants'

// --- Props ---

interface GiftCardSummaryCardsProps {
  totalCards: number
  activeCards: number
  totalBalanceOutstanding: number
  totalLoadedThisMonth: number
}

// --- Komponenta ---

export const GiftCardSummaryCards = memo(function GiftCardSummaryCards({
  totalCards,
  activeCards,
  totalBalanceOutstanding,
  totalLoadedThisMonth,
}: GiftCardSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalCards}</p>
              <p className="text-xs text-muted-foreground">Skupaj kartic</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{activeCards}</p>
              <p className="text-xs text-muted-foreground">Aktivne kartice</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{formatCurrency(totalBalanceOutstanding)}</p>
              <p className="text-xs text-muted-foreground">Stanje izdatka</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-teal-700 dark:text-teal-400">{formatCurrency(totalLoadedThisMonth)}</p>
              <p className="text-xs text-muted-foreground">Naloženo ta mesec</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
})
