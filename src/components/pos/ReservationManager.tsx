'use client'

// ============================================
// REZERVACIJSKI SISTEM — Profesionalen upravitelj
// ============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import { Calendar, Plus, BellRing } from 'lucide-react'
import { useState, useMemo, useCallback, memo } from 'react'
import { format, addDays, isToday } from 'date-fns'
import { sl } from 'date-fns/locale'
import { toast } from 'sonner'
import dynamic from 'next/dynamic'
import { statusLabels, type ReservationType, type TableType } from './reservation/constants'
import { DateNavigation, FilterBar } from './reservation/DateNavigation'
import { REZERVACIJA_FORMS, GOST_FORMS, slCount } from '@/lib/sl-plural'

// Lazy-loaded podkomponente
const TimelineView = dynamic(() => import('./reservation/TimelineView').then(m => ({ default: m.TimelineView })), { ssr: false })
const ListView = dynamic(() => import('./reservation/ListView').then(m => ({ default: m.ListView })), { ssr: false })
// RUNDA 58: tloris pogled (geometrija miz + današnje rezervacije, "zdaj" okna)
const FloorPlanView = dynamic(() => import('./reservation/FloorPlanView').then(m => ({ default: m.FloorPlanView })), { ssr: false })
const ReservationDialog = dynamic(() => import('./reservation/ReservationDialog').then(m => ({ default: m.ReservationDialog })), { ssr: false })

export const ReservationManager = memo(function ReservationManager() {
  const queryClient = useQueryClient()
  const [selectedDate, setSelectedDate] = useState(new Date())
  // RUNDA 58: tretji pogled "tloris" — vizualna sinhr. miz in rezervacij
  const [viewMode, setViewMode] = useState<'list' | 'timeline' | 'tloris'>('timeline')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingReservation, setEditingReservation] = useState<ReservationType | null>(null)
  const [filterStatus, setFilterStatus] = useState('all')

  const dateStr = format(selectedDate, 'yyyy-MM-dd')
  // RUNDA 61: ŽIVI TLORIS — avtomatsko osveževanje (30 s rezervacije, 45 s mize).
  // refetchIntervalInBackground: false (privzeto) → pavza, ko je zavihek v ozadju;
  // dataUpdatedAt + isFetching gresta v "zadnja posodobitev" pilulo na tlorisu.
  const { data, isLoading, dataUpdatedAt, isFetching, refetch: refetchReservations } = useQuery({
    queryKey: [...queryKeys.reservations.all, dateStr],
    queryFn: async () => {
      const res = await authFetch(`/api/reservations?date=${dateStr}`)
      if (!res.ok) throw new Error('Napaka pri nalaganju')
      return res.json()
    },
    refetchInterval: 30_000,
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
    // RUNDA 61: miz se navadno ne dotika samo ta pogled (postavitev/urejevalnik,
    // hitre akcije sinhronizirajo status) → redkejši interval kot rezervacije
    refetchInterval: 45_000,
  })

  // RUNDA 61: ročna osvežitev (gumb na tlorisu) — rezervacije + mize hkrati
  const handleManualRefresh = useCallback(() => {
    void refetchReservations()
    void queryClient.invalidateQueries({ queryKey: queryKeys.tables.all })
  }, [refetchReservations, queryClient])

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
    // RUNDA 59c: tih slučaj napake — prej je neuspešen PUT ostal brez
    // povratne informacije (samo konzola); uporabnik vidi zakaj akcija
    // ni "zalegla" (tloris busy varovalka sprosti UI po 8 s).
    onError: () => {
      toast.error('Statusa ni bilo mogoče spremeniti — poskusite znova')
    },
  })

  // RUNDA 53: hitri premik časa (±30 min na kartici) — PUT dateTime.
  // 409 (miza zasedena) pokaže NATAKNO API sporočilo v toastu
  // ("Miza je že rezervirana ob tem času (Ime, čas)").
  const timeShiftMutation = useMutation({
    mutationFn: async ({ id, dateTime }: { id: string; dateTime: string }) => {
      const res = await authFetch(`/api/reservations/${id}`, { method: 'PUT', body: JSON.stringify({ dateTime }) })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}) as { error?: string })
        throw new Error(err.error || 'Napaka pri premiku rezervacije')
      }
      return res.json()
    },
    onSuccess: (_, variables) => {
      toast.success(`Rezervacija premaknjena na ${format(new Date(variables.dateTime), 'HH:mm')}`)
      queryClient.invalidateQueries({ queryKey: queryKeys.reservations.all })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // RUNDA 54: opomnik gostu — PUT reminderSent=true. Kartica pokaže
  // smaragdno značko "Opomnik poslan", KPI čip v glavi se osveži.
  const reminderMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const res = await authFetch(`/api/reservations/${id}`, { method: 'PUT', body: JSON.stringify({ reminderSent: true }) })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}) as { error?: string })
        throw new Error(err.error || 'Napaka pri pošiljanju opomnika')
      }
      return { name }
    },
    onSuccess: ({ name }) => {
      toast.success(`Opomnik za ${name} poslan`)
      queryClient.invalidateQueries({ queryKey: queryKeys.reservations.all })
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleOpenNew = useCallback(() => { setEditingReservation(null); setDialogOpen(true) }, [])
  const handleDialogClose = useCallback(() => { setDialogOpen(false); setEditingReservation(null) }, [])
  const handleEdit = useCallback((r: ReservationType) => { setEditingReservation(r); setDialogOpen(true) }, [])
  const handleStatusChange = useCallback((id: string, status: string) => { statusMutation.mutate({ id, status }) }, [statusMutation])

  // RUNDA 53: premik za ±deltaMinutes — izračun iz trenutnega dateTime v
  // selectorju (ne v komponenti kartice), izostring ISO (UTC-varno).
  const handleTimeShift = useCallback((id: string, deltaMinutes: number) => {
    const target = reservations.find(r => r.id === id)
    if (!target) return
    const next = new Date(new Date(target.dateTime).getTime() + deltaMinutes * 60000)
    timeShiftMutation.mutate({ id, dateTime: next.toISOString() })
  }, [reservations, timeShiftMutation])

  // RUNDA 54: opomnik — ime potujimo iz selectorja (toast + optimistična UI)
  const handleSendReminder = useCallback((id: string) => {
    const target = reservations.find(r => r.id === id)
    if (!target) return
    reminderMutation.mutate({ id, name: target.customerName })
  }, [reservations, reminderMutation])

  // RUNDA 54: KPI — potrjene rezervacije brez opomnika (amber čip v glavi.
  // RUNDA 57 FIX (živa QA ugotovitev): čip je pokažal TAVTOLOGIJO
  // "1 opomnik brez opomnika" (OPOMNIK_FORMS + "brez opomnika") — čip
  // šteje REZERVACIJE, torej REZERVACIJA_FORMS: "1 rezervacija brez
  // opomnika" · "2 rezervaciji brez opomnika" (dvojina) · "5 rezervacij".
  const pendingReminders = useMemo(
    () => reservations.filter(r => r.status === 'confirmed' && !r.reminderSent).length,
    [reservations],
  )

  // RUNDA 52: podnaslov SLEDI izbranemu dnevu — prej vedno "danes", tudi ko
  // je uporabnik brskal po drugih dnevih (prikaz ≡ podatki varnost);
  // sklanjanje prek sl-plural lib (1 rezervacija · 2 rezervaciji · 3
  // rezervacije · 5+ rezervacij).
  const dayLabel = isToday(selectedDate) ? 'danes' : format(selectedDate, 'EEE d. MMM', { locale: sl })

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" /> Rezervacije
          </h2>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {slCount(summary.total || 0, REZERVACIJA_FORMS)} · {slCount(summary.totalGuests || 0, GOST_FORMS)} · {dayLabel}
          </p>
          {pendingReminders > 0 && (
            <p
              className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-0.5 animate-fade-in-up"
              title="Potrjene rezervacije brez poslanega opomnika"
            >
              <BellRing className="h-3 w-3" aria-hidden="true" />
              {slCount(pendingReminders, REZERVACIJA_FORMS)} brez opomnika
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* RUNDA 58: 3-nivojski segmentni preklopnik (Seznam · Časovni trak · Tloris)
              — zamenja prejšnji 2-strojni toggle; aria-selected za screen readere */}
          <div role="tablist" aria-label="Pogled rezervacij" className="hidden sm:flex items-center rounded-md border border-border bg-muted/40 p-0.5">
            {([['list', 'Seznam'], ['timeline', 'Časovni trak'], ['tloris', 'Tloris']] as const).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={viewMode === mode}
                onClick={() => setViewMode(mode)}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  viewMode === mode
                    ? 'bg-background text-foreground shadow-sm animate-fade-in-up'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {/* Mobilni fallback: krožni preklop (segmentni je na ozkem zaslonu skrit) */}
          <Button variant="outline" size="sm" className="sm:hidden" onClick={() => setViewMode(viewMode === 'list' ? 'timeline' : viewMode === 'timeline' ? 'tloris' : 'list')} aria-label={`Pogled: ${viewMode === 'list' ? 'Seznam' : viewMode === 'timeline' ? 'Časovni trak' : 'Tloris'}`}>
            {viewMode === 'list' ? 'Časovni trak' : viewMode === 'timeline' ? 'Tloris' : 'Seznam'}
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
          <TimelineView reservations={filteredReservations} tables={tables || []} onEdit={handleEdit} onStatusChange={handleStatusChange} onTimeShift={handleTimeShift} onSendReminder={handleSendReminder} isToday={isToday(selectedDate)} />
        ) : viewMode === 'tloris' ? (
          <FloorPlanView reservations={filteredReservations} tables={tables || []} isToday={isToday(selectedDate)} onEdit={handleEdit} onStatusChange={handleStatusChange} dataUpdatedAt={dataUpdatedAt} isRefreshing={isFetching} onManualRefresh={handleManualRefresh} />
        ) : (
          <ListView reservations={filteredReservations} onEdit={handleEdit} onStatusChange={handleStatusChange} onTimeShift={handleTimeShift} onSendReminder={handleSendReminder} />
        )}
      </div>

      <ReservationDialog open={dialogOpen} onClose={handleDialogClose} reservation={editingReservation} tables={tables || []} selectedDate={selectedDate} onSave={saveMutation.mutate} />
    </div>
  )
})
