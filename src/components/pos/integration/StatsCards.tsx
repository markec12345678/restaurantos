'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Plug, Wifi, ArrowRightLeft, XCircle } from 'lucide-react'
import type { StatsCardsProps } from './constants'

// ============================================
// STATISTIČNE KARTICE — Povzetek integracij
// ============================================

export const StatsCards = memo(function StatsCards({ totalCount, connectedCount, activeCount, errorCount }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Plug className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalCount}</p>
              <p className="text-xs text-muted-foreground">Skupaj integracij</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
              <Wifi className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{connectedCount}</p>
              <p className="text-xs text-muted-foreground">Povezanih</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
              <ArrowRightLeft className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{activeCount}</p>
              <p className="text-xs text-muted-foreground">Aktivnih</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
              <XCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-700 dark:text-red-400">{errorCount}</p>
              <p className="text-xs text-muted-foreground">Z napakami</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
})
