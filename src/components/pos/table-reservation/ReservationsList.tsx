'use client'

import { memo, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Clock, Users, Timer, BookOpen, ArrowRight, XCircle, CheckCircle, Armchair } from 'lucide-react'
import { RESERVATION_STATUS_CONFIG } from './constants'
import type { ReservationsListProps, TableInfo } from './constants'
import { slCount, OSEBA_FORMS } from '@/lib/sl-plural'

/** Barva leve obrobe per status rezervacije (vizualna kodiranje brez regex čaranja) */
const STATUS_ACCENT: Record<string, string> = {
  confirmed: '#10b981',
  pending: '#f59e0b',
  seated: '#3b82f6',
  completed: '#6b7280',
  cancelled: '#ef4444',
}

// ============================================
// ČAKAJOČE REZERVACIJE
// FIX/FEATURE R43: izbira MIZE pred posedanjem — prej je systom samodejno
// izbral PRVO razpoložljivo mizo (tudi 8-mestno za 2 osebi!). Zdaj:
//  — privzeto NAJBOLJŠA prilagoditev (najmanjša miza, ki sprejme družbo)
//  — <select> z vsemi primernimi prostimi mizami (kapaciteta ≥ št. oseb)
//  — rezervacije z že dodeljeno mizo prikažejo mizo kot chip
// STIL R43: barvna leva obroba po statusu, ikonski čipi, tabular-nums uri,
// hover dvig kartice, skrčljiv seznam (>4 = "Še N …").
// ============================================

/** Najboljša miza: najmanjša kapaciteta, ki še sprejme partySize */
function bestFit(tables: TableInfo[], partySize: number): TableInfo | undefined {
  return tables
    .filter(t => t.status === 'available' && t.capacity >= partySize)
    .sort((a, b) => a.capacity - b.capacity)[0]
}

export const ReservationsList = memo(function ReservationsList({
  reservations,
  availableTables,
  onSeatReservation,
  onCancelReservation,
}: ReservationsListProps) {
  const [expanded, setExpanded] = useState(false)
  // Izbrana miza per rezervacija (id → tableId); privzeto best-fit
  const [manualPick, setManualPick] = useState<Record<string, string>>({})

  const visible = expanded ? reservations : reservations.slice(0, 4)

  const fitting = useMemo(() => {
    const map: Record<string, TableInfo[]> = {}
    for (const res of reservations) {
      map[res.id] = availableTables
        .filter(t => t.status === 'available' && t.capacity >= res.partySize)
        .sort((a, b) => a.capacity - b.capacity)
    }
    return map
  }, [reservations, availableTables])

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <BookOpen className="h-4 w-4" /> Rezervacije
          {reservations.length > 0 && (
            <Badge variant="secondary" className="ml-auto tabular-nums">{reservations.length}</Badge>
          )}
        </CardTitle>
        <CardDescription className="text-xs">Posedaj goste na proste mize — izberi najbolj primerno</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[400px] overflow-auto">
        {reservations.length === 0 ? (
          <div className="p-6 text-center rounded-lg border border-dashed">
            <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Vse rezervacije so urejene</p>
          </div>
        ) : (
          <>
            {visible.map(res => {
              const resConfig = RESERVATION_STATUS_CONFIG[res.status as keyof typeof RESERVATION_STATUS_CONFIG]
              const options = fitting[res.id] || []
              const pickedId = manualPick[res.id] || res.tableId || bestFit(availableTables, res.partySize)?.id
              const picked = options.find(t => t.id === pickedId) || availableTables.find(t => t.id === pickedId)
              const assignedButElsewhere = res.tableId && !options.some(t => t.id === res.tableId)
              return (
                <div
                  key={res.id}
                  className={`p-3 rounded-lg border bg-card hover:bg-accent/40 hover:shadow-sm hover:-translate-y-px transition-all border-l-4`}
                  style={{ borderLeftColor: STATUS_ACCENT[res.status] || '#6b7280' }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{res.guestName}</span>
                        <Badge className={resConfig?.color || ''}>{resConfig?.label || res.status}</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 tabular-nums">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {res.time}</span>
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {slCount(res.partySize, OSEBA_FORMS)}</span>
                        <span className="flex items-center gap-1"><Timer className="h-3 w-3" /> {res.duration} min</span>
                      </div>
                      {res.guestPhone && (
                        <p className="text-xs text-muted-foreground mt-1">{res.guestPhone}</p>
                      )}
                      {res.notes && (
                        <p className="text-xs text-muted-foreground mt-1 italic">&quot;{res.notes}&quot;</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {res.tableId && !assignedButElsewhere ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium rounded-md bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-1">
                        <Armchair className="h-3 w-3" /> Miza že dodeljena
                      </span>
                    ) : options.length > 0 ? (
                      <select
                        aria-label={`Izberi mizo za ${res.guestName}`}
                        value={pickedId || ''}
                        onChange={e => setManualPick(m => ({ ...m, [res.id]: e.target.value }))}
                        className="text-xs rounded-md border bg-background px-2 py-1.5 max-w-[170px] cursor-pointer focus:ring-2 focus:ring-primary/40 outline-none"
                      >
                        {options.map(t => (
                          <option key={t.id} value={t.id}>
                            Miza {t.number} · {t.capacity} mest
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-muted-foreground">Ni proste mize s kapaciteto {res.partySize}+</span>
                    )}
                    {picked && res.status !== 'seated' && (
                      <Button size="sm" onClick={() => onSeatReservation(res.id, picked.id)} aria-label={`Sedi mizo ${picked.number}`}>
                        <ArrowRight className="h-3 w-3 mr-1" /> Sedi mizo {picked.number}
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => onCancelReservation(res.id, res.guestName || 'Rezervacija')} aria-label={`Prekliči rezervacijo za ${res.guestName}`}>
                      <XCircle className="h-3 w-3 mr-1" /> Prekliči
                    </Button>
                  </div>
                </div>
              )
            })}
            {reservations.length > 4 && (
              <button
                type="button"
                onClick={() => setExpanded(x => !x)}
                className="w-full text-xs text-muted-foreground hover:text-foreground py-1.5 rounded-md border border-dashed hover:bg-accent/40 transition-colors"
              >
                {expanded ? 'Prikaži manj' : `Še ${reservations.length - 4} rezervacij …`}
              </button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
})
