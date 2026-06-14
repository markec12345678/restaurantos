'use client'

// ─── Vizualni pregled miz ─────────────────────────────────────
import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, CheckCircle2, LayoutGrid } from 'lucide-react'
import type { VisualOverviewProps } from './constants'

export const VisualOverview = memo(function VisualOverview({ tables, analytics }: VisualOverviewProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <LayoutGrid className="h-4 w-4" />
          Vizualni pregled
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {tables.map(table => {
            const isOccupied = table.status === 'occupied' || !!table.currentOrder
            const isReserved = table.status === 'reserved'
            const occupancy = analytics.occupancyTimes.find(t => t.tableId === table.id)
            const minutes = occupancy?.minutes || 0

            return (
              <div
                key={table.id}
                className={`p-3 rounded-xl border-2 text-center transition-all cursor-default ${
                  isOccupied
                    ? minutes > 90
                      ? 'border-red-400 bg-red-100 dark:bg-red-900/30 dark:border-red-700'
                      : 'border-amber-400 bg-amber-100 dark:bg-amber-900/30 dark:border-amber-700'
                    : isReserved
                      ? 'border-blue-400 bg-blue-100 dark:bg-blue-900/30 dark:border-blue-700'
                      : 'border-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 dark:border-emerald-700'
                }`}
              >
                <p className="font-bold text-sm">{table.name || `Miza ${table.number}`}</p>
                <p className="text-[10px] text-muted-foreground">{table.capacity} oseb</p>
                {isOccupied && minutes > 0 && (
                  <div className="mt-1">
                    <Badge variant="outline" className={`text-[9px] font-mono ${
                      minutes > 90 ? 'text-red-600 border-red-300' : minutes > 60 ? 'text-amber-600 border-amber-300' : 'text-emerald-600 border-emerald-300'
                    }`}>
                      <Clock className="h-2.5 w-2.5 mr-0.5" />
                      {minutes} min
                    </Badge>
                  </div>
                )}
                {!isOccupied && !isReserved && (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto mt-1" />
                )}
                {isReserved && (
                  <Badge className="bg-blue-100 text-blue-700 text-[9px] mt-1">Rezervirana</Badge>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
})
