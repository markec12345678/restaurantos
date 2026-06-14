'use client'

// ─── Trenutno zasedene mize ────────────────────────────────────
import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, AlertTriangle, UtensilsCrossed, LayoutGrid } from 'lucide-react'
import type { OccupiedTablesCardProps } from './constants'

export const OccupiedTablesCard = memo(function OccupiedTablesCard({ analytics }: OccupiedTablesCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <UtensilsCrossed className="h-4 w-4" />
          Trenutno zasedene mize ({analytics.occupiedTables})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {analytics.occupancyTimes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <LayoutGrid className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Trenutno ni zasedenih miz</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
            {analytics.occupancyTimes
              .sort((a, b) => b.minutes - a.minutes)
              .map(t => (
                <div key={t.tableId} className={`p-3 rounded-lg border-2 ${
                  t.minutes > 90
                    ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/10'
                    : t.minutes > 60
                      ? 'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10'
                      : 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono">Miza {t.tableNumber}</Badge>
                      {t.minutes > 90 && (
                        <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 text-[10px]">
                          <AlertTriangle className="h-3 w-3 mr-0.5" />Predolgo
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-sm font-mono">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className={t.minutes > 90 ? 'text-red-600 font-bold' : t.minutes > 60 ? 'text-amber-600' : 'text-emerald-600'}>
                        {t.minutes} min
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{t.customer || 'Hodič'}</span>
                    <span>{'\u20AC'}{t.total.toFixed(2)}</span>
                  </div>
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
})
