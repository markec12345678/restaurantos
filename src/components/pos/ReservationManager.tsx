'use client'

// ============================================
// REZERVACIJSKI SISTEM — Profesionalen upravitelj
// ============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { Calendar, Plus } from 'lucide-react'
import { useState, useMemo, useCallback, memo } from 'react'
import { format, addDays } from 'date-fns'
import { toast } from 'sonner'
import dynamic from 'next/dynamic'
import { statusLabels, type ReservationType, type TableType } from './reservation/constants'
import { DateNavigation, FilterBar } from './reservation/DateNavigation'

// Lazy-loaded podkomponente
const TimelineView = dynamic(() => import('./reservation/TimelineView').then(m => ({ default: m.TimelineView })), { ssr: false })
const ListView = dynamic(() => import('./reservation/ListView').then(m => ({ default: m.ListView })), { ssr: false })
const ReservationDialog = dynamic(() => import('./reservation/ReservationDialog').then(m => ({ default: m.ReservationDialog })), { ssr: false })

export const ReservationManager = memo(function ReservationManager() {
  const queryClient = useQueryClient()
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('timeline')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingReservation, setEditingReservation] = useState<ReservationType | null>(null)
  const [filterStatus, setFilterStatus] = useState('all')

  const dateStr = format(selectedDate, 'yyyy-MM-dd')
  const { data, isLoading } = useQuery({
    queryKey: [...queryKeys.reservations.all, dateStr],
    queryFn: async () => {
      const res = await authFetch(`/api/reservations?date=${dateStr}`)
      if (!res.ok) throw new Error('Napaka pri nalaganju')
      return res.json()
    },
  })

  const { data: _upcomingData } = useQuery({
    queryKey: ['reservations-upcoming'],
    queryFn: async () => {
      const res = await authFetch('/api/reservations?upcoming=true')
      if (!res.ok) throw new Error('Napaka pri nalaganju')
      return res.json()
    },
  })

  const { data: tables } = useQuery<TableType[]>({
    queryKey: queryKeys.tables.all,
    queryFn: async () => {
      const res = await authFetch('/api/tables')
      if (!res.ok) throw new Error('Napaka pri nalaganju')
      return res.json()
    },
  })

  const reservations: ReservationType[] = data?.reservations || []
  const filteredReservations = useMemo(() => filterStatus === 'all'
    ? reservations
    : reservations.filter(r => r.status === filterStatus), [reservations, filterStatus])
  const summary = data?.summary || {}

  const navigateDate = useCallback((dir: number) => setSelectedDate(prev => addDays(prev, dir)), [])
  const goToToday = useCallback(() => setSelectedDate(new Date()), [])
  const handleDateInput = useCallback((val: string) => setSelectedDate(new Date(val)), [])

  const saveMutation = useMutation({
    mutationFn: async (formData: Record<string, unknown>) => {
      if (editingReservation) {
        const res = await authFetch(`/api/reservations/${editingReservation.id}`, {
          method: 'PUT', body: JSON.stringify(formData),
        })
        if (!res.ok) throw new Error('Napaka pri posodabljanju')
        return res.json()
      } else {
        const res = await authFetch('/api/reservations', {
          method: 'POST', body: JSON.stringify(formData),
        })
        if (!res.ok) { const err = await res.json(); throw new Error(err.error || 'Napaka pri ustvarjanju') }
        return res.json()
      }
    },
    onSuccess: () => {
      toast.success(editingReservation ? 'Rezervacija posodobljena' : 'Rezervacija ustvarjena')
      queryClient.invalidateQueries({ queryKey: queryKeys.reservations.all })
      setDialogOpen(false); setEditingReservation(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await authFetch(`/api/reservations/${id}`, { method: 'PUT', body: JSON.stringify({ status }) })
      if (!res.ok) throw new Error('Napaka')
      return res.json()
    },
    onSuccess: (_, variables) => {
      toast.success(`Status spremenjen: ${statusLabels[variables.status]}`)
      queryClient.invalidateQueries({ queryKey: queryKeys.reservations.all })
    },
  })

  const handleOpenNew = useCallback(() => { setEditingReservation(null); setDialogOpen(true) }, [])
  const handleDialogClose = useCallback(() => { setDialogOpen(false); setEditingReservation(null) }, [])
  const handleEdit = useCallback((r: ReservationType) => { setEditingReservation(r); setDialogOpen(true) }, [])
  const handleStatusChange = useCallback((id: string, status: string) => { statusMutation.mutate({ id, status }) }, [statusMutation])

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" /> Rezervacije
          </h2>
          <p className="text-xs text-muted-foreground">{summary.total || 0} rezervacij · {summary.totalGuests || 0} gostov danes</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setViewMode(viewMode === 'list' ? 'timeline' : 'list')}>
            {viewMode === 'list' ? 'Časovni trak' : 'Seznam'}
          </Button>
          <Button size="sm" onClick={handleOpenNew}><Plus className="h-4 w-4 mr-1" /> Nova rezervacija</Button>
        </div>
      </div>

      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-muted/30 flex-shrink-0">
        <DateNavigation selectedDate={selectedDate} dateStr={dateStr} onNavigate={navigateDate} onGoToToday={goToToday} onDateInput={handleDateInput} />
        <FilterBar filterStatus={filterStatus} onFilterChange={setFilterStatus} reservations={reservations} />
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {isLoading ? (
          <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}</div>
        ) : viewMode === 'timeline' ? (
          <TimelineView reservations={filteredReservations} tables={tables || []} onEdit={handleEdit} onStatusChange={handleStatusChange} />
        ) : (
          <ListView reservations={filteredReservations} onEdit={handleEdit} onStatusChange={handleStatusChange} />
        )}
      </div>

      <ReservationDialog open={dialogOpen} onClose={handleDialogClose} reservation={editingReservation} tables={tables || []} selectedDate={selectedDate} onSave={saveMutation.mutate} />
    </div>
  )
})
