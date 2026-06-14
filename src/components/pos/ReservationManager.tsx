'use client'

// ============================================
// REZERVACIJSKI SISTEM — Profesionalen upravitelj
// Toast POS + TouchBistro standard
// Koledar, časovni intervali, dodelitev mize, spominki
// ============================================

import dynamic from 'next/dynamic'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { Calendar, Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState, useMemo, useCallback, memo } from 'react'
import { format, addDays, isToday } from 'date-fns'
import { sl } from 'date-fns/locale'
import { toast } from 'sonner'
import { statusLabels } from './reservation/constants'
import type { ReservationType } from './reservation/constants'

// ============================================
// LAZY LOADING POD-KOMPONENT
// ============================================
const TimelineView = dynamic(
  () => import('./reservation/TimelineView').then(m => m.TimelineView),
  { ssr: false }
)

const ListView = dynamic(
  () => import('./reservation/ListView').then(m => m.ListView),
  { ssr: false }
)

const ReservationDialog = dynamic(
  () => import('./reservation/ReservationDialog').then(m => m.ReservationDialog),
  { ssr: false }
)

// ============================================
// GLAVNA KOMPONENTA
// ============================================
export const ReservationManager = memo(function ReservationManager() {
  const queryClient = useQueryClient()
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('timeline')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingReservation, setEditingReservation] = useState<ReservationType | null>(null)
  const [filterStatus, setFilterStatus] = useState('all')

  // Podatki
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

  const { data: tables } = useQuery({
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

  // Navigacija po datumih
  const navigateDate = useCallback((dir: number) => setSelectedDate(prev => addDays(prev, dir)), [])
  const goToToday = useCallback(() => setSelectedDate(new Date()), [])

  // Ustvari/uredi mutacija
  const saveMutation = useMutation({
    mutationFn: async (formData: Record<string, unknown>) => {
      if (editingReservation) {
        const res = await authFetch(`/api/reservations/${editingReservation.id}`, {
          method: 'PUT',
          body: JSON.stringify(formData),
        })
        if (!res.ok) throw new Error('Napaka pri posodabljanju')
        return res.json()
      } else {
        const res = await authFetch('/api/reservations', {
          method: 'POST',
          body: JSON.stringify(formData),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Napaka pri ustvarjanju')
        }
        return res.json()
      }
    },
    onSuccess: () => {
      toast.success(editingReservation ? 'Rezervacija posodobljena' : 'Rezervacija ustvarjena')
      queryClient.invalidateQueries({ queryKey: queryKeys.reservations.all })
      setDialogOpen(false)
      setEditingReservation(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // Status mutacija
  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await authFetch(`/api/reservations/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Napaka')
      return res.json()
    },
    onSuccess: (_, variables) => {
      toast.success(`Status spremenjen: ${statusLabels[variables.status]}`)
      queryClient.invalidateQueries({ queryKey: queryKeys.reservations.all })
    },
  })

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Rezervacije
          </h2>
          <p className="text-xs text-muted-foreground">
            {summary.total || 0} rezervacij · {summary.totalGuests || 0} gostov danes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setViewMode(viewMode === 'list' ? 'timeline' : 'list')}>
            {viewMode === 'list' ? 'Časovni trak' : 'Seznam'}
          </Button>
          <Button size="sm" onClick={() => { setEditingReservation(null); setDialogOpen(true) }}>
            <Plus className="h-4 w-4 mr-1" /> Nova rezervacija
          </Button>
        </div>
      </div>

      {/* Datum navigacija + filtri */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-muted/30 flex-shrink-0">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" aria-label="Nazaj" className="h-8 w-8" onClick={() => navigateDate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant={isToday(selectedDate) ? 'default' : 'outline'} size="sm" onClick={goToToday} className="min-w-32">
            <Calendar className="h-3.5 w-3.5 mr-1.5" />
            {isToday(selectedDate) ? 'Danes' : format(selectedDate, 'EEE d. MMM', { locale: sl })}
          </Button>
          <Button variant="outline" size="icon" aria-label="Naprej" className="h-8 w-8" onClick={() => navigateDate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Input
            type="date"
            value={dateStr}
            onChange={e => setSelectedDate(new Date(e.target.value))}
            className="w-36 h-8 text-xs"
          />
        </div>
        <div className="flex gap-1 ml-4">
          {['all', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show'].map(status => (
            <Button
              key={status}
              variant={filterStatus === status ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-[10px] px-2"
              onClick={() => setFilterStatus(status)}
            >
              {status === 'all' ? 'Vse' : statusLabels[status]}
              {status !== 'all' && (
                <Badge variant="secondary" className="ml-1 text-[9px] h-4 px-1">
                  {reservations.filter(r => r.status === status).length}
                </Badge>
              )}
            </Button>
          ))}
        </div>
      </div>

      {/* Vsebina */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
          </div>
        ) : viewMode === 'timeline' ? (
          <TimelineView
            reservations={filteredReservations}
            tables={tables || []}
            onEdit={(r) => { setEditingReservation(r); setDialogOpen(true) }}
            onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
          />
        ) : (
          <ListView
            reservations={filteredReservations}
            onEdit={(r) => { setEditingReservation(r); setDialogOpen(true) }}
            onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
          />
        )}
      </div>

      {/* Dialog za novo/uredi rezervacijo */}
      <ReservationDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditingReservation(null) }}
        reservation={editingReservation}
        tables={tables || []}
        selectedDate={selectedDate}
        onSave={saveMutation.mutate}
      />
    </div>
  )
})
