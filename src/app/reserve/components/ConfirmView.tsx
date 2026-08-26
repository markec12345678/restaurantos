'use client'

import { memo } from 'react'
import { format } from 'date-fns'
import { sl } from 'date-fns/locale'
import { Calendar, Clock, Users, Phone, Mail, Star, Loader2 } from 'lucide-react'

// =====================================================================
// Potrditev rezervacije
// =====================================================================

interface ConfirmViewProps {
  selectedDate: Date
  selectedTime: string
  partySize: number
  customerName: string
  customerPhone: string
  customerEmail: string
  specialRequests: string
  loading: boolean
  onBack: () => void
  onConfirm: () => void
}

export const ConfirmView = memo(function ConfirmView({
  selectedDate,
  selectedTime,
  partySize,
  customerName,
  customerPhone,
  customerEmail,
  specialRequests,
  loading,
  onBack,
  onConfirm,
}: ConfirmViewProps) {
  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-white dark:bg-card rounded-2xl shadow-2xl p-8">
        <h2 className="font-bold text-xl mb-6 text-center">Potrditev rezervacije</h2>
        <div className="bg-primary/5 rounded-xl p-5 space-y-3 mb-6">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Datum</p>
              <p className="font-bold">{format(selectedDate, 'EEEE, d. MMMM yyyy', { locale: sl })}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Ura</p>
              <p className="font-bold">{selectedTime}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Število oseb</p>
              <p className="font-bold">{partySize} {partySize === 1 ? 'oseba' : partySize <= 4 ? 'osebe' : 'oseb'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Phone className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Ime in telefon</p>
              <p className="font-bold">{customerName} · {customerPhone}</p>
            </div>
          </div>
          {customerEmail && (
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">E-pošta</p>
                <p className="font-bold">{customerEmail}</p>
              </div>
            </div>
          )}
          {specialRequests && (
            <div className="flex items-center gap-3">
              <Star className="h-5 w-5 text-amber-500" />
              <div>
                <p className="text-xs text-muted-foreground">Posebne želje</p>
                <p className="font-bold">{specialRequests}</p>
              </div>
            </div>
          )}
        </div>
        <div className="flex gap-3">
          <button onClick={onBack} className="flex-1 py-3 rounded-xl border-2 font-bold hover:bg-muted transition-colors">
            Nazaj
          </button>
          <button onClick={onConfirm} disabled={loading} className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Pošiljam...' : 'Potrdi rezervacijo'}
          </button>
        </div>
      </div>
    </div>
  )
})
