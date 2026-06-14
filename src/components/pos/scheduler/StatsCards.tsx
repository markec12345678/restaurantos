'use client'
// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Statisticne kartice (Stats Cards)
// Povzetek statistike izmen za teden
// ═══════════════════════════════════════════════════════════════
import { memo } from 'react'
import { Card } from '@/components/ui/card'
import { Clock, UserCheck, Briefcase, TrendingUp, CheckCircle2, XCircle } from 'lucide-react'
import { type SchedulerStats } from './constants'

// ─── Props ─────────────────────────────────────────────────────
export interface StatsCardsProps {
  stats: SchedulerStats
}

// ─── Komponenta ────────────────────────────────────────────────
export const StatsCards = memo(function StatsCards({
  stats,
}: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 px-4 py-3 flex-shrink-0">
      <Card className="p-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Clock className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Skupaj ur</p>
            <p className="font-bold text-sm">{stats.totalHours.toFixed(1)}h</p>
          </div>
        </div>
      </Card>
      <Card className="p-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
            <UserCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Zaposlenih</p>
            <p className="font-bold text-sm">{stats.uniqueEmployees}</p>
          </div>
        </div>
      </Card>
      <Card className="p-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <Briefcase className="h-4 w-4 text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Načrtovane</p>
            <p className="font-bold text-sm">{stats.scheduledCount}</p>
          </div>
        </div>
      </Card>
      <Card className="p-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">V teku</p>
            <p className="font-bold text-sm">{stats.inProgressCount}</p>
          </div>
        </div>
      </Card>
      <Card className="p-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gray-100 dark:bg-gray-900/30 flex items-center justify-center">
            <CheckCircle2 className="h-4 w-4 text-gray-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Zaključene</p>
            <p className="font-bold text-sm">{stats.completedCount}</p>
          </div>
        </div>
      </Card>
      <Card className="p-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <XCircle className="h-4 w-4 text-red-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Odsotni</p>
            <p className="font-bold text-sm">{stats.absentCount}</p>
          </div>
        </div>
      </Card>
    </div>
  )
})
