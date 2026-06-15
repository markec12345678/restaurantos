'use client'
import { useState, useEffect, useCallback, memo } from 'react'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import dynamic from 'next/dynamic'
import { useTableReservationData } from './table-reservation/useTableReservationData'
import { useComputedData } from './table-reservation/useComputedData'

// Lazy-loaded podkomponente
const SyncHeader = dynamic(() => import('./table-reservation/SyncHeader').then(m => ({ default: m.SyncHeader })), { ssr: false })
const SummaryCards = dynamic(() => import('./table-reservation/SummaryCards').then(m => ({ default: m.SummaryCards })), { ssr: false })
const TablesList = dynamic(() => import('./table-reservation/TablesList').then(m => ({ default: m.TablesList })), { ssr: false })
const ReservationsList = dynamic(() => import('./table-reservation/ReservationsList').then(m => ({ default: m.ReservationsList })), { ssr: false })
const TimeSlotChart = dynamic(() => import('./table-reservation/TimeSlotChart').then(m => ({ default: m.TimeSlotChart })), { ssr: false })
const CancelReservationDialog = dynamic(() => import('./table-reservation/CancelReservationDialog').then(m => ({ default: m.CancelReservationDialog })), { ssr: false })

export const TableReservationSync = memo(function TableReservationSync() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [_dragAssign, _setDragAssign] = useState<string | null>(null)
  const [cancelTarget, setCancelTarget] = useState<{ id: string; name: string } | null>(null)

  const { tables, reservations, loadData } = useTableReservationData(selectedDate)
  const computedData = useComputedData(tables, reservations)

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 15000) // Osveži vsakih 15s
    return () => clearInterval(interval)
  }, [selectedDate, loadData])

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

  const handleCancelClick = (id: string, name: string) => {
    setCancelTarget({ id, name })
  }

  return (
    <div className="p-4 space-y-4 h-full overflow-auto">
      <SyncHeader selectedDate={selectedDate} onDateChange={setSelectedDate} onRefresh={loadData} />
      <SummaryCards
        availableCount={computedData.availableTables.length}
        occupiedCount={computedData.occupiedTables.length}
        reservedCount={computedData.reservedTables.length}
        pendingCount={computedData.pendingReservations.length}
      />
      <div className="grid grid-cols-2 gap-4">
        <TablesList tables={tables} onSeatReservation={handleSeatReservation} />
        <ReservationsList reservations={computedData.pendingReservations} availableTables={computedData.availableTables} onSeatReservation={handleSeatReservation} onCancelReservation={handleCancelClick} />
      </div>
      <TimeSlotChart timeSlots={computedData.timeSlots} />
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
