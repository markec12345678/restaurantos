'use client'

import dynamic from 'next/dynamic'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Javna stran za rezervacije (/reserve)
// Stranke lahko rezervirajo mize online
// - Izbira datuma, ure in števila oseb
// - Pregled razpoložljivih terminov
// - Potrditev z e-pošto/SMS
// - Večjezična podpora
// ═══════════════════════════════════════════════════════════════

import { useReservation } from './useReservation'

// Lazy-load podkomponente
const SuccessView = dynamic(() => import('./components/SuccessView').then(m => ({ default: m.SuccessView })), { ssr: false })
const ErrorView = dynamic(() => import('./components/ErrorView').then(m => ({ default: m.ErrorView })), { ssr: false })
const ReserveHeader = dynamic(() => import('./components/ReserveHeader').then(m => ({ default: m.ReserveHeader })), { ssr: false })
const StepIndicator = dynamic(() => import('./components/StepIndicator').then(m => ({ default: m.StepIndicator })), { ssr: false })
const DateTimeSection = dynamic(() => import('./components/DateTimeSection').then(m => ({ default: m.DateTimeSection })), { ssr: false })
const CustomerFormSection = dynamic(() => import('./components/CustomerFormSection').then(m => ({ default: m.CustomerFormSection })), { ssr: false })
const ConfirmView = dynamic(() => import('./components/ConfirmView').then(m => ({ default: m.ConfirmView })), { ssr: false })

// ─── Glavna stran ──────────────────────────────────────────────
export default function ReservePage() {
  const {
    step,
    setStep,
    selectedDate,
    setSelectedDate,
    selectedTime,
    setSelectedTime,
    partySize,
    setPartySize,
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
    loading,
    restaurantInfo,
    availableSlots,
    slotsLoading,
    isValid,
    navigateDate,
    handleSubmit,
  } = useReservation()

  // ─── SUCCESS ───────────────────────────────────────────────
  if (step === 'success') {
    return (
      <SuccessView
        customerName={customerName}
        selectedDate={selectedDate}
        selectedTime={selectedTime}
        partySize={partySize}
        customerEmail={customerEmail}
      />
    )
  }

  // ─── ERROR ─────────────────────────────────────────────────
  if (step === 'error') {
    return <ErrorView onRetry={() => setStep('details')} />
  }

  // ─── GLAVNI OBRAZEC ────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      {/* Header */}
      <ReserveHeader restaurantInfo={restaurantInfo} />

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Koraki */}
        <StepIndicator step={step} />

        {step === 'details' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Levo: Izbira datuma in časa */}
            <DateTimeSection
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              selectedTime={selectedTime}
              setSelectedTime={setSelectedTime}
              partySize={partySize}
              setPartySize={setPartySize}
              availableSlots={availableSlots}
              slotsLoading={slotsLoading}
              navigateDate={navigateDate}
            />

            {/* Desno: Podatki stranke */}
            <CustomerFormSection
              customerName={customerName}
              setCustomerName={setCustomerName}
              customerPhone={customerPhone}
              setCustomerPhone={setCustomerPhone}
              customerEmail={customerEmail}
              setCustomerEmail={setCustomerEmail}
              specialRequests={specialRequests}
              setSpecialRequests={setSpecialRequests}
              notes={notes}
              setNotes={setNotes}
              selectedDate={selectedDate}
              selectedTime={selectedTime}
              partySize={partySize}
              isValid={isValid}
              onContinue={() => { if (isValid) setStep('confirm') }}
            />
          </div>
        ) : step === 'confirm' ? (
          /* ═══ POTRDITEV ═══ */
          <ConfirmView
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            partySize={partySize}
            customerName={customerName}
            customerPhone={customerPhone}
            customerEmail={customerEmail}
            specialRequests={specialRequests}
            loading={loading}
            onBack={() => setStep('details')}
            onConfirm={handleSubmit}
          />
        ) : null}
      </div>
    </div>
  )
}
