'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import {
  Plus, Pencil, Trash2, Clock, CalendarDays, Play, CheckCircle2,
  UserX, LogIn, LogOut, Coffee, Timer, Users,
  Briefcase,
} from 'lucide-react'
import { useState, useMemo } from 'react'

// ============================================
// TIPI
// ============================================

interface Employee {
  id: string
  name: string
  pin: string
  role: string
  status: string
}

interface Job {
  id: string
  name: string
  basePayRate: number
}

interface ShiftItem {
  id: string
  employeeId: string
  employee: { id: string; name: string }
  jobId: string | null
  job: { id: string; name: string } | null
  date: string
  startTime: string
  endTime: string
  status: string
  breakMinutes: number
  notes: string
  createdAt: string
}

interface TimeEntryItem {
  id: string
  employeeId: string
  employee: { id: string; name: string }
  jobId: string | null
  job: { id: string; name: string } | null
  clockIn: string
  clockOut: string | null
  breakStart: string | null
  breakEnd: string | null
  breakMinutes: number
  totalMinutes: number
  payRate: number
  totalPay: number
  type: string
  status: string
  notes: string
  createdAt: string
}

// ============================================
// KONSTANTE
// ============================================

const shiftStatusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  scheduled: { label: 'Načrtovana', color: 'text-blue-700 dark:text-blue-400', bgColor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  in_progress: { label: 'V teku', color: 'text-amber-700 dark:text-amber-400', bgColor: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  completed: { label: 'Zaključena', color: 'text-emerald-700 dark:text-emerald-400', bgColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
  absent: { label: 'Odsotna', color: 'text-red-700 dark:text-red-400', bgColor: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
}

const entryTypeConfig: Record<string, { label: string; bgColor: string }> = {
  regular: { label: 'Redne', bgColor: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  overtime: { label: 'Nadure', bgColor: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
  holiday: { label: 'Praznične', bgColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
  sick: { label: 'Bolniška', bgColor: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  vacation: { label: 'Dopust', bgColor: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
}

function formatDateSI(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('sl-SI', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatDateTimeSI(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('sl-SI', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function minutesToHours(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

// ============================================
// GLAVNA KOMPONENTA
// ============================================

export function ShiftManager() {
  const queryClient = useQueryClient()

  // --- Stanja za izmene ---
  const [shiftDialogOpen, setShiftDialogOpen] = useState(false)
  const [editingShift, setEditingShift] = useState<ShiftItem | null>(null)
  const [shiftForm, setShiftForm] = useState({
    employeeId: '',
    jobId: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '17:00',
    breakMinutes: '30',
    notes: '',
  })
  const [deleteShiftDialogOpen, setDeleteShiftDialogOpen] = useState(false)
  const [deleteShiftTarget, setDeleteShiftTarget] = useState<ShiftItem | null>(null)

  // --- Stanja za ure ---
  const [clockInEmployeeId, setClockInEmployeeId] = useState('')
  const [clockInJobId, setClockInJobId] = useState('')
  const [clockOutEntryId, setClockOutEntryId] = useState('')

  // ============================================
  // QUERIES
  // ============================================

  const { data: employees } = useQuery<Employee[]>({
    queryKey: ['employees'],
    queryFn: async () => { const res = await authFetch('/api/employees'); return res.json() },
  })

  const { data: jobs } = useQuery<Job[]>({
    queryKey: ['jobs'],
    queryFn: async () => { const res = await authFetch('/api/jobs'); return res.json() },
  })

  const { data: shifts, isLoading: shiftsLoading } = useQuery<ShiftItem[]>({
    queryKey: ['shifts'],
    queryFn: async () => { const res = await authFetch('/api/shifts'); return res.json() },
  })

  const { data: timeEntries, isLoading: entriesLoading } = useQuery<TimeEntryItem[]>({
    queryKey: ['time-entries'],
    queryFn: async () => { const res = await authFetch('/api/time-entries'); return res.json() },
  })

  // ============================================
  // IZRAČUNI
  // ============================================

  const employeesList = Array.isArray(employees) ? employees : []
  const allShifts = shifts || []
  const allEntries = timeEntries || []

  const activeEntries = allEntries.filter(e => !e.clockOut)
  const completedEntries = allEntries.filter(e => e.clockOut).sort((a, b) => new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime())

  const scheduledCount = allShifts.filter(s => s.status === 'scheduled').length
  const inProgressCount = allShifts.filter(s => s.status === 'in_progress').length
  const completedCount = allShifts.filter(s => s.status === 'completed').length
  const totalHoursToday = allEntries
    .filter(e => new Date(e.clockIn).toDateString() === new Date().toDateString())
    .reduce((sum, e) => sum + e.totalMinutes, 0) / 60

  // ============================================
  // MUTATIONS
  // ============================================

  const createShiftMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await authFetch('/api/shifts', { method: 'POST', body: JSON.stringify(data) })
      return res.json()
    },
    onSuccess: () => { toast.success('Izmena uspešno ustvarjena'); queryClient.invalidateQueries({ queryKey: ['shifts'] }); setShiftDialogOpen(false) },
    onError: () => toast.error('Napaka pri ustvarjanju izmene'),
  })

  const updateShiftMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, unknown>) => {
      const res = await authFetch(`/api/shifts/${id}`, { method: 'PUT', body: JSON.stringify(data) })
      return res.json()
    },
    onSuccess: () => { toast.success('Izmena uspešno posodobljena'); queryClient.invalidateQueries({ queryKey: ['shifts'] }); setShiftDialogOpen(false); setEditingShift(null) },
    onError: () => toast.error('Napaka pri posodabljanju izmene'),
  })

  const deleteShiftMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/shifts/${id}`, { method: 'DELETE' })
      return res.json()
    },
    onSuccess: () => { toast.success('Izmena uspešno izbrisana'); queryClient.invalidateQueries({ queryKey: ['shifts'] }); setDeleteShiftDialogOpen(false) },
    onError: () => toast.error('Napaka pri brisanju izmene'),
  })

  const clockInMutation = useMutation({
    mutationFn: async (data: { employeeId: string; jobId?: string; type?: string }) => {
      const res = await authFetch('/api/time-entries', { method: 'POST', body: JSON.stringify({ ...data, clockIn: new Date().toISOString() }) })
      return res.json()
    },
    onSuccess: () => { toast.success('Uspešno prijavljen'); queryClient.invalidateQueries({ queryKey: ['time-entries'] }); setClockInEmployeeId(''); setClockInJobId('') },
    onError: () => toast.error('Napaka pri prijavi'),
  })

  const clockOutMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, unknown>) => {
      const res = await authFetch(`/api/time-entries/${id}`, { method: 'PUT', body: JSON.stringify(data) })
      return res.json()
    },
    onSuccess: () => { toast.success('Uspešno odjavljen'); queryClient.invalidateQueries({ queryKey: ['time-entries'] }); setClockOutEntryId('') },
    onError: () => toast.error('Napaka pri odjavi'),
  })

  // ============================================
  // HANDLERJI
  // ============================================

  const openCreateShift = () => {
    setEditingShift(null)
    setShiftForm({ employeeId: '', jobId: '', date: new Date().toISOString().split('T')[0], startTime: '09:00', endTime: '17:00', breakMinutes: '30', notes: '' })
    setShiftDialogOpen(true)
  }

  const openEditShift = (shift: ShiftItem) => {
    setEditingShift(shift)
    setShiftForm({
      employeeId: shift.employeeId,
      jobId: shift.jobId || '',
      date: new Date(shift.date).toISOString().split('T')[0],
      startTime: shift.startTime,
      endTime: shift.endTime,
      breakMinutes: String(shift.breakMinutes),
      notes: shift.notes,
    })
    setShiftDialogOpen(true)
  }

  const handleShiftSubmit = () => {
    if (!shiftForm.employeeId) { toast.error('Izberite zaposlenega'); return }
    const payload = {
      employeeId: shiftForm.employeeId,
      jobId: shiftForm.jobId || undefined,
      date: new Date(shiftForm.date).toISOString(),
      startTime: shiftForm.startTime,
      endTime: shiftForm.endTime,
      breakMinutes: parseInt(shiftForm.breakMinutes) || 30,
      notes: shiftForm.notes,
    }
    if (editingShift) {
      updateShiftMutation.mutate({ id: editingShift.id, ...payload })
    } else {
      createShiftMutation.mutate(payload)
    }
  }

  const startShift = (shift: ShiftItem) => {
    updateShiftMutation.mutate({ id: shift.id, status: 'in_progress' })
  }

  const completeShift = (shift: ShiftItem) => {
    updateShiftMutation.mutate({ id: shift.id, status: 'completed' })
  }

  const markAbsent = (shift: ShiftItem) => {
    updateShiftMutation.mutate({ id: shift.id, status: 'absent' })
  }

  const handleClockIn = () => {
    if (!clockInEmployeeId) { toast.error('Izberite zaposlenega'); return }
    clockInMutation.mutate({ employeeId: clockInEmployeeId, jobId: clockInJobId || undefined })
  }

  const handleClockOut = (entryId: string) => {
    clockOutMutation.mutate({ id: entryId, clockOut: new Date().toISOString() })
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4 custom-scrollbar">
      {/* Glava */}
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          Izmene in ure
        </h2>
        <p className="text-sm text-muted-foreground">Upravljanje izmen, prijava/odjava ur in sledenje prisotnosti</p>
      </div>

      {/* Povzetek */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{scheduledCount}</p>
                <p className="text-xs text-muted-foreground">Načrtovane</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                <Play className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-400">{inProgressCount}</p>
                <p className="text-xs text-muted-foreground">V teku</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{completedCount}</p>
                <p className="text-xs text-muted-foreground">Zaključene</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Timer className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalHoursToday.toFixed(1)}h</p>
                <p className="text-xs text-muted-foreground">Ure danes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Zavihki */}
      <Tabs defaultValue="shifts">
        <TabsList>
          <TabsTrigger value="shifts"><CalendarDays className="h-4 w-4 mr-1.5" />Izmene</TabsTrigger>
          <TabsTrigger value="time"><Clock className="h-4 w-4 mr-1.5" />Ure</TabsTrigger>
        </TabsList>

        {/* === ZAVIHEK: IZMENE === */}
        <TabsContent value="shifts" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={openCreateShift}><Plus className="h-4 w-4 mr-2" />Dodaj izmeno</Button>
          </div>

          {shiftsLoading ? (
            <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : allShifts.length === 0 ? (
            <div className="text-center py-16">
              <CalendarDays className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <h3 className="text-lg font-semibold mb-1">Ni izmen</h3>
              <p className="text-sm text-muted-foreground mb-4">Ustvarite prvo izmeno za začetek razporeda</p>
              <Button onClick={openCreateShift}><Plus className="h-4 w-4 mr-2" />Dodaj izmeno</Button>
            </div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Datum</TableHead>
                      <TableHead>Zaposleni</TableHead>
                      <TableHead>Funkcija</TableHead>
                      <TableHead>Čas</TableHead>
                      <TableHead>Odmor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Dejanja</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allShifts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(shift => {
                      const cfg = shiftStatusConfig[shift.status] || shiftStatusConfig.scheduled
                      return (
                        <TableRow key={shift.id}>
                          <TableCell className="text-sm whitespace-nowrap">{formatDateSI(shift.date)}</TableCell>
                          <TableCell className="font-medium text-sm">{shift.employee?.name || 'Neznan'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{shift.job?.name || '—'}</TableCell>
                          <TableCell className="text-sm font-mono">{shift.startTime} - {shift.endTime}</TableCell>
                          <TableCell className="text-sm">
                            <div className="flex items-center gap-1">
                              <Coffee className="h-3 w-3 text-muted-foreground" />
                              {shift.breakMinutes} min
                            </div>
                          </TableCell>
                          <TableCell><Badge className={`text-xs ${cfg.bgColor}`}>{cfg.label}</Badge></TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {shift.status === 'scheduled' && (
                                <>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-600" title="Začni" onClick={() => startShift(shift)}><Play className="h-3.5 w-3.5" /></Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600" title="Odsoten" onClick={() => markAbsent(shift)}><UserX className="h-3.5 w-3.5" /></Button>
                                </>
                              )}
                              {shift.status === 'in_progress' && (
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600" title="Zaključi" onClick={() => completeShift(shift)}><CheckCircle2 className="h-3.5 w-3.5" /></Button>
                              )}
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="Uredi" onClick={() => openEditShift(shift)}><Pencil className="h-3.5 w-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Izbriši" onClick={() => { setDeleteShiftTarget(shift); setDeleteShiftDialogOpen(true) }}><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* === ZAVIHEK: URE === */}
        <TabsContent value="time" className="space-y-4">
          {/* Prijava / Odjava */}
          <Card>
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <LogIn className="h-4 w-4 text-primary" />
                Prijava / Odjava
              </h3>
              <div className="flex flex-wrap gap-3 items-end">
                <div className="space-y-1.5">
                  <Label className="text-xs">Zaposleni</Label>
                  <Select value={clockInEmployeeId} onValueChange={setClockInEmployeeId}>
                    <SelectTrigger className="w-48 h-9 text-sm"><SelectValue placeholder="Izberi..." /></SelectTrigger>
                    <SelectContent>
                      {employeesList.filter(e => e.status === 'active').map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Funkcija</Label>
                  <Select value={clockInJobId} onValueChange={setClockInJobId}>
                    <SelectTrigger className="w-44 h-9 text-sm"><SelectValue placeholder="Izberi..." /></SelectTrigger>
                    <SelectContent>
                      {jobs?.map(j => (
                        <SelectItem key={j.id} value={j.id}>{j.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleClockIn} disabled={!clockInEmployeeId || clockInMutation.isPending}>
                  <LogIn className="h-4 w-4 mr-1.5" />Prijava
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Aktivne prijave */}
          {activeEntries.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <div className="px-4 pt-3 pb-2">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    Trenutno prijavljeni ({activeEntries.length})
                  </h3>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Zaposleni</TableHead>
                      <TableHead>Funkcija</TableHead>
                      <TableHead>Prijava</TableHead>
                      <TableHead>Trajanje</TableHead>
                      <TableHead className="text-right">Dejanja</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeEntries.map(entry => {
                      const elapsed = Math.floor((Date.now() - new Date(entry.clockIn).getTime()) / 60000)
                      return (
                        <TableRow key={entry.id}>
                          <TableCell className="font-medium text-sm">{entry.employee?.name || 'Neznan'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{entry.job?.name || '—'}</TableCell>
                          <TableCell className="text-sm whitespace-nowrap">{formatDateTimeSI(entry.clockIn)}</TableCell>
                          <TableCell className="text-sm font-mono">{minutesToHours(elapsed)}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleClockOut(entry.id)}>
                              <LogOut className="h-3 w-3 mr-1" />Odjava
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Zgodovina */}
          <Card>
            <CardContent className="p-0">
              <div className="px-4 pt-3 pb-2">
                <h3 className="text-sm font-semibold">Zadnji vnosi ur</h3>
              </div>
              {entriesLoading ? (
                <div className="p-4 space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
              ) : completedEntries.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">Ni vnosov ur</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Zaposleni</TableHead>
                      <TableHead>Funkcija</TableHead>
                      <TableHead>Prijava</TableHead>
                      <TableHead>Odjava</TableHead>
                      <TableHead>Skupaj</TableHead>
                      <TableHead>Vrsta</TableHead>
                      <TableHead className="text-right">Plača</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {completedEntries.slice(0, 20).map(entry => {
                      const typeCfg = entryTypeConfig[entry.type] || entryTypeConfig.regular
                      return (
                        <TableRow key={entry.id}>
                          <TableCell className="font-medium text-sm">{entry.employee?.name || 'Neznan'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{entry.job?.name || '—'}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{formatDateTimeSI(entry.clockIn)}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{entry.clockOut ? formatDateTimeSI(entry.clockOut) : '—'}</TableCell>
                          <TableCell className="text-sm font-mono">{minutesToHours(entry.totalMinutes)}</TableCell>
                          <TableCell><Badge className={`text-[10px] ${typeCfg.bgColor}`}>{typeCfg.label}</Badge></TableCell>
                          <TableCell className="text-right text-sm font-medium">€{entry.totalPay.toFixed(2)}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dijalog za izmeno */}
      <Dialog open={shiftDialogOpen} onOpenChange={open => { if (!open) setEditingShift(null); setShiftDialogOpen(open) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              {editingShift ? 'Uredi izmeno' : 'Dodaj izmeno'}
            </DialogTitle>
            <DialogDescription>
              {editingShift ? 'Posodobite podatke o izmeni.' : 'Ustvarite novo izmeno za zaposlenega.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Zaposleni *</Label>
              <Select value={shiftForm.employeeId} onValueChange={v => setShiftForm({ ...shiftForm, employeeId: v })}>
                <SelectTrigger><SelectValue placeholder="Izberi zaposlenega" /></SelectTrigger>
                <SelectContent>
                  {employeesList.filter(e => e.status === 'active').map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Funkcija</Label>
              <Select value={shiftForm.jobId} onValueChange={v => setShiftForm({ ...shiftForm, jobId: v })}>
                <SelectTrigger><SelectValue placeholder="Izberi funkcijo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Brez</SelectItem>
                  {jobs?.map(j => (
                    <SelectItem key={j.id} value={j.id}>{j.name} (€{j.basePayRate.toFixed(2)}/h)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Datum</Label>
                <Input type="date" value={shiftForm.date} onChange={e => setShiftForm({ ...shiftForm, date: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Začetek</Label>
                <Input type="time" value={shiftForm.startTime} onChange={e => setShiftForm({ ...shiftForm, startTime: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Konec</Label>
                <Input type="time" value={shiftForm.endTime} onChange={e => setShiftForm({ ...shiftForm, endTime: e.target.value })} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Odmor (min)</Label>
              <Input type="number" min="0" value={shiftForm.breakMinutes} onChange={e => setShiftForm({ ...shiftForm, breakMinutes: e.target.value })} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Opombe</Label>
              <Textarea value={shiftForm.notes} onChange={e => setShiftForm({ ...shiftForm, notes: e.target.value })} rows={2} placeholder="Opombe k izmeni..." />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setShiftDialogOpen(false); setEditingShift(null) }}>Prekliči</Button>
            <Button onClick={handleShiftSubmit} disabled={createShiftMutation.isPending || updateShiftMutation.isPending}>
              {createShiftMutation.isPending || updateShiftMutation.isPending ? (
                <><span className="animate-spin mr-2">⏳</span>Shranjujem...</>
              ) : editingShift ? 'Posodobi' : <><Plus className="h-4 w-4 mr-1.5" />Ustvari</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dijalog za brisanje */}
      <AlertDialog open={deleteShiftDialogOpen} onOpenChange={setDeleteShiftDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Izbriši izmeno</AlertDialogTitle>
            <AlertDialogDescription>
              Ali ste prepričani, da želite izbrisati to izmeno? Tega dejanja ni mogoče razveljaviti.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Prekliči</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteShiftTarget && deleteShiftMutation.mutate(deleteShiftTarget.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Izbriši
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
