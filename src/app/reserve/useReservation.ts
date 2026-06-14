'use client'

import { useState, useEffect } from 'react'
import { format, addDays, isBefore, startOfDay } from 'date-fns'
import type { ReservationSlot, RestaurantInfo, ReservationStep } from './types'
import { DAY_NAMES, TIME_SLOTS } from './constants'

// =====================================================================
// HOOK: Stanje in logika javne strani za rezervacije
// =====================================================================

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
  const [restaurantInfo, setRestaurantInfo] = useState<RestaurantInfo | null>(null)
  const [availableSlots, setAvailableSlots] = useState<ReservationSlot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)

  // Pridobi podatke restavracije
  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        if (data?.settings) {
          setRestaurantInfo({
            name: data.settings.restaurantName || 'RestaurantOS',
            address: data.settings.address || '',
            phone: data.settings.phone || '',
            logo: data.settings.logo || '',
            openingHours: data.settings.openingHours || {},
          })
        }
      })
      .catch(() => {})
  }, [])

  // Pridobi razpoložljive termin ob spremembi datuma/velikosti
  useEffect(() => {
    const fetchSlots = async () => {
      setSlotsLoading(true)
      try {
        const dateStr = format(selectedDate, 'yyyy-MM-dd')
        const res = await fetch(`/api/reservations?date=${dateStr}&partySize=${partySize}&checkAvailability=true`)
        const data = await res.json()

        if (data?.availableSlots) {
          setAvailableSlots(data.availableSlots)
        } else {
          // Izračunaj na podlagi odpiralnih časov
          const dayName = DAY_NAMES[selectedDate.getDay()].toLowerCase()
          const hours = restaurantInfo?.openingHours?.[dayName]
          if (hours) {
            const slots = TIME_SLOTS.filter(t => t >= hours.open && t <= hours.close).map(t => ({
              time: t,
              available: true,
              tablesAvailable: 3,
            }))
            setAvailableSlots(slots)
          } else {
            // Privzeto za vsak dan
            setAvailableSlots(
              TIME_SLOTS.map(t => ({ time: t, available: true, tablesAvailable: 2 }))
            )
          }
        }
      } catch {
        // Fallback - vsi termini na voljo
        setAvailableSlots(TIME_SLOTS.map(t => ({ time: t, available: true, tablesAvailable: 2 })))
      }
      setSlotsLoading(false)
    }
    fetchSlots()
  }, [selectedDate, partySize, restaurantInfo])

  // Datum navigacija
  const navigateDate = (dir: number) => {
    const newDate = addDays(selectedDate, dir)
    if (!isBefore(newDate, startOfDay(new Date()))) {
      setSelectedDate(newDate)
      setSelectedTime('')
    }
  }

  // Veljavnost obrazca
  const isValid = !!(selectedDate && selectedTime && partySize && customerName && customerPhone)

  // Pošlji rezervacijo
  const handleSubmit = async () => {
    if (!isValid) return
    setLoading(true)
    try {
      const dateTime = new Date(`${format(selectedDate, 'yyyy-MM-dd')}T${selectedTime}:00`)
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          customerPhone,
          customerEmail,
          dateTime: dateTime.toISOString(),
          partySize,
          duration: 120,
          notes,
          specialRequests,
          source: 'website',
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
    // Stanje
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
    // Izpeljano
    isValid,
    // Akcije
    navigateDate,
    handleSubmit,
  }
}
