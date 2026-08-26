'use client'

import { memo } from 'react'
import { Clock, Loader2 } from 'lucide-react'
import type { ReservationSlot } from '../types'

interface TimeSlotGridProps {
  availableSlots: ReservationSlot[]
  selectedTime: string
  setSelectedTime: (_time: string) => void
  slotsLoading: boolean
}

export const TimeSlotGrid = memo(function TimeSlotGrid({
  availableSlots,
  selectedTime,
  setSelectedTime,
  slotsLoading,
}: TimeSlotGridProps) {
  return (
    <div className="bg-white dark:bg-card rounded-2xl shadow-lg p-6">
      <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
        <Clock className="h-5 w-5 text-primary" /> Izberite termin
      </h2>
      {slotsLoading ? (
        <div className="flex items-center justify-center h-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : availableSlots.length === 0 ? (
        <p className="text-center text-muted-foreground py-6">Na ta dan smo žal zaprti.</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {/* Kosilo */}
          {availableSlots.filter(s => s.time < '15:00').length > 0 && (
            <>
              <div className="col-span-full text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Kosilo</div>
              {availableSlots.filter(s => s.time < '15:00').map(slot => (
                <button
                  key={slot.time}
                  disabled={!slot.available}
                  onClick={() => setSelectedTime(slot.time)}
                  className={`py-2.5 rounded-xl text-sm font-bold transition-all ${
                    selectedTime === slot.time
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : slot.available
                        ? 'bg-muted hover:bg-muted/80'
                        : 'bg-muted/50 text-muted-foreground line-through cursor-not-allowed'
                  }`}
                >
                  {slot.time}
                </button>
              ))}
            </>
          )}
          {/* Večerja */}
          {availableSlots.filter(s => s.time >= '15:00').length > 0 && (
            <>
              <div className="col-span-full text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 mt-3">Večerja</div>
              {availableSlots.filter(s => s.time >= '15:00').map(slot => (
                <button
                  key={slot.time}
                  disabled={!slot.available}
                  onClick={() => setSelectedTime(slot.time)}
                  className={`py-2.5 rounded-xl text-sm font-bold transition-all ${
                    selectedTime === slot.time
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : slot.available
                        ? 'bg-muted hover:bg-muted/80'
                        : 'bg-muted/50 text-muted-foreground line-through cursor-not-allowed'
                  }`}
                >
                  {slot.time}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
})
