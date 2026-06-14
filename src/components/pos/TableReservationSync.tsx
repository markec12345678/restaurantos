'use client'
import { useState, useEffect, useCallback, useMemo, memo } from 'react'
import { toast } from 'sonner'
import type { ReservationRow, TableRow } from '@/lib/types'
import { authFetch } from '@/components/pos/PinLogin'
import dynamic from 'next/dynamic'
import type { TableInfo, ReservationInfo, TimeSlot } from './table-reservation/constants'

// Lazy-loaded podkomponente
const SyncHeader = dynamic(() => import('./table-reservation/SyncHeader').then(m => ({ default: m.SyncHeader })), { ssr: false })
const SummaryCards = dynamic(() => import('./table-reservation/SummaryCards').then(m => ({ default: m.SummaryCards })), { ssr: false })
const TablesList = dynamic(() => import('./table-reservation/TablesList').then(m => ({ default: m.TablesList })), { ssr: false })
const ReservationsList = dynamic(() => import('./table-reservation/ReservationsList').then(m => ({ default: m.ReservationsList })), { ssr: false })
const TimeSlotChart = dynamic(() => import('./table-reservation/TimeSlotChart').then(m => ({ default: m.TimeSlotChart })), { ssr: false })
const CancelReservationDialog = dynamic(() => import('./table-reservation/CancelReservationDialog').then(m => ({ default: m.CancelReservationDialog })), { ssr: false })

export const TableReservationSync = memo(function TableReservationSync() {
  const [tables, setTables] = useState<TableInfo[]>([])
  const [reservations, setReservations] = useState<ReservationInfo[]>([])
  const [_loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [_dragAssign, _setDragAssign] = useState<string | null>(null)
  const [cancelTarget, setCancelTarget] = useState<{ id: string; name: string } | null>(null)
  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 15000) // Osveži vsakih 15s
    return () => clearInterval(interval)
  }, [selectedDate])
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
  const handleSeatReservation = useCallback(async (reservationId: string, tableId: string) => {
    try {
      await authFetch(`/api/reservations/${reservationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'seated', tableId }),
      })
      await loadData()
    } catch {
      toast.error('Napaka pri posedanju rezervacije')
    }
  }, [loadData])
  const handleCancelReservation = useCallback(async (reservationId: string) => {
    try {
      await authFetch(`/api/reservations/${reservationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      })
      await loadData()
    } catch {
      toast.error('Napaka pri preklicu rezervacije')
    }
  }, [loadData])
  const _handleCompleteReservation = useCallback(async (_reservationId: string) => {
    try {
      await authFetch(`/api/reservations/${_reservationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      })
      await loadData()
    } catch {
      toast.error('Napaka pri zaključevanju rezervacije')
    }
  }, [loadData])
  // Memoizirani izračuni časovnih rež in števcev — ne računaj na vsakem renderju
  const computedData = useMemo(() => {
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

  const handleCancelClick = (id: string, name: string) => {
    setCancelTarget({ id, name })
  }

  return (
    <div className="p-4 space-y-4 h-full overflow-auto">
      <SyncHeader
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        onRefresh={loadData}
      />

      {/* Povzetek */}
      <SummaryCards
        availableCount={computedData.availableTables.length}
        occupiedCount={computedData.occupiedTables.length}
        reservedCount={computedData.reservedTables.length}
        pendingCount={computedData.pendingReservations.length}
      />

      <div className="grid grid-cols-2 gap-4">
        {/* Mize z rezervacijami */}
        <TablesList
          tables={tables}
          onSeatReservation={handleSeatReservation}
        />

        {/* Čakajoče rezervacije */}
        <ReservationsList
          reservations={computedData.pendingReservations}
          availableTables={computedData.availableTables}
          onSeatReservation={handleSeatReservation}
          onCancelReservation={handleCancelClick}
        />
      </div>

      {/* Časovna razdelitev */}
      <TimeSlotChart timeSlots={computedData.timeSlots} />

      {/* FIX A11Y: AlertDialog namesto window.confirm() */}
      <CancelReservationDialog
        cancelTarget={cancelTarget}
        onOpenChange={(open) => { if (!open) setCancelTarget(null) }}
        onConfirm={() => {
          if (cancelTarget?.id) handleCancelReservation(cancelTarget.id)
          setCancelTarget(null)
        }}
      />
    </div>
  )
})
