'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { ljubljanaDateTimeParts } from '@/lib/timezone-sl'
import type { TableInfo, ReservationInfo } from './constants'

// ============================================
// PODATKI ZA SINHRONIZACIJO MIZ IN REZERVACIJ
// FIX R43 (P1): stran je bila MRTVA od nastanka —
//  (1) /api/reservations vrača OVITEK { reservations: [...] }, koda je klicala
//      .filter() neposredno na objektu → TypeError → catch → stanje NIČ;
//  (2) preslikava polj je uporabljala legacy imena (date/guestName/time), API pa
//      vrača schema polja (dateTime/customerName/customerPhone) — še da je ovitek
//      odprt, bi filter vedno vrnil prazno množico;
//  (3) datum rezervacije se ZDAJ računa po ljubljanskem koledarju (dateTime je
//      UTC ISO — 19:00 UTC = naslednji dan po 01:00 CET!);
//  (4) loadData z useCallback — prej na vsakem renderu nov Identity → useEffect
//      s [loadData] odpravil interval in ponovno polnil (fetch churn vsak render).
// ============================================

/** Oblika rezervacije iz API-ja (Prisma Reservation + legacy fallbacki) */
interface ApiReservation {
  id: string
  customerName?: string
  customerPhone?: string | null
  dateTime?: string
  partySize?: number
  duration?: number
  tableId?: string | null
  status?: string
  notes?: string | null
  specialRequests?: string | null
  // legacy/alternativne oblike (starejši odjemalci, testa)
  date?: string
  reservationDate?: string
  time?: string
  guestName?: string
  name?: string
  guestPhone?: string
  phone?: string | null
  guests?: number
}

/** Oblika mize iz /api/tables */
interface ApiTable {
  id: string
  number: number
  capacity?: number
  seats?: number
  status?: string
  orders?: { id?: string }[]
  currentOrderId?: string | null
  guests?: number
  server?: { name?: string } | null
  seatedAt?: string | null
}

/** ISO UTC čas → { ljubljanski datum 'YYYY-MM-DD', čas 'HH:mm' } (skupni helper timezone-sl) */
function ljDateTimeParts(iso: string | undefined | null) {
  return ljubljanaDateTimeParts(iso)
}

/** API rezervacija → notranja ReservationInfo oblika */
function mapReservation(r: ApiReservation): ReservationInfo {
  const { date, time } = ljDateTimeParts(r.dateTime || r.date || r.reservationDate)
  return {
    id: r.id,
    guestName: r.customerName || r.guestName || r.name || 'Gost',
    guestPhone: r.customerPhone || r.guestPhone || r.phone || null,
    partySize: r.partySize || r.guests || 2,
    date,
    time: r.time || time || '19:00',
    status: (r.status as ReservationInfo['status']) || 'confirmed',
    notes: r.notes || r.specialRequests || null,
    duration: r.duration || 90,
    tableId: r.tableId || null,
  }
}

export function useTableReservationData(selectedDate: string) {
  const [tables, setTables] = useState<TableInfo[]>([])
  const [reservations, setReservations] = useState<ReservationInfo[]>([])
  const [_loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      const [tablesRes, reservationsRes] = await Promise.all([
        authFetch('/api/tables'),
        authFetch(`/api/reservations?date=${selectedDate}`),
      ])
      if (!tablesRes.ok || !reservationsRes.ok) throw new Error('Napaka pri nalaganju')
      const tablesData: ApiTable[] = await tablesRes.json()
      const reservationsJson: unknown = await reservationsRes.json()
      // FIX R43: ovitek { reservations: [...] } ALI gol array — oba podprta
      const reservationsList: ApiReservation[] = Array.isArray(reservationsJson)
        ? reservationsJson
        : ((reservationsJson as { reservations?: ApiReservation[]; data?: ApiReservation[] })?.reservations
          || (reservationsJson as { data?: ApiReservation[] })?.data
          || [])
      // FIX R43: primerjaj LJUB LJANSKI koledarski datum rezervacije z izbranim datumom
      const todayReservations = reservationsList
        .map(mapReservation)
        .filter(r => r.date === selectedDate && r.status !== 'cancelled')

      const enrichedTables: TableInfo[] = (tablesData || []).map((table: ApiTable) => {
        const matchingReservation = todayReservations.find(r =>
          r.tableId === table.id && ['confirmed', 'pending'].includes(r.status || '')
        )
        let status: TableInfo['status'] = (table.status as TableInfo['status']) || 'available'
        // DB status je avtoriteta; samo PROSTO mizo lahko rezervacija povzdigne v 'reserved'
        if (status === 'available' && matchingReservation) status = 'reserved'
        return {
          id: table.id,
          number: table.number,
          capacity: table.capacity || table.seats || 4,
          status,
          currentOrderId: table.currentOrderId || (table.orders?.length ? table.orders[0]?.id || null : null),
          guests: table.guests || 0,
          server: table.server?.name || null,
          seatedAt: table.seatedAt || null,
          reservation: matchingReservation ? { ...matchingReservation } : null,
        }
      })
      setTables(enrichedTables)
      setReservations(todayReservations)
    } catch {
      toast.error('Napaka pri nalaganju sinhronizacije')
    } finally {
      setLoading(false)
    }
  }, [selectedDate])

  return { tables, reservations, loading: _loading, loadData, setTables, setReservations }
}
