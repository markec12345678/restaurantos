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
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-100 dark:bg-cyan-900/30">
          <Table2 className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Sinhronizacija miz in rezervacij</h2>
          <p className="text-sm text-muted-foreground">Real-time pregled mize ↔ rezervacije</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={selectedDate}
          onChange={e => onDateChange(e.target.value)}
          aria-label="Izberite datum za pregled rezervacij"
          className="px-3 py-1.5 text-sm border rounded-md bg-background"
        />
        <Button size="sm" variant="outline" onClick={onRefresh}>
          <RefreshCw className="h-3 w-3 mr-1" /> Osveži
        </Button>
      </div>
    </div>
  )
})
