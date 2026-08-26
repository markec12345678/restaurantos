'use client'

import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Clock, Users, Timer, BookOpen, ArrowRight, XCircle, CheckCircle } from 'lucide-react'
import { RESERVATION_STATUS_CONFIG } from './constants'
import type { ReservationsListProps } from './constants'

// ============================================
// ČAKAJOČE REZERVACIJE
// ============================================
export const ReservationsList = memo(function ReservationsList({
  reservations,
  availableTables,
  onSeatReservation,
  onCancelReservation,
}: ReservationsListProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <BookOpen className="h-4 w-4" /> Rezervacije
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[400px] overflow-auto">
        {reservations.length === 0 ? (
          <div className="p-6 text-center">
            <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Vse rezervacije so urejene</p>
          </div>
        ) : (
          reservations.map(res => {
            const resConfig = RESERVATION_STATUS_CONFIG[res.status as keyof typeof RESERVATION_STATUS_CONFIG]
            const matchingAvailableTable = availableTables.find(t => t.capacity >= res.partySize)
            return (
              <div key={res.id} className="p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{res.guestName}</span>
                      <Badge className={resConfig?.color || ''}>{resConfig?.label || res.status}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {res.time}</span>
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {res.partySize} oseb</span>
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
                <div className="flex gap-2">
                  {matchingAvailableTable && (
                    <Button size="sm" onClick={() => onSeatReservation(res.id, matchingAvailableTable.id)} aria-label={`Sedi mizo ${matchingAvailableTable.number}`}>
                      <ArrowRight className="h-3 w-3 mr-1" /> Sedi mizo {matchingAvailableTable.number}
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => onCancelReservation(res.id, res.guestName || 'Rezervacija')} aria-label={`Prekliči rezervacijo za ${res.guestName}`}>
                    <XCircle className="h-3 w-3 mr-1" /> Prekliči
                  </Button>
                </div>
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
})
