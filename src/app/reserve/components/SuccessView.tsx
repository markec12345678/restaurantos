'use client'

import { memo } from 'react'
import { format } from 'date-fns'
import { sl } from 'date-fns/locale'
import { Calendar, Clock, Users, Mail, CheckCircle2 } from 'lucide-react'

// =====================================================================
// Prikaz uspešne rezervacije
// =====================================================================

interface SuccessViewProps {
  customerName: string
  selectedDate: Date
  selectedTime: string
  partySize: number
  customerEmail: string
}

export const SuccessView = memo(function SuccessView({
  customerName,
  selectedDate,
  selectedTime,
  partySize,
  customerEmail,
}: SuccessViewProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-card rounded-2xl shadow-2xl p-8 text-center">
        <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 mx-auto mb-4 flex items-center justify-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-600" />
        </div>
        <h2 className="text-2xl font-bold text-emerald-800 dark:text-emerald-400 mb-2">Rezervacija potrjena!</h2>
        <p className="text-muted-foreground mb-4">Hvala, {customerName}! Vaša rezervacija je bila uspešno ustvarjena.</p>
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 mb-4 text-left space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-emerald-600" />
            <span>{format(selectedDate, 'EEEE, d. MMMM yyyy', { locale: sl })}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-emerald-600" />
            <span>{selectedTime}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-emerald-600" />
            <span>{partySize} {partySize === 1 ? 'oseba' : partySize <= 4 ? 'osebe' : 'oseb'}</span>
          </div>
          {customerEmail && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-emerald-600" />
              <span>Potrdilo poslano na {customerEmail}</span>
            </div>
          )}
        </div>
        <button onClick={() => window.location.reload()} className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 transition-colors">
          Nova rezervacija
        </button>
      </div>
    </div>
  )
})
