'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Users, UserCheck, Coins, CircleDollarSign } from 'lucide-react'
import { formatPoints } from './constants'

// --- Props ---

interface LoyaltySummaryCardsProps {
  totalAccounts: number
  activeAccounts: number
  totalPointsIssued: number
  totalPointsRedeemed: number
}

// --- Komponenta ---

export const LoyaltySummaryCards = memo(function LoyaltySummaryCards({
  totalAccounts,
  activeAccounts,
  totalPointsIssued,
  totalPointsRedeemed,
}: LoyaltySummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalAccounts}</p>
              <p className="text-xs text-muted-foreground">Skupaj računov</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{activeAccounts}</p>
              <p className="text-xs text-muted-foreground">Aktivni računi</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">
              <Coins className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{formatPoints(totalPointsIssued)}</p>
              <p className="text-xs text-muted-foreground">Izdane točke</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
              <CircleDollarSign className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{formatPoints(totalPointsRedeemed)}</p>
              <p className="text-xs text-muted-foreground">Unovčene točke</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
})
