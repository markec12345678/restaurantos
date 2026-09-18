'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { ljubljanaTodayStr, ljubljanaDateTimeParts } from '@/lib/timezone-sl'
import { type FloorTable } from '../constants'

// ============================================
// QUERIES: Podatki o mizah za tloris
// FEATURE R43: SINHRONIZACIJA TLORIS ↔ REZERVACIJE — do zdaj tloris NIKOLI
// ni pokazal statusa 'reserved' (DB statusi so samo available/occupied/blocked,
// torej je reservedCount v glavi bil VEDNO 0). Zdaj pobere današnje rezervacije
// (LJ datum!) in mizo z dodeljeno aktivno rezervacijo (tableId) povzdigne v
// 'reserved' + prikaže gostota/uro/kapaciteto na kartici mize.
// ============================================

/** Oblika rezervacije iz /api/reservations (podmnožina polj) */
interface FloorPlanReservation {
  id: string
  customerName?: string
  dateTime?: string
  partySize?: number
  tableId?: string | null
  status?: string
}

export function useFloorPlanQueries() {
  const today = ljubljanaTodayStr()

  const tablesQuery = useQuery<FloorTable[]>({
    queryKey: queryKeys.tables.all,
    queryFn: async () => {
      const res = await authFetch('/api/tables')
      if (!res.ok) return []
      const json = await res.json()
      return Array.isArray(json) ? json : (json.tables ?? [])
    },
  })

  const reservationsQuery = useQuery<FloorPlanReservation[]>({
    queryKey: [...queryKeys.reservations.all, 'floorplan', today],
    queryFn: async () => {
      const res = await authFetch(`/api/reservations?date=${today}`)
      if (!res.ok) return []
      const json = await res.json()
      // Ovitek { reservations: [...] } ALI gol array (ista lekcija kot sync stran)
      return Array.isArray(json) ? json : (json?.reservations ?? [])
    },
    refetchInterval: 30000,
    staleTime: 15000,
  })

  const tables = useMemo<FloorTable[]>(() => {
    const raw = tablesQuery.data
    if (!raw) return []
    const active = (reservationsQuery.data || []).filter(
      (r) => ['confirmed', 'pending'].includes(r.status || '') && r.tableId
    )
    if (active.length === 0) return raw
    return raw.map((t) => {
      if (t.status !== 'available') return t // DB status je avtoriteta (occupied/blocked)
      const res = active.find((r) => r.tableId === t.id)
      if (!res) return t
      const { time } = ljubljanaDateTimeParts(res.dateTime)
      return {
        ...t,
        status: 'reserved',
        reservation: {
          guestName: res.customerName || 'Gost',
          time: time || '',
          partySize: res.partySize || 2,
        },
      }
    })
  }, [tablesQuery.data, reservationsQuery.data])

  return { tables, isLoading: tablesQuery.isLoading }
}
