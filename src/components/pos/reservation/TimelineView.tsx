'use client'

// ============================================
// ČASOVNI POGLED — Timeline
// ============================================

import { memo, useMemo } from 'react'
import { format } from 'date-fns'
import { Calendar } from 'lucide-react'
import { timeSlots } from './constants'
import type { TimelineViewProps, ReservationType } from './constants'
import { ReservationCard } from './ReservationCard'

export const TimelineView = memo(function TimelineView({
  reservations,
  tables: _tables,
  onEdit,
  onStatusChange,
}: TimelineViewProps) {
  // Grupiraj po časovnih intervalih
  const groupedByTime = useMemo(() => {
    const groups: Record<string, ReservationType[]> = {}
    timeSlots.forEach(slot => { groups[slot] = [] })
    reservations.forEach(r => {
      const time = format(new Date(r.dateTime), 'HH:mm')
      // Najdi najbližji časovni interval
      const closestSlot = timeSlots.reduce((prev, curr) =>
        Math.abs(curr.localeCompare(time)) < Math.abs(prev.localeCompare(time)) ? curr : prev
      )
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
        if (slotReservations.length === 0) return null

        return (
          <div key={slot} className="flex gap-3">
            <div className="w-14 flex-shrink-0 pt-2">
              <span className="text-sm font-mono font-bold text-muted-foreground">{slot}</span>
            </div>
            <div className="flex-1 space-y-2">
              {slotReservations.map(r => (
                <ReservationCard
                  key={r.id}
                  reservation={r}
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
