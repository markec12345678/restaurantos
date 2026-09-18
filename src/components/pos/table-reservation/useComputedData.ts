'use client'

import { useMemo } from 'react'
import type { TableInfo, ReservationInfo, TimeSlot } from './constants'

// ============================================
// IZRAČUNI: Gručenje po območju, statistika
// FIX R43: zasedenost po urah upošteva TRAJANJE rezervacije (prej samo točen
// začetni slot — 19:00 / 120 min je pokrival 19:00–21:00, graf pa je kazal samo 19:00);
// zasedene mize se ne štejejo dvakrat (rezervirana miza z dodeljeno rezervacijo
// pokrije svoj slot, neposedana rezervacija brez mize pa zmanjša kapaciteto).
// ============================================

/** 'HH:mm' → minute od polnoči */
function minutesOf(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export function useComputedData(tables: TableInfo[], reservations: ReservationInfo[]) {
  return useMemo(() => {
    const totalTables = tables.length
    const occupiedCount = tables.filter(t => t.status === 'occupied').length
    // Rezervacije, ki so že VEZANE na mizo — miza je 'reserved' in se šteje
    // prek tabele, ne prek rezervacije (brez dvojnega odštevanja)
    const reservedTableIds = new Set(
      tables.filter(t => t.status === 'reserved' && t.reservation).map(t => t.reservation!.id)
    )
    // Ne-posedane rezervacije (brez mize) — zmanjšajo kapaciteto v svojem oknu
    const unseated = reservations.filter(r =>
      !r.tableId && !reservedTableIds.has(r.id) && ['confirmed', 'pending', 'seated'].includes(r.status)
    )

    const slots: TimeSlot[] = []
    for (let hour = 11; hour <= 22; hour++) {
      for (const min of ['00', '30']) {
        const time = `${hour}:${min}`
        const slotStart = minutesOf(time)
        const slotEnd = slotStart + 30
        const activeUnseated = unseated.filter(r => {
          const start = minutesOf(r.time)
          const end = start + (r.duration || 90)
          return start < slotEnd && slotStart < end // prekrivanje intervalov
        }).length
        // Rezervirane mize z rezervacijo, ki je AKTIVNA v tem slotu
        const reservedActive = tables.filter(t => {
          if (t.status !== 'reserved' || !t.reservation) return false
          const start = minutesOf(t.reservation.time)
          const end = start + (t.reservation.duration || 90)
          return start < slotEnd && slotStart < end
        }).length
        const unavailable = occupiedCount + reservedActive + activeUnseated
        slots.push({
          time,
          available: Math.max(0, totalTables - unavailable),
          total: totalTables,
          reservations: reservedActive + activeUnseated,
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
