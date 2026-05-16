'use client'

// ============================================
// REZERVACIJSKI SISTEM — Profesionalen upravitelj
// Toast POS + TouchBistro standard
// Koledar, časovni intervali, dodelitev mize, spominki
// ============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { authFetch } from '@/components/pos/PinLogin'
import {
  Calendar, Clock, Users, Phone, Mail, MapPin, Plus, Check,
  X, ChevronLeft, ChevronRight, Edit, Trash2, UserCheck,
  AlertCircle, UtensilsCrossed, Bell, Star, MessageSquare,
} from 'lucide-react'
import { useState, useMemo } from 'react'
import { format, addDays, startOfWeek, isSameDay, isToday, parseISO } from 'date-fns'
import { sl } from 'date-fns/locale'
import { toast } from 'sonner'
import { usePOSStore } from '@/lib/store'

// ============================================
// TIPI
// ============================================
interface TableType {
  id: string; number: number; capacity: number; area: string; status: string
}

interface ReservationType {
  id: string
  customerName: string
  customerPhone: string
  customerEmail: string
  tableId: string | null
  table: { id: string; number: number; capacity: number; area: string } | null
  dateTime: string
  partySize: number
  duration: number
  status: string
  notes: string
  specialRequests: string
  source: string
  confirmedAt: string | null
  actualArrival: string | null
  actualDeparture: string | null
  reminderSent: boolean
  createdAt: string
}

// ============================================
// STATUSNE MAPE
// ============================================
const statusLabels: Record<string, string> = {
  confirmed: 'Potrjena',
  seated: 'Sedeči',
  completed: 'Zaključena',
  cancelled: 'Preklicana',
  no_show: 'Ni prišel',
}

const statusColors: Record<string, string> = {
  confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  seated: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  completed: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400 border-gray-200 dark:border-gray-800',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
  no_show: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800',
}

const sourceLabels: Record<string, string> = {
  walk_in: 'Osebno',
  phone: 'Telefon',
  website: 'Spletna stran',
  app: 'Aplikacija',
}

const timeSlots = [
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00',
]

// ============================================
// GLAVNA KOMPONENTA
// ============================================
export function ReservationManager() {
  const queryClient = useQueryClient()
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('timeline')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingReservation, setEditingReservation] = useState<ReservationType | null>(null)
  const [filterStatus, setFilterStatus] = useState('all')

  // Podatki
  const dateStr = format(selectedDate, 'yyyy-MM-dd')
  const { data, isLoading } = useQuery({
    queryKey: ['reservations', dateStr],
    queryFn: async () => {
      const res = await authFetch(`/api/reservations?date=${dateStr}`)
      return res.json()
    },
  })

  const { data: upcomingData } = useQuery({
    queryKey: ['reservations-upcoming'],
    queryFn: async () => {
      const res = await authFetch('/api/reservations?upcoming=true')
      return res.json()
    },
  })

  const { data: tables } = useQuery({
    queryKey: ['tables'],
    queryFn: async () => {
      const res = await authFetch('/api/tables')
      return res.json()
    },
  })

  const reservations: ReservationType[] = data?.reservations || []
  const filteredReservations = filterStatus === 'all'
    ? reservations
    : reservations.filter(r => r.status === filterStatus)
  const summary = data?.summary || {}

  // Navigacija po datumih
  const navigateDate = (dir: number) => setSelectedDate(prev => addDays(prev, dir))
  const goToToday = () => setSelectedDate(new Date())

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
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
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
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
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
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateDate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant={isToday(selectedDate) ? 'default' : 'outline'} size="sm" onClick={goToToday} className="min-w-32">
            <Calendar className="h-3.5 w-3.5 mr-1.5" />
            {isToday(selectedDate) ? 'Danes' : format(selectedDate, 'EEE d. MMM', { locale: sl })}
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateDate(1)}>
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
}

// ============================================
// ČASOVNI POGLED — Timeline
// ============================================
function TimelineView({
  reservations,
  tables,
  onEdit,
  onStatusChange,
}: {
  reservations: ReservationType[]
  tables: TableType[]
  onEdit: (r: ReservationType) => void
  onStatusChange: (id: string, status: string) => void
}) {
  // Grupiraj po časovnih intervalih
  const groupedByTime = useMemo(() => {
    const groups: Record<string, ReservationType[]> = {}
    timeSlots.forEach(slot => { groups[slot] = [] })
    reservations.forEach(r => {
      const time = format(new Date(r.dateTime), 'HH:mm')
      // Najdi najbližji časovni interval
      const closestSlot = timeSlots.reduce((prev, curr) =>
        Math.abs(curr.localeCompare(time)) < Math.abs(prev.localeCompare(time)) ? curr : prev
      )
      if (groups[closestSlot]) {
        groups[closestSlot].push(r)
      } else {
        groups[time] = [r]
      }
    })
    return groups
  }, [reservations])

  if (reservations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
        <Calendar className="h-12 w-12 opacity-20" />
        <p className="text-sm font-medium">Ni rezervacij za ta dan</p>
        <p className="text-xs">Ustvarite novo rezervacijo z gumbom zgoraj</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {timeSlots.map(slot => {
        const slotReservations = groupedByTime[slot]
        if (slotReservations.length === 0) return null

        return (
          <div key={slot} className="flex gap-3">
            <div className="w-14 flex-shrink-0 pt-2">
              <span className="text-sm font-mono font-bold text-muted-foreground">{slot}</span>
            </div>
            <div className="flex-1 space-y-2">
              {slotReservations.map(r => (
                <ReservationCard
                  key={r.id}
                  reservation={r}
                  onEdit={() => onEdit(r)}
                  onStatusChange={onStatusChange}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ============================================
// SEZNAMSKI POGLED — List
// ============================================
function ListView({
  reservations,
  onEdit,
  onStatusChange,
}: {
  reservations: ReservationType[]
  onEdit: (r: ReservationType) => void
  onStatusChange: (id: string, status: string) => void
}) {
  if (reservations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-3">
        <Calendar className="h-12 w-12 opacity-20" />
        <p className="text-sm font-medium">Ni rezervacij</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {reservations.map(r => (
        <ReservationCard
          key={r.id}
          reservation={r}
          onEdit={() => onEdit(r)}
          onStatusChange={onStatusChange}
        />
      ))}
    </div>
  )
}

// ============================================
// KARTICA REZERVACIJE
// ============================================
function ReservationCard({
  reservation,
  onEdit,
  onStatusChange,
}: {
  reservation: ReservationType
  onEdit: () => void
  onStatusChange: (id: string, status: string) => void
}) {
  const r = reservation
  const time = format(new Date(r.dateTime), 'HH:mm')
  const endTime = format(new Date(new Date(r.dateTime).getTime() + r.duration * 60000), 'HH:mm')

  const nextActions: Record<string, { status: string; label: string; icon: React.ReactNode }[]> = {
    confirmed: [
      { status: 'seated', label: 'Posedljeno', icon: <UserCheck className="h-3.5 w-3.5" /> },
      { status: 'no_show', label: 'Ni prišel', icon: <AlertCircle className="h-3.5 w-3.5" /> },
      { status: 'cancelled', label: 'Prekliči', icon: <X className="h-3.5 w-3.5" /> },
    ],
    seated: [
      { status: 'completed', label: 'Zaključi', icon: <Check className="h-3.5 w-3.5" /> },
    ],
  }

  return (
    <Card className={`border ${statusColors[r.status]} hover:shadow-sm transition-shadow`}>
      <CardContent className="p-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            {/* Čas */}
            <div className="text-center min-w-12">
              <p className="text-lg font-bold">{time}</p>
              <p className="text-[10px] text-muted-foreground">do {endTime}</p>
            </div>

            {/* Podatki */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-sm">{r.customerName}</span>
                <Badge variant="outline" className={`text-[9px] h-5 px-1.5 ${statusColors[r.status]}`}>
                  {statusLabels[r.status]}
                </Badge>
                {r.source !== 'walk_in' && (
                  <Badge variant="secondary" className="text-[9px] h-5 px-1.5">
                    {sourceLabels[r.source] || r.source}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Users className="h-3 w-3" />{r.partySize} oseb</span>
                {r.table && (
                  <span className="flex items-center gap-1"><UtensilsCrossed className="h-3 w-3" />Miza {r.table.number}</span>
                )}
                {r.customerPhone && (
                  <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{r.customerPhone}</span>
                )}
                {r.duration !== 120 && (
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{r.duration} min</span>
                )}
              </div>

              {r.specialRequests && (
                <div className="flex items-center gap-1 mt-1 text-xs text-amber-600 dark:text-amber-400">
                  <Star className="h-3 w-3" />
                  <span className="truncate">{r.specialRequests}</span>
                </div>
              )}
              {r.notes && (
                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                  <MessageSquare className="h-3 w-3" />
                  <span className="truncate">{r.notes}</span>
                </div>
              )}
            </div>
          </div>

          {/* Akcije */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {nextActions[r.status]?.map(action => (
              <Button
                key={action.status}
                variant="outline"
                size="sm"
                className="h-7 text-[10px] px-2"
                onClick={() => onStatusChange(r.id, action.status)}
              >
                {action.icon} {action.label}
              </Button>
            ))}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
              <Edit className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================
// DIALOG ZA NOVO/UREDI REZERVACIJO
// ============================================
function ReservationDialog({
  open,
  onClose,
  reservation,
  tables,
  selectedDate,
  onSave,
}: {
  open: boolean
  onClose: () => void
  reservation: ReservationType | null
  tables: TableType[]
  selectedDate: Date
  onSave: (data: Record<string, unknown>) => void
}) {
  const isEditing = !!reservation

  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [tableId, setTableId] = useState('')
  const [date, setDate] = useState(format(selectedDate, 'yyyy-MM-dd'))
  const [time, setTime] = useState('19:00')
  const [partySize, setPartySize] = useState(2)
  const [duration, setDuration] = useState(120)
  const [notes, setNotes] = useState('')
  const [specialRequests, setSpecialRequests] = useState('')
  const [source, setSource] = useState('walk_in')

  // Napolni ob urejanju
  const resetForm = () => {
    if (reservation) {
      setCustomerName(reservation.customerName)
      setCustomerPhone(reservation.customerPhone)
      setCustomerEmail(reservation.customerEmail)
      setTableId(reservation.tableId || '')
      const dt = new Date(reservation.dateTime)
      setDate(format(dt, 'yyyy-MM-dd'))
      setTime(format(dt, 'HH:mm'))
      setPartySize(reservation.partySize)
      setDuration(reservation.duration)
      setNotes(reservation.notes)
      setSpecialRequests(reservation.specialRequests)
      setSource(reservation.source)
    } else {
      setCustomerName('')
      setCustomerPhone('')
      setCustomerEmail('')
      setTableId('')
      setDate(format(selectedDate, 'yyyy-MM-dd'))
      setTime('19:00')
      setPartySize(2)
      setDuration(120)
      setNotes('')
      setSpecialRequests('')
      setSource('walk_in')
    }
  }

  // Ko se dialog odpre
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) resetForm()
    else onClose()
  }

  const handleSave = () => {
    if (!customerName || !partySize) {
      toast.error('Ime in število oseb sta obvezna')
      return
    }

    const dateTime = new Date(`${date}T${time}:00`)

    onSave({
      customerName,
      customerPhone,
      customerEmail,
      tableId: tableId || null,
      dateTime: dateTime.toISOString(),
      partySize,
      duration,
      notes,
      specialRequests,
      source,
    })
  }

  // Primerno mize glede na kapaciteto
  const suitableTables = tables
    .filter(t => t.capacity >= partySize)
    .sort((a, b) => a.capacity - b.capacity) // Najmanjša primerna miza prva

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            {isEditing ? 'Uredi rezervacijo' : 'Nova rezervacija'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Stranka */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Podatki stranke</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">Ime in priimek *</label>
                <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Janez Novak" className="h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium">Telefon</label>
                <Input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="+386 40 123 456" className="h-9 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">E-pošta</label>
                <Input value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="janez@email.si" className="h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium">Vir</label>
                <Select value={source} onValueChange={setSource}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="walk_in">Osebno</SelectItem>
                    <SelectItem value="phone">Telefon</SelectItem>
                    <SelectItem value="website">Spletna stran</SelectItem>
                    <SelectItem value="app">Aplikacija</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Čas in miza */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Čas in miza</p>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-medium">Datum</label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium">Ura</label>
                <Select value={time} onValueChange={setTime}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {timeSlots.map(slot => (
                      <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium">Oseb *</label>
                <Input type="number" min={1} max={20} value={partySize} onChange={e => setPartySize(parseInt(e.target.value) || 1)} className="h-9 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium">Trajanje (min)</label>
                <Select value={String(duration)} onValueChange={v => setDuration(parseInt(v))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="60">1 ura</SelectItem>
                    <SelectItem value="90">1.5 ure</SelectItem>
                    <SelectItem value="120">2 uri</SelectItem>
                    <SelectItem value="150">2.5 ure</SelectItem>
                    <SelectItem value="180">3 ure</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium">Miza (primernih: {suitableTables.length})</label>
              <Select value={tableId || 'none'} onValueChange={(v) => setTableId(v === 'none' ? '' : v)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Izberi mizo ali pusti prazno" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Brez mize</SelectItem>
                  {suitableTables.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      Miza {t.number} ({t.capacity} mest) — {t.area}
                    </SelectItem>
                  ))}
                  {suitableTables.length === 0 && partySize > 0 && (
                    <SelectItem value="no-tables" disabled>Ni primernih miz za {partySize} oseb</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Opombe */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Opombe</p>
            <div>
              <label className="text-xs font-medium">Posebne želje</label>
              <Textarea value={specialRequests} onChange={e => setSpecialRequests(e.target.value)} placeholder="Otroški stol, ob oknu, rojstnodnevna torta..." className="text-sm min-h-16" />
            </div>
            <div>
              <label className="text-xs font-medium">Interne opombe</label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Alergije, VIP gost, pogosto naroča..." className="text-sm min-h-16" />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Prekliči</Button>
          <Button onClick={handleSave}>
            {isEditing ? 'Shrani spremembe' : 'Ustvari rezervacijo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
