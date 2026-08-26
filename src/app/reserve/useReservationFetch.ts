'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import type { ReservationSlot, RestaurantInfo } from './types'
import { DAY_NAMES, TIME_SLOTS } from './constants'

export function useReservationFetch(selectedDate: Date, partySize: number) {
  const [availableSlots, setAvailableSlots] = useState<ReservationSlot[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [fetchedRestaurantInfo, setFetchedRestaurantInfo] = useState<RestaurantInfo | null>(null)

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(data => {
        if (data?.settings) {
          const info: RestaurantInfo = {
            name: data.settings.restaurantName || 'RestaurantOS',
            address: data.settings.address || '',
            phone: data.settings.phone || '',
            logo: data.settings.logo || '',
            openingHours: data.settings.openingHours || {},
          }
          setFetchedRestaurantInfo(info)
        }
      })
      .catch(() => {})
  }, [])

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
          const dayName = DAY_NAMES[selectedDate.getDay()].toLowerCase()
          const hours = fetchedRestaurantInfo?.openingHours?.[dayName]
          if (hours) {
            const slots = TIME_SLOTS.filter(t => t >= hours.open && t <= hours.close).map(t => ({
              time: t, available: true, tablesAvailable: 3,
            }))
            setAvailableSlots(slots)
          } else {
            setAvailableSlots(TIME_SLOTS.map(t => ({ time: t, available: true, tablesAvailable: 2 })))
          }
        }
      } catch {
        setAvailableSlots(TIME_SLOTS.map(t => ({ time: t, available: true, tablesAvailable: 2 })))
      }
      setSlotsLoading(false)
    }
    fetchSlots()
  }, [selectedDate, partySize, fetchedRestaurantInfo])

  return { availableSlots, slotsLoading, fetchedRestaurantInfo }
}
