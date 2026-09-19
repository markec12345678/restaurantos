'use client'

// ============================================
// ČASOVNI POGLED — Timeline
// ============================================
// RUNDA 52: "zdaj" indikator — ob današnjem dnevu je najbližji časovni
// slot označen z amber ringom + pulzirajočo piko "zdaj" (orientacija:
// kam se glede na sedanjost umestijo prihajajoče rezervacije).
// RUNDA 54: vizualni pass — (1) navpišna črtkana tirnica pod slot
// oznako (timeline metafora: sloti so postaje, kartice dogodki),
// (2) števec kartic na zasedenih slotih (≥2 → hitro prepoznavanje
// prometnih ur brez branja kartic), (3) prepust onSendReminder.
// RUNDA 55: drag-to-reschedule — potrjeno kartico povlečeš na drug
// slot (HTML5 DnD, nativni ghost); ciljni slot dobi modri prstan,
// spuščanje izračuna delta (hmDelta) in pokliče onTimeShift (isti
// PUT + 409 konflikt tok kot ±30 gumbi). Tipkovnica ima ±30 gumbi
// in dialog — drag je napredna miškina/trackpad pot.

import { memo, useMemo, useState, useCallback } from 'react'
import { format } from 'date-fns'
import { Calendar } from 'lucide-react'
import { timeSlots } from './constants'
import type { TimelineViewProps, ReservationType } from './constants'
import { ReservationCard } from './ReservationCard'
import { closestTimeSlot, hmDelta } from '@/lib/reservation-timeline'

export const TimelineView = memo(function TimelineView({
  reservations,
  tables: _tables,
  onEdit,
  onStatusChange,
  onTimeShift,
  onSendReminder,
  isToday = false,
}: TimelineViewProps & { isToday?: boolean }) {
  // Najbližji slot sedanjosti (samo ob današnjem dnevu — "zdaj" oznaka).
  // RUNDA 52 reconciliacija: closestTimeSlot (PRAVA minutna razdalja iz
  // reservation-timeline.ts) namesto začasnega localeCompare približka.
  const nowSlot = useMemo(() => {
    if (!isToday) return null
    return closestTimeSlot(format(new Date(), 'HH:mm'), timeSlots)
  }, [isToday])

  // RUNDA 55: drag stanje — katera kartica se vleče (dimming) + kateri
  // slot je aktivni drop target (modri prstan).
  const [dragging, setDragging] = useState<{ id: string; time: string } | null>(null)
  const [hoverSlot, setHoverSlot] = useState<string | null>(null)
  const handleDragStarted = useCallback((id: string, time: string) => {
    setDragging({ id, time })
  }, [])
  const handleDragEnded = useCallback(() => {
    setDragging(null)
    setHoverSlot(null)
  }, [])
  const handleDrop = useCallback((slot: string) => {
    if (!dragging) return
    const delta = hmDelta(dragging.time, slot)
    if (delta !== null && delta !== 0) onTimeShift?.(dragging.id, delta)
    setDragging(null)
    setHoverSlot(null)
  }, [dragging, onTimeShift])
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
        // RUNDA 55: ta slot je aktivni drop target (modri prstan + tint)
        const isDropTarget = dragging !== null && hoverSlot === slot

        return (
          <div key={slot} className={`flex gap-3 relative ${isNow ? 'animate-fade-in-up' : ''}`}>
            {/* RUNDA 54: črtkana tirnica — poveže slot oznake (timeline metafora) */}
            <div
              aria-hidden="true"
              className="absolute left-7 top-9 bottom-0 w-px border-l border-dashed border-border/50"
            />
            <div className="w-14 flex-shrink-0 pt-2 relative">
              <span
                className={`text-sm font-mono font-bold tabular-nums rounded-md px-1.5 py-0.5 inline-flex items-center gap-1 ${
                  isNow
                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 ring-1 ring-amber-500/50'
                    : isDropTarget
                      ? 'bg-blue-500/15 text-blue-700 dark:text-blue-400 ring-1 ring-blue-500/60'
                      : slotReservations.length >= 2
                        ? 'text-foreground bg-muted ring-1 ring-border/60'
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
              {/* RUNDA 54: števec na prometnih slotih (≥2 kartici) */}
              {slotReservations.length >= 2 && (
                <span
                  className={`mt-1 inline-flex min-w-5 justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums ${
                    isNow
                      ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {slotReservations.length}
                </span>
              )}
            </div>
            <div
              className={`flex-1 space-y-2 rounded-lg transition-all duration-150 ${
                isDropTarget ? 'ring-2 ring-blue-500/60 bg-blue-500/5 ring-offset-1' : ''
              }`}
              onDragOver={(e) => {
                if (!dragging) return
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
                setHoverSlot(slot)
              }}
              onDragLeave={() => { if (hoverSlot === slot) setHoverSlot(null) }}
              onDrop={(e) => {
                e.preventDefault()
                handleDrop(slot)
              }}
            >
              {isNow && slotReservations.length === 0 && (
                <p className="text-xs italic text-muted-foreground/70 pt-2">— zdaj brez rezervacij —</p>
              )}
              {/* RUNDA 55: drop namig na praznem ciljnem slotu */}
              {isDropTarget && slotReservations.length === 0 && (
                <div className="h-14 rounded-md border-2 border-dashed border-blue-500/50 bg-blue-500/5 flex items-center justify-center text-[11px] font-medium text-blue-600 dark:text-blue-400 animate-fade-in-up">
                  Spusti za premik na {slot}
                </div>
              )}
              {slotReservations.map((r, idx) => (
                <ReservationCard
                  key={r.id}
                  reservation={r}
                  index={idx}
                  onEdit={() => onEdit(r)}
                  onStatusChange={onStatusChange}
                  onTimeShift={onTimeShift}
                  onSendReminder={onSendReminder}
                  dragEnabled={r.status === 'confirmed'}
                  isDragging={dragging?.id === r.id}
                  onDragStarted={handleDragStarted}
                  onDragEnded={handleDragEnded}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
})
