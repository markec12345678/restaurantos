'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowRight, LayoutGrid } from 'lucide-react'
import { STATUS_CONFIG } from './constants'
import type { TablesListProps } from './constants'

// ============================================
// SEZNAM MIZ Z REZERVACIJAMI
// ============================================
export const TablesList = memo(function TablesList({
  tables,
  onSeatReservation,
}: TablesListProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <LayoutGrid className="h-4 w-4" /> Mize
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[400px] overflow-auto">
        {tables.map(table => {
          const config = STATUS_CONFIG[table.status]
          return (
            <div key={table.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className={`h-8 w-8 rounded flex items-center justify-center text-sm font-bold ${config.dot} text-white`} aria-label={config.srLabel}>
                  {table.number}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">Miza {table.number}</span>
                    <Badge className={config.color}>{config.label}</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{table.capacity} mest</span>
                    {table.guests > 0 && <span>· {table.guests} gostov</span>}
                    {table.server && <span>· {table.server}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {table.reservation && (
                  <div className="text-right">
                    <p className="text-xs font-medium">{table.reservation.guestName}</p>
                    <p className="text-xs text-muted-foreground">{table.reservation.time} · {table.reservation.partySize} oseb</p>
                  </div>
                )}
                {table.reservation && table.reservation.status === 'confirmed' && (
                  <Button size="sm" variant="outline" onClick={() => onSeatReservation(table.reservation!.id, table.id)} aria-label={`Posadi rezervacijo za mizo ${table.number}`}>
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
})
