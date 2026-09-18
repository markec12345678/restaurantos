'use client'

// ============================================
// ČASOVNI POGLED — Timeline
// ============================================
// RUNDA 52: "zdaj" indikator — ob današnjem dnevu je najbližji časovni
// slot označen z amber ringom + pulzirajočo piko "zdaj" (orientacija:
// kam se glede na sedanjost umestijo prihajajoče rezervacije).

import { memo, useMemo } from 'react'
import { format } from 'date-fns'
import { Calendar } from 'lucide-react'
import { timeSlots } from './constants'
import type { TimelineViewProps, ReservationType } from './constants'
import { ReservationCard } from './ReservationCard'
import { closestTimeSlot } from '@/lib/reservation-timeline'

export const TimelineView = memo(function TimelineView({
  reservations,
  tables: _tables,
  onEdit,
  onStatusChange,
  isToday = false,
}: TimelineViewProps & { isToday?: boolean }) {
  // Najbližji slot sedanjosti (samo ob današnjem dnevu — "zdaj" oznaka).
  // RUNDA 52 reconciliacija: closestTimeSlot (PRAVA minutna razdalja iz
  // reservation-timeline.ts) namesto začasnega localeCompare približka.
  const nowSlot = useMemo(() => {
    if (!isToday) return null
    return closestTimeSlot(format(new Date(), 'HH:mm'), timeSlots)
  }, [isToday])
  // Grupiraj po časovnih intervalih
  // RUNDA 52 FIX (reservation-timeline.ts): prej localeCompare —
  // leksikografska razdalja NI časovna (15:00 je padla v slot '14:00'
  // namesto '14:30'). Zdaj prava minutna razdalja.
  const groupedByTime = useMemo(() => {
    const groups: Record<string, ReservationType[]> = {}
    timeSlots.forEach(slot => { groups[slot] = [] })
    reservations.forEach(r => {
      const time = format(new Date(r.dateTime), 'HH:mm')
      const closestSlot = closestTimeSlot(time, timeSlots) ?? time
      if (groups[closestSlot]) {
        groups[closestSlot].push(r)
      } else {
        groups[time] = [r]
      }
    })
    return groups
  }, [reservations])

  if (reservations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
        <Calendar className="h-12 w-12 opacity-20" />
        <p className="text-sm font-medium">Ni rezervacij za ta dan</p>
        <p className="text-xs">Ustvarite novo rezervacijo z gumbom zgoraj</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {timeSlots.map(slot => {
        const slotReservations = groupedByTime[slot]
        if (slotReservations.length === 0 && slot !== nowSlot) return null
        const isNow = slot === nowSlot

        return (
          <div key={slot} className={`flex gap-3 ${isNow ? 'animate-fade-in-up' : ''}`}>
            <div className="w-14 flex-shrink-0 pt-2">
              <span
                className={`text-sm font-mono font-bold tabular-nums rounded-md px-1.5 py-0.5 inline-flex items-center gap-1 ${
                  isNow
                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 ring-1 ring-amber-500/50'
                    : 'text-muted-foreground bg-muted/60'
                }`}
              >
                {slot}
                {isNow && (
                  <span className="relative flex h-1.5 w-1.5" aria-hidden="true">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-60" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
                  </span>
                )}
              </span>
              {isNow && (
                <span className="sr-only">trenutni časovni okvir</span>
              )}
            </div>
            <div className="flex-1 space-y-2">
              {isNow && slotReservations.length === 0 && (
                <p className="text-xs italic text-muted-foreground/70 pt-2">— zdaj brez rezervacij —</p>
              )}
              {slotReservations.map((r, idx) => (
                <ReservationCard
                  key={r.id}
                  reservation={r}
                  index={idx}
                  onEdit={() => onEdit(r)}
                  onStatusChange={onStatusChange}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
})
