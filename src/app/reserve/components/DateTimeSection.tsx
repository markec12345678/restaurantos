'use client'

import { memo } from 'react'
import dynamic from 'next/dynamic'
import { format, addDays, isSameDay, isToday, isBefore, startOfDay } from 'date-fns'
import { sl } from 'date-fns/locale'
import { Calendar, ChevronLeft, ChevronRight, Users, AlertCircle } from 'lucide-react'
import type { ReservationSlot } from '../types'
import { PARTY_SIZES } from '../constants'

const TimeSlotGrid = dynamic(() => import('./TimeSlotGrid').then(m => ({ default: m.TimeSlotGrid })), { ssr: false })

// =====================================================================
// Izbira datuma, števila oseb in časovnega termina
// =====================================================================

interface DateTimeSectionProps {
  selectedDate: Date
  setSelectedDate: (_date: Date) => void
  selectedTime: string
  setSelectedTime: (_time: string) => void
  partySize: number
  setPartySize: (_size: number) => void
  availableSlots: ReservationSlot[]
  slotsLoading: boolean
  navigateDate: (_dir: number) => void
}

export const DateTimeSection = memo(function DateTimeSection({
  selectedDate,
  setSelectedDate,
  selectedTime,
  setSelectedTime,
  partySize,
  setPartySize,
  availableSlots,
  slotsLoading,
  navigateDate,
}: DateTimeSectionProps) {
  return (
    <div className="space-y-4">
      {/* Datum */}
      <div className="bg-white dark:bg-card rounded-2xl shadow-lg p-6">
        <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" /> Izberite datum
        </h2>
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigateDate(-1)} className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors" aria-label="Prejšnji dan">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 text-center">
            <p className="font-bold text-lg">{format(selectedDate, 'EEEE', { locale: sl })}</p>
            <p className="text-muted-foreground">{format(selectedDate, 'd. MMMM yyyy', { locale: sl })}</p>
          </div>
          <button onClick={() => navigateDate(1)} className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors" aria-label="Naslednji dan">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        {/* Hitri izbiri datuma */}
        <div className="flex gap-2 flex-wrap">
          {[0, 1, 2, 3, 4, 5, 6, 7].map(offset => {
            const date = addDays(new Date(), offset)
            if (isBefore(date, startOfDay(new Date())) && offset === 0) return null
            return (
              <button
                key={offset}
                onClick={() => { setSelectedDate(date); setSelectedTime('') }}
                className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                  isSameDay(date, selectedDate)
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : isToday(date)
                      ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400'
                      : 'bg-muted hover:bg-muted/80'
                }`}
              >
                <div>{format(date, 'EEE', { locale: sl })}</div>
                <div className="font-bold text-sm">{format(date, 'd')}</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Število oseb */}
      <div className="bg-white dark:bg-card rounded-2xl shadow-lg p-6">
        <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" /> Število oseb
        </h2>
        <div className="grid grid-cols-6 gap-2">
          {PARTY_SIZES.map(size => (
            <button
              key={size}
              onClick={() => setPartySize(size)}
              className={`py-2.5 rounded-xl text-sm font-bold transition-all ${
                partySize === size
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              {size}
            </button>
          ))}
        </div>
        {partySize > 8 && (
          <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> Za večje skupine vas prosimo, da nas kontaktirate telefon.
          </p>
        )}
      </div>

      {/* Časovni termini */}
      <TimeSlotGrid
        availableSlots={availableSlots}
        selectedTime={selectedTime}
        setSelectedTime={setSelectedTime}
        slotsLoading={slotsLoading}
      />
    </div>
  )
})
