'use client'

import { useMemo } from 'react'
import type { TableInfo, ReservationInfo, TimeSlot } from './constants'

export function useComputedData(tables: TableInfo[], reservations: ReservationInfo[]) {
  return useMemo(() => {
    const slots: TimeSlot[] = []
    const totalTables = tables.length
    for (let hour = 11; hour <= 22; hour++) {
      for (const min of ['00', '30']) {
        const time = `${hour}:${min}`
        const matchingReservations = reservations.filter(r => r.time === time)
        const available = totalTables - matchingReservations.length - tables.filter(t => t.status === 'occupied').length
        slots.push({
          time,
          available: Math.max(0, available),
          total: totalTables,
          reservations: matchingReservations.length,
        })
      }
    }
    return {
      timeSlots: slots,
      availableTables: tables.filter(t => t.status === 'available'),
      occupiedTables: tables.filter(t => t.status === 'occupied'),
      reservedTables: tables.filter(t => t.status === 'reserved'),
      pendingReservations: reservations.filter(r => r.status === 'pending' || r.status === 'confirmed'),
    }
  }, [tables, reservations])
}
