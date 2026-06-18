'use client'
// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Glava razporeda (Scheduler Header)
// Naslov, povzetek statistike in akcijski gumbi
// ═══════════════════════════════════════════════════════════════
import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { CalendarDays, Copy, Plus } from 'lucide-react'
import { type SchedulerStats } from './constants'
import { safeToFixed, safeNum } from '@/lib/safe-format'

// ─── Props ─────────────────────────────────────────────────────
export interface SchedulerHeaderProps {
  stats: SchedulerStats
  filteredShiftsCount: number
  onCopyWeek: () => void
  onNewShift: () => void
}

// ─── Komponenta ────────────────────────────────────────────────
export const SchedulerHeader = memo(function SchedulerHeader({
  stats,
  filteredShiftsCount,
  onCopyWeek,
  onNewShift,
}: SchedulerHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          Razpored zaposlenih
        </h2>
        <p className="text-xs text-muted-foreground">
          {stats.uniqueEmployees} zaposlenih · {safeToFixed(stats.totalHours, 1)} ur · {filteredShiftsCount} izmen
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onCopyWeek}>
          <Copy className="h-4 w-4 mr-1" /> Kopiraj teden
        </Button>
        <Button size="sm" onClick={onNewShift}>
          <Plus className="h-4 w-4 mr-1" /> Nova izmena
        </Button>
      </div>
    </div>
  )
})
