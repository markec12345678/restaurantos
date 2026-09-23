'use client'

import { memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'

// --- Props ---

interface TableSummaryStatsProps {
  availableTables: number
  occupiedTables: number
  totalTables: number
}

// --- Komponenta: Povzetek statistike miz ---

export const TableSummaryStats = memo(function TableSummaryStats({
  availableTables,
  occupiedTables,
  totalTables,
}: TableSummaryStatsProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {/* R114 (ref #111): obrobe nevtralne — rdeča obroba je lažno alarmirala
          tudi pri 0 zasedenih (0 = dobra novica, ne nevarnost); število ohrani barvo statusa */}
      <Card>
        <CardContent className="p-3 text-center">
          <p className="text-2xl font-bold text-emerald-600">{availableTables}</p>
          <p className="text-xs text-muted-foreground">Proste</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3 text-center">
          <p className="text-2xl font-bold text-red-600">{occupiedTables}</p>
          <p className="text-xs text-muted-foreground">Zasedene</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-3 text-center">
          <p className="text-2xl font-bold">{totalTables}</p>
          <p className="text-xs text-muted-foreground">Skupaj</p>
        </CardContent>
      </Card>
    </div>
  )
})
