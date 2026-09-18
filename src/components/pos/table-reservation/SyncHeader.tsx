'use client'

import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Table2, RefreshCw } from 'lucide-react'
import type { SyncHeaderProps } from './constants'

// ============================================
// GLAVA SINHRONIZACIJE
// ============================================
export const SyncHeader = memo(function SyncHeader({
  selectedDate,
  onDateChange,
  onRefresh,
}: SyncHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-100 to-sky-100 dark:from-cyan-900/40 dark:to-sky-900/40 ring-1 ring-cyan-200/60 dark:ring-cyan-800/60">
          <Table2 className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold leading-tight">Sinhronizacija miz in rezervacij</h2>
          <p className="text-sm text-muted-foreground">Real-time pregled mize ↔ rezervacije · osvežitev vsakih 15 s</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={selectedDate}
          onChange={e => onDateChange(e.target.value)}
          aria-label="Izberite datum za pregled rezervacij"
          className="px-3 py-1.5 text-sm border rounded-md bg-background tabular-nums focus:ring-2 focus:ring-primary/40 outline-none transition-shadow"
        />
        <Button size="sm" variant="outline" className="hover:bg-accent" onClick={onRefresh}>
          <RefreshCw className="h-3 w-3 mr-1" /> Osveži
        </Button>
      </div>
    </div>
  )
})
