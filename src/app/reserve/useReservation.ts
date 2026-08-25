'use client'

import { useState, useMemo } from 'react'
import { format, addDays, isBefore, startOfDay } from 'date-fns'
import type { ReservationStep } from './types'
import { useReservationFetch } from './useReservationFetch'
import { validateReservationForm } from './validation'

export function useReservation() {
  const [step, setStep] = useState<ReservationStep>('details')
  const [selectedDate, setSelectedDate] = useState(addDays(new Date(), 1))
  const [selectedTime, setSelectedTime] = useState('')
  const [partySize, setPartySize] = useState(2)
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [specialRequests, setSpecialRequests] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [_reservationId, setReservationId] = useState('')
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const { availableSlots, slotsLoading, fetchedRestaurantInfo: restaurantInfo } = useReservationFetch(selectedDate, partySize)

  const navigateDate = (dir: number) => {
    const newDate = addDays(selectedDate, dir)
    if (!isBefore(newDate, startOfDay(new Date()))) {
      setSelectedDate(newDate)
      setSelectedTime('')
    }
  }

  // FIX: prejšnja koda je uporabljala goli `isValid = !!(... && ...)` brez
  // preverjanja formata. Sedaj z Zod shemo dobimo konkretne errorje za UI.
  const errors = useMemo(() => validateReservationForm({
    customerName, customerPhone, customerEmail, partySize, specialRequests, notes,
  }), [customerName, customerPhone, customerEmail, partySize, specialRequests, notes])

  const isValid = !!(selectedDate && selectedTime && partySize && Object.keys(errors).length === 0)

  const markTouched = (field: string) => setTouched(prev => ({ ...prev, [field]: true }))

  const handleSubmit = async () => {
    // Označi vsa polja kot touched, da se prikažejo errorji
    setTouched({ customerName: true, customerPhone: true, customerEmail: true, partySize: true })
    if (!isValid || !selectedTime) return
    setLoading(true)
    try {
      const dateTime = new Date(`${format(selectedDate, 'yyyy-MM-dd')}T${selectedTime}:00`)
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName, customerPhone, customerEmail,
          dateTime: dateTime.toISOString(), partySize,
          duration: 120, notes, specialRequests, source: 'website',
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Napaka pri ustvarjanju rezervacije')
      }
      const data = await res.json()
      setReservationId(data.reservation?.id || data.id || '')
      setStep('success')
    } catch {
      setStep('error')
    }
    setLoading(false)
  }

  return {
    step, setStep, selectedDate, setSelectedDate, selectedTime, setSelectedTime,
    partySize, setPartySize, customerName, setCustomerName, customerPhone, setCustomerPhone,
    customerEmail, setCustomerEmail, specialRequests, setSpecialRequests, notes, setNotes,
    loading, restaurantInfo, availableSlots, slotsLoading, isValid, navigateDate, handleSubmit,
    errors, touched, markTouched,
  }
}
