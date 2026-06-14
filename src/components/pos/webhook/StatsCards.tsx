'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Globe, CheckCircle2, Zap, AlertTriangle } from 'lucide-react'
import type { StatsCardsProps } from './constants'

// ============================================
// POVZETEK KARTIC — STATISTIKA SPLETNIH KLJUK
// ============================================

export const StatsCards = memo(function StatsCards({ totalCount, activeCount, totalEvents, failedCount }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalCount}</p>
              <p className="text-xs text-muted-foreground">Skupaj kljuk</p>
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
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{activeCount}</p>
              <p className="text-xs text-muted-foreground">Aktivne</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{totalEvents}</p>
              <p className="text-xs text-muted-foreground">Sledeni dogodki</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-700 dark:text-red-400">{failedCount}</p>
              <p className="text-xs text-muted-foreground">Z napakami</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
})
