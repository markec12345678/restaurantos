'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowRight, LayoutGrid, Armchair, User } from 'lucide-react'
import { STATUS_CONFIG } from './constants'
import type { TablesListProps } from './constants'
import { slCount, OSEBA_FORMS } from '@/lib/sl-plural'

// ============================================
// SEZNAM MIZ Z REZERVACIJAMI
// STIL R43: barvna leva obroba po statusu (ista kodiranje kot rezervacije),
// ikonska plosčica številke mize s statusno barvo, Armchair/User čipi za
// kapaciteto/goste, tabular-nums, hover dvig kartice, prosojna pika
// "Rezervirano ob HH:mm" chip z Armchair ikono.
// ============================================

/** Barvni naglasi per status (leva obroba + chip številke) */
const STATUS_HEX: Record<string, string> = {
  available: '#10b981',
  occupied: '#ef4444',
  reserved: '#3b82f6',
  blocked: '#6b7280',
}

export const TablesList = memo(function TablesList({
  tables,
  onSeatReservation,
}: TablesListProps) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <LayoutGrid className="h-4 w-4" /> Mize
          <Badge variant="secondary" className="ml-auto tabular-nums">{tables.length}</Badge>
        </CardTitle>
        <CardDescription className="text-xs">Status v realnem času — rezervacije so vezane na mize</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[400px] overflow-auto">
        {tables.length === 0 ? (
          <div className="p-6 text-center rounded-lg border border-dashed">
            <LayoutGrid className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Ni miz za prikaz</p>
          </div>
        ) : (
          tables.map((table, idx) => {
            const config = STATUS_CONFIG[table.status] || STATUS_CONFIG.available
            const hex = STATUS_HEX[table.status] || STATUS_HEX.available
            return (
              <div
                key={table.id}
                className="flex items-center justify-between p-3 rounded-lg border border-l-4 bg-card hover:bg-accent/40 hover:shadow-sm hover:-translate-y-px transition-all animate-fade-in-up"
                style={{ borderLeftColor: hex, animationDelay: `${Math.min(idx, 10) * 30}ms` }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="h-8 w-8 rounded-md flex items-center justify-center text-sm font-bold text-white shadow-sm"
                    style={{ backgroundColor: hex }}
                    aria-label={config.srLabel}
                  >
                    {table.number}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">Miza {table.number}</span>
                      <Badge className={config.color}>{config.label}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
                      <span className="inline-flex items-center gap-0.5"><Armchair className="h-3 w-3" /> {table.capacity} mest</span>
                      {table.guests > 0 && (
                        <span className="inline-flex items-center gap-0.5"><User className="h-3 w-3" /> {table.guests} gostov</span>
                      )}
                      {table.server && <span>· {table.server}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {table.reservation && (
                    <div className="text-right rounded-md bg-blue-50 dark:bg-blue-900/30 px-2 py-1">
                      <p className="text-xs font-medium text-blue-700 dark:text-blue-300">{table.reservation.guestName}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">{table.reservation.time} · {slCount(table.reservation.partySize, OSEBA_FORMS)}</p>
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
          })
        )}
      </CardContent>
    </Card>
  )
})
