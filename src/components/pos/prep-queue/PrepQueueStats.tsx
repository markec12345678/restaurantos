'use client'

// ═══════════════════════════════════════════════════════════════
// KPI STATISTIKA — vrstica s povzetkom kuhinjskega vrstnega reda
// ═══════════════════════════════════════════════════════════════

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Clock, Flame, CheckCircle2, Timer } from 'lucide-react'
import type { PrepQueueStatsProps } from './constants'

export const PrepQueueStats = memo(function PrepQueueStats({ stats }: PrepQueueStatsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {/* Čakajoča naročila */}
      <Card className="border-yellow-300 dark:border-yellow-800">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
            <Clock className="h-5 w-5 text-yellow-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats?.pending || 0}</p>
            <p className="text-xs text-muted-foreground">Čakajoča</p>
          </div>
        </CardContent>
      </Card>

      {/* V pripravi */}
      <Card className="border-blue-300 dark:border-blue-800">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Flame className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats?.preparing || 0}</p>
            <p className="text-xs text-muted-foreground">V pripravi</p>
          </div>
        </CardContent>
      </Card>

      {/* Pripravljena */}
      <Card className="border-emerald-300 dark:border-emerald-800">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{stats?.ready || 0}</p>
            <p className="text-xs text-muted-foreground">Pripravljena</p>
          </div>
        </CardContent>
      </Card>

      {/* Povprečno čakanje */}
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
            <Timer className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <p className="text-2xl font-bold">{Math.round(stats?.avgWaitTime || 0)} min</p>
            <p className="text-xs text-muted-foreground">Povpr. čakanje</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
})
