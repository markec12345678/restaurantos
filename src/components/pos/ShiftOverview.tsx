'use client'

import { useState, useEffect, useCallback, memo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Progress } from '@/components/ui/progress'
import { ShiftRow, EmployeeRow, TimeEntryRow } from '@/lib/types'
import { authFetch } from '@/components/pos/PinLogin'
import { toast } from 'sonner'
import { Clock, UserCheck, Coffee, LogOut, Play, Users, Timer, CalendarDays, CheckCircle2 } from 'lucide-react'

interface ShiftEmployee {
  id: string
  name: string
  role: string
  shiftType: 'morning' | 'afternoon' | 'evening' | 'full'
  shiftStart: string
  shiftEnd: string
  status: 'scheduled' | 'clocked-in' | 'on-break' | 'clocked-out'
  clockedInAt: string | null
  breakStartedAt: string | null
  totalBreakMinutes: number
  location: string
  hoursWorked: number
  hoursRemaining: number
}

export const ShiftOverview = memo(function ShiftOverview() {
  const [employees, setEmployees] = useState<ShiftEmployee[]>([])
  const [_loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('all')

  useEffect(() => {
    loadShiftData()
    const interval = setInterval(loadShiftData, 30000) // Osveži vsakih 30s
    return () => clearInterval(interval)
  }, [])

  const loadShiftData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]

      // Naloži razpored
      const shiftRes = await authFetch(`/api/staff-shifts?date=${today}`)
      const shiftData = await shiftRes.json()

      // Naloži zaposlene
      const empRes = await authFetch('/api/employees')
      const empData = await empRes.json()

      // Naloži časovne evidence
      const timeRes = await authFetch('/api/time-entries')
      const timeData = await timeRes.json()

      const shiftEmployees: ShiftEmployee[] = (shiftData || []).map((shift: ShiftRow) => {
        const emp = empData?.find?.((e: EmployeeRow) => e.id === shift.employeeId) || {}
        const timeEntry = timeData?.find?.((t: TimeEntryRow) =>
          t.employeeId === shift.employeeId &&
          t.clockIn && new Date(t.clockIn).toISOString().split('T')[0] === today
        )

        let status: ShiftEmployee['status'] = 'scheduled'
        let clockedInAt: string | null = null
        let breakStartedAt: string | null = null
        let totalBreakMinutes = 0

        if (timeEntry?.clockIn && !timeEntry?.clockOut) {
          if (timeEntry?.breakStart && !timeEntry?.breakEnd) {
            status = 'on-break'
            breakStartedAt = timeEntry.breakStart
          } else {
            status = 'clocked-in'
          }
          clockedInAt = timeEntry.clockIn
          if (timeEntry.breakMinutes) totalBreakMinutes = timeEntry.breakMinutes
        } else if (timeEntry?.clockOut) {
          status = 'clocked-out'
          clockedInAt = timeEntry.clockIn
        }

        // Izračunaj ure
        const now = new Date()
        const start = shift.startTime ? new Date(`1970-01-01T${shift.startTime}`) : new Date()
        const end = shift.endTime ? new Date(`1970-01-01T${shift.endTime}`) : new Date()
        const totalShiftHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
        let hoursWorked = 0
        if (clockedInAt) {
          hoursWorked = (now.getTime() - new Date(clockedInAt).getTime()) / (1000 * 60 * 60) - (totalBreakMinutes / 60)
        }
        const hoursRemaining = Math.max(0, totalShiftHours - hoursWorked)

        return {
          id: shift.employeeId || shift.id,
          name: emp.name || shift.employeeId || 'Neznan',
          role: emp.primaryJob || emp.role || shift.shiftType || 'Osebje',
          shiftType: shift.shiftType || 'full',
          shiftStart: shift.startTime || '08:00',
          shiftEnd: shift.endTime || '16:00',
          status,
          clockedInAt,
          breakStartedAt,
          totalBreakMinutes,
          location: shift.locationId || 'Glavna',
          hoursWorked: Math.round(hoursWorked * 100) / 100,
          hoursRemaining: Math.round(hoursRemaining * 100) / 100,
        }
      })

      setEmployees(shiftEmployees)
    } catch {
      toast.error('Napaka pri nalaganju izmenskih podatkov')
    } finally {
      setLoading(false)
    }
  }

  const handleClockIn = useCallback(async (employeeId: string) => {
    try {
      await authFetch('/api/time-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, clockIn: new Date().toISOString() }),
      })
      await loadShiftData()
    } catch {
      toast.error('Napaka pri prijavi na izmeno')
    }
  }, [loadShiftData])

  const handleClockOut = useCallback(async (employeeId: string) => {
    try {
      await authFetch('/api/time-entries', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, clockOut: new Date().toISOString() }),
      })
      await loadShiftData()
    } catch {
      toast.error('Napaka pri odjavi iz izmene')
    }
  }, [loadShiftData])

  const handleBreak = useCallback(async (employeeId: string, onBreak: boolean) => {
    try {
      await authFetch('/api/time-entries', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId,
          [onBreak ? 'breakEnd' : 'breakStart']: new Date().toISOString(),
        }),
      })
      await loadShiftData()
    } catch {
      toast.error('Napaka pri preklopu odmora')
    }
  }, [loadShiftData])

  const statusConfig = {
    'clocked-in': {
      label: 'Na delu',
      color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      icon: UserCheck,
      dotColor: 'bg-green-500',
    },
    'on-break': {
      label: 'Odmor',
      color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
      icon: Coffee,
      dotColor: 'bg-amber-500',
    },
    'clocked-out': {
      label: 'Odpisan',
      color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
      icon: LogOut,
      dotColor: 'bg-gray-400',
    },
    'scheduled': {
      label: 'Načrtovan',
      color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      icon: Clock,
      dotColor: 'bg-blue-400',
    },
  }

  const shiftTypeConfig = {
    morning: { label: 'Jutranja', color: 'text-yellow-600' },
    afternoon: { label: 'Popoldanska', color: 'text-orange-600' },
    evening: { label: 'Večerna', color: 'text-purple-600' },
    full: { label: 'Celodnevna', color: 'text-blue-600' },
  }

  const filtered = filterStatus === 'all'
    ? employees
    : employees.filter(e => e.status === filterStatus)

  const clockedInCount = employees.filter(e => e.status === 'clocked-in').length
  const onBreakCount = employees.filter(e => e.status === 'on-break').length
  const scheduledCount = employees.filter(e => e.status === 'scheduled').length
  const totalHoursToday = employees.reduce((s, e) => s + e.hoursWorked, 0)

  const now = new Date()
  const currentTime = now.toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="p-4 space-y-4 h-full overflow-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/30">
            <CalendarDays className="h-5 w-5 text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Pregled izmen</h2>
            <p className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString('sl-SI', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · {currentTime}
            </p>
          </div>
        </div>
      </div>

      {/* Povzetek */}
      <div className="grid grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <UserCheck className="h-5 w-5 text-green-500 mx-auto mb-1" />
            <p className="text-xl font-bold">{clockedInCount}</p>
            <p className="text-xs text-muted-foreground">Na delu</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Coffee className="h-5 w-5 text-amber-500 mx-auto mb-1" />
            <p className="text-xl font-bold">{onBreakCount}</p>
            <p className="text-xs text-muted-foreground">Na odmoru</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Clock className="h-5 w-5 text-blue-500 mx-auto mb-1" />
            <p className="text-xl font-bold">{scheduledCount}</p>
            <p className="text-xs text-muted-foreground">Načrtovani</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Timer className="h-5 w-5 text-purple-500 mx-auto mb-1" />
            <p className="text-xl font-bold">{Math.round(totalHoursToday * 10) / 10}h</p>
            <p className="text-xs text-muted-foreground">Ure danes</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtri */}
      <div className="flex gap-2">
        {['all', 'clocked-in', 'on-break', 'scheduled', 'clocked-out'].map(status => (
          <Button
            key={status}
            variant={filterStatus === status ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterStatus(status)}
          >
            {status === 'all' ? 'Vsi' : statusConfig[status as keyof typeof statusConfig].label}
          </Button>
        ))}
      </div>

      {/* Seznam zaposlenih */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-lg font-medium">Ni zaposlenih za prikaz</p>
              <p className="text-sm text-muted-foreground">Spremenite filter ali dodajte razpored</p>
            </CardContent>
          </Card>
        ) : (
          filtered.map(emp => {
            const config = statusConfig[emp.status]
            const StatusIcon = config.icon
            const shiftConf = shiftTypeConfig[emp.shiftType as keyof typeof shiftTypeConfig]
            const shiftProgress = emp.hoursWorked > 0
              ? Math.min(100, Math.round((emp.hoursWorked / (emp.hoursWorked + emp.hoursRemaining)) * 100))
              : 0

            return (
              <Card key={emp.id} className="transition-all hover:shadow-md">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className="relative">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback>
                          {emp.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background ${config.dotColor}`} aria-label={config.label} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{emp.name}</span>
                        <Badge className={config.color}>
                          <StatusIcon className="h-3 w-3 mr-1" /> {config.label}
                        </Badge>
                        <Badge variant="outline" className={`text-xs ${shiftConf?.color || ''}`}>
                          {shiftConf?.label || emp.shiftType}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {emp.shiftStart} — {emp.shiftEnd}
                        </span>
                        <span>{emp.role}</span>
                        <span>{emp.location}</span>
                      </div>

                      {/* Progress */}
                      {emp.status === 'clocked-in' || emp.status === 'on-break' ? (
                        <div>
                          <div className="flex justify-between text-xs text-muted-foreground mb-1">
                            <span>{emp.hoursWorked}h delano</span>
                            <span>{emp.hoursRemaining}h do konca</span>
                          </div>
                          <Progress value={shiftProgress} className="h-1.5" />
                        </div>
                      ) : null}

                      {emp.breakStartedAt && emp.status === 'on-break' && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-amber-600">
                          <Coffee className="h-3 w-3" />
                          Odmor od {new Date(emp.breakStartedAt).toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })}
                          {emp.totalBreakMinutes > 0 && ` (${emp.totalBreakMinutes} min skupaj)`}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      {emp.status === 'scheduled' && (
                        <Button size="sm" onClick={() => handleClockIn(emp.id)}>
                          <Play className="h-3 w-3 mr-1" /> Prijava
                        </Button>
                      )}
                      {emp.status === 'clocked-in' && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => handleBreak(emp.id, false)}>
                            <Coffee className="h-3 w-3 mr-1" /> Odmor
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleClockOut(emp.id)}>
                            <LogOut className="h-3 w-3 mr-1" /> Odjava
                          </Button>
                        </>
                      )}
                      {emp.status === 'on-break' && (
                        <Button size="sm" onClick={() => handleBreak(emp.id, true)}>
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Konec odmora
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
})
