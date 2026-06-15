'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import type { ReservationRow, TableRow } from '@/lib/types'
import { authFetch } from '@/components/pos/PinLogin'
import type { TableInfo, ReservationInfo } from './constants'

export function useTableReservationData(selectedDate: string) {
  const [tables, setTables] = useState<TableInfo[]>([])
  const [reservations, setReservations] = useState<ReservationInfo[]>([])
  const [_loading, setLoading] = useState(true)

  const loadData = async () => {
    try {
      const [tablesRes, reservationsRes] = await Promise.all([
        authFetch('/api/tables'),
        authFetch(`/api/reservations?date=${selectedDate}`),
      ])
      if (!tablesRes.ok || !reservationsRes.ok) throw new Error('Napaka pri nalaganju')
      const tablesData = await tablesRes.json()
      const reservationsData = await reservationsRes.json()
      // Združi mize z rezervacijami
      const todayReservations = (reservationsData || []).filter((r: ReservationRow) => {
        const rDate = ((r.date || r.reservationDate || '') as string).split('T')[0]
        return rDate === selectedDate
      })
      const enrichedTables: TableInfo[] = (tablesData || []).map((table: TableRow) => {
        const matchingReservation = todayReservations.find((r: ReservationRow) => {
          return r.tableId === table.id && ['confirmed', 'pending'].includes(r.status || '')
        })
        let status: TableInfo['status'] = (table.status as TableInfo['status']) || 'available'
        if ((table.currentOrderId as string | undefined) && table.status === 'occupied') {
          status = 'occupied'
        } else if (matchingReservation) {
          status = 'reserved'
        }
        return {
          id: table.id,
          number: table.number,
          capacity: (table.capacity as number) || table.seats || 4,
          status,
          currentOrderId: (table.currentOrderId as string | null) || null,
          guests: (table.guests as number) || 0,
          server: (table.server as { name?: string } | null)?.name || null,
          seatedAt: (table.seatedAt as string | null) || null,
          reservation: matchingReservation ? {
            id: matchingReservation.id,
            guestName: matchingReservation.guestName || (matchingReservation.name as string) || 'Gost',
            guestPhone: matchingReservation.guestPhone || (matchingReservation.phone as string | null) || null,
            partySize: matchingReservation.partySize || (matchingReservation.guests as number) || 2,
            date: matchingReservation.date || (matchingReservation.reservationDate as string),
            time: (matchingReservation.time as string) || '19:00',
            status: matchingReservation.status,
            notes: matchingReservation.notes || null,
            duration: (matchingReservation.duration as number) || 90,
          } : null,
        }
      })
      setTables(enrichedTables)
      setReservations(todayReservations.map((r: ReservationRow) => ({
        id: r.id,
        guestName: r.guestName || (r.name as string) || 'Gost',
        guestPhone: r.guestPhone || (r.phone as string | null) || null,
        partySize: r.partySize || (r.guests as number) || 2,
        date: r.date || (r.reservationDate as string),
        time: (r.time as string) || '19:00',
        status: r.status,
        notes: r.notes || null,
        duration: (r.duration as number) || 90,
      })))
    } catch {
      toast.error('Napaka pri nalaganju sinhronizacije')
    } finally {
      setLoading(false)
    }
  }

  return { tables, reservations, loading: _loading, loadData, setTables, setReservations }
}
