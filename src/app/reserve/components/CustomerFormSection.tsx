'use client'

import { memo } from 'react'
import { format } from 'date-fns'
import { sl } from 'date-fns/locale'
import { Phone, Calendar, Clock, Users, Star } from 'lucide-react'

// =====================================================================
// Podatki stranke, posebne želje in povzetek rezervacije
// =====================================================================

interface CustomerFormSectionProps {
  customerName: string
  setCustomerName: (_name: string) => void
  customerPhone: string
  setCustomerPhone: (_phone: string) => void
  customerEmail: string
  setCustomerEmail: (_email: string) => void
  specialRequests: string
  setSpecialRequests: (_requests: string) => void
  notes: string
  setNotes: (_notes: string) => void
  selectedDate: Date
  selectedTime: string
  partySize: number
  isValid: boolean
  onContinue: () => void
  errors?: Partial<Record<'customerName' | 'customerPhone' | 'customerEmail' | 'partySize' | 'specialRequests' | 'notes', string>>
  touched?: Record<string, boolean>
}

export const CustomerFormSection = memo(function CustomerFormSection({
  customerName,
  setCustomerName,
  customerPhone,
  setCustomerPhone,
  customerEmail,
  setCustomerEmail,
  specialRequests,
  setSpecialRequests,
  notes,
  setNotes,
  selectedDate,
  selectedTime,
  partySize,
  isValid,
  onContinue,
  errors = {},
  touched = {},
}: CustomerFormSectionProps) {
  // Prikaži error samo če je bilo polje touched (uporabnik je vpisoval ali poskusil submit)
  const showError = (field: keyof typeof errors) => touched[field] && errors[field]

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-card rounded-2xl shadow-lg p-6">
        <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
          <Phone className="h-5 w-5 text-primary" /> Vaši podatki
        </h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="reserve-name" className="text-sm font-medium flex items-center gap-1">
              Ime in priimek <span className="text-red-500">*</span>
            </label>
            <input
              id="reserve-name"
              type="text"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              placeholder="Janez Novak"
              aria-invalid={!!showError('customerName')}
              aria-describedby={showError('customerName') ? 'reserve-name-error' : undefined}
              className={`w-full mt-1 px-4 py-3 rounded-xl border-2 focus:outline-none bg-background text-sm ${showError('customerName') ? 'border-red-500 focus:border-red-500' : 'focus:border-primary'}`}
            />
            {showError('customerName') && (
              <p id="reserve-name-error" role="alert" className="text-xs text-red-500 mt-1">{errors.customerName}</p>
            )}
          </div>
          <div>
            <label htmlFor="reserve-phone" className="text-sm font-medium flex items-center gap-1">
              Telefon <span className="text-red-500">*</span>
            </label>
            <input
              id="reserve-phone"
              type="tel"
              value={customerPhone}
              onChange={e => setCustomerPhone(e.target.value)}
              placeholder="+386 40 123 456"
              inputMode="tel"
              autoComplete="tel"
              aria-invalid={!!showError('customerPhone')}
              aria-describedby={showError('customerPhone') ? 'reserve-phone-error' : undefined}
              className={`w-full mt-1 px-4 py-3 rounded-xl border-2 focus:outline-none bg-background text-sm ${showError('customerPhone') ? 'border-red-500 focus:border-red-500' : 'focus:border-primary'}`}
            />
            {showError('customerPhone') && (
              <p id="reserve-phone-error" role="alert" className="text-xs text-red-500 mt-1">{errors.customerPhone}</p>
            )}
          </div>
          <div>
            <label htmlFor="reserve-email" className="text-sm font-medium">E-pošta</label>
            <input
              id="reserve-email"
              type="email"
              value={customerEmail}
              onChange={e => setCustomerEmail(e.target.value)}
              placeholder="janez@email.si"
              inputMode="email"
              autoComplete="email"
              aria-invalid={!!showError('customerEmail')}
              aria-describedby={showError('customerEmail') ? 'reserve-email-error' : undefined}
              className={`w-full mt-1 px-4 py-3 rounded-xl border-2 focus:outline-none bg-background text-sm ${showError('customerEmail') ? 'border-red-500 focus:border-red-500' : 'focus:border-primary'}`}
            />
            {showError('customerEmail') && (
              <p id="reserve-email-error" role="alert" className="text-xs text-red-500 mt-1">{errors.customerEmail}</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-card rounded-2xl shadow-lg p-6">
        <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
          <Star className="h-5 w-5 text-primary" /> Posebne želje
        </h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="reserve-requests" className="text-sm font-medium">Posebne želje</label>
            <textarea
              id="reserve-requests"
              value={specialRequests}
              onChange={e => setSpecialRequests(e.target.value)}
              placeholder="Otroški stol, ob oknu, rojstnodnevna torta, alergije..."
              className="w-full mt-1 px-4 py-3 rounded-xl border-2 focus:border-primary focus:outline-none bg-background text-sm min-h-20 resize-none"
            />
          </div>
          <div>
            <label htmlFor="reserve-notes" className="text-sm font-medium">Opombe</label>
            <textarea
              id="reserve-notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Dodatne informacije..."
              className="w-full mt-1 px-4 py-3 rounded-xl border-2 focus:border-primary focus:outline-none bg-background text-sm min-h-16 resize-none"
            />
          </div>
        </div>
      </div>

      {/* Povzetek */}
      <div className="bg-primary/5 dark:bg-primary/10 rounded-2xl p-6 border-2 border-primary/20">
        <h3 className="font-bold mb-3">Povzetek rezervacije</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <span>{format(selectedDate, 'EEEE, d. MMMM yyyy', { locale: sl })}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <span>{selectedTime || 'Izberite termin'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <span>{partySize} {partySize === 1 ? 'oseba' : partySize <= 4 ? 'osebe' : 'oseb'}</span>
          </div>
        </div>
        <button
          onClick={onContinue}
          disabled={!isValid}
          className="w-full mt-4 py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-base hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          Nadaljuj na potrditev
        </button>
      </div>
    </div>
  )
})
