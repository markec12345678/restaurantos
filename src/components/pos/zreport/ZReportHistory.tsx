'use client'

// ═══════════════════════════════════════════════════════════════
// ZGODOVINA Z-POROČIL — seznam zadnjih zaključkov
// ═══════════════════════════════════════════════════════════════

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CalendarDays } from 'lucide-react'
import { format } from 'date-fns'
import { sl } from 'date-fns/locale'
import { formatCurrency } from './constants'
import type { ZReportHistoryProps, ZReportData } from './constants'

export const ZReportHistory = memo(function ZReportHistory({ reports, onSelectDate }: ZReportHistoryProps) {
  if (!reports || reports.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarDays className="h-4 w-4" /> Zadnja Z-poročila
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {reports.slice(0, 10).map((r: ZReportData) => (
            <div
              key={r.id}
              className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-accent/50 transition-colors"
              role="button"
              tabIndex={0}
              onClick={() => onSelectDate(format(new Date(r.reportDate), 'yyyy-MM-dd'))}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectDate(format(new Date(r.reportDate), 'yyyy-MM-dd')) } }}
              aria-label={`Izberi poročilo za ${format(new Date(r.reportDate), 'd. MMMM yyyy', { locale: sl })}`}
            >
              <div className="flex items-center gap-3">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{format(new Date(r.reportDate), 'EEE, d. MMM', { locale: sl })}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-semibold">{formatCurrency(r.totalSales)}</span>
                <Badge variant={r.status === 'finalized' ? 'default' : 'secondary'} className="text-xs">
                  {r.status === 'finalized' ? 'Zaključeno' : 'Osnutek'}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
})
