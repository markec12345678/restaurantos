'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Calendar,
  Clock,
  Users,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Table2,
  BookOpen,
  Timer,
  CircleDot,
  LayoutGrid,
} from 'lucide-react'

interface TableInfo {
  id: string
  number: number
  capacity: number
  status: 'available' | 'occupied' | 'reserved' | 'blocked'
  currentOrderId: string | null
  guests: number
  server: string | null
  seatedAt: string | null
  reservation: ReservationInfo | null
}

interface ReservationInfo {
  id: string
  guestName: string
  guestPhone: string | null
  partySize: number
  date: string
  time: string
  status: 'confirmed' | 'pending' | 'seated' | 'completed' | 'cancelled'
  notes: string | null
  duration: number // minutes
}

interface TimeSlot {
  time: string
  available: number
  total: number
  reservations: number
}

export function TableReservationSync() {
  const [tables, setTables] = useState<TableInfo[]>([])
  const [reservations, setReservations] = useState<ReservationInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [dragAssign, setDragAssign] = useState<string | null>(null)

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 15000) // Osveži vsakih 15s
    return () => clearInterval(interval)
  }, [selectedDate])

  const loadData = async () => {
    try {
      const [tablesRes, reservationsRes] = await Promise.all([
        fetch('/api/tables'),
        fetch(`/api/reservations?date=${selectedDate}`),
      ])

      const tablesData = await tablesRes.json()
      const reservationsData = await reservationsRes.json()

      // Združi mize z rezervacijami
      const todayReservations = (reservationsData || []).filter((r: any) => {
        const rDate = (r.date || r.reservationDate || '').split('T')[0]
        return rDate === selectedDate
      })

      const enrichedTables: TableInfo[] = (tablesData || []).map((table: any) => {
        const matchingReservation = todayReservations.find((r: any) => {
          return r.tableId === table.id && ['confirmed', 'pending'].includes(r.status)
        })

        let status: TableInfo['status'] = table.status || 'available'
        if (table.currentOrderId && table.status === 'occupied') {
          status = 'occupied'
        } else if (matchingReservation) {
          status = 'reserved'
        }

        return {
          id: table.id,
          number: table.number,
          capacity: table.capacity || table.seats || 4,
          status,
          currentOrderId: table.currentOrderId || null,
          guests: table.guests || 0,
          server: table.server?.name || null,
          seatedAt: table.seatedAt || null,
          reservation: matchingReservation ? {
            id: matchingReservation.id,
            guestName: matchingReservation.guestName || matchingReservation.name || 'Gost',
            guestPhone: matchingReservation.guestPhone || matchingReservation.phone || null,
            partySize: matchingReservation.partySize || matchingReservation.guests || 2,
            date: matchingReservation.date || matchingReservation.reservationDate,
            time: matchingReservation.time || '19:00',
            status: matchingReservation.status,
            notes: matchingReservation.notes || null,
            duration: matchingReservation.duration || 90,
          } : null,
        }
      })

      setTables(enrichedTables)
      setReservations(todayReservations.map((r: any) => ({
        id: r.id,
        guestName: r.guestName || r.name || 'Gost',
        guestPhone: r.guestPhone || r.phone || null,
        partySize: r.partySize || r.guests || 2,
        date: r.date || r.reservationDate,
        time: r.time || '19:00',
        status: r.status,
        notes: r.notes || null,
        duration: r.duration || 90,
      })))
    } catch (err) {
      console.error('Error loading table-reservation sync:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSeatReservation = async (reservationId: string, tableId: string) => {
    try {
      await fetch(`/api/reservations/${reservationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'seated', tableId }),
      })
      await loadData()
    } catch (err) {
      console.error('Error seating reservation:', err)
    }
  }

  const handleCancelReservation = async (reservationId: string) => {
    try {
      await fetch(`/api/reservations/${reservationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      })
      await loadData()
    } catch (err) {
      console.error('Error cancelling reservation:', err)
    }
  }

  const handleCompleteReservation = async (reservationId: string) => {
    try {
      await fetch(`/api/reservations/${reservationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      })
      await loadData()
    } catch (err) {
      console.error('Error completing reservation:', err)
    }
  }

  // Izračunaj časovne reže
  const generateTimeSlots = (): TimeSlot[] => {
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
    return slots
  }

  const timeSlots = generateTimeSlots()
  const availableTables = tables.filter(t => t.status === 'available')
  const occupiedTables = tables.filter(t => t.status === 'occupied')
  const reservedTables = tables.filter(t => t.status === 'reserved')
  const pendingReservations = reservations.filter(r => r.status === 'pending' || r.status === 'confirmed')

  const statusConfig = {
    available: { label: 'Prosto', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', dot: 'bg-green-500' },
    occupied: { label: 'Zasedeno', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', dot: 'bg-red-500' },
    reserved: { label: 'Rezervirano', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', dot: 'bg-blue-500' },
    blocked: { label: 'Blokirano', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300', dot: 'bg-gray-400' },
  }

  const reservationStatusConfig = {
    confirmed: { label: 'Potrjena', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
    pending: { label: 'Na čakanju', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
    seated: { label: 'Sedijo', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
    completed: { label: 'Zaključena', color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300' },
    cancelled: { label: 'Preklicana', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  }

  return (
    <div className="p-4 space-y-4 h-full overflow-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-100 dark:bg-cyan-900/30">
            <Table2 className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Sinhronizacija miz in rezervacij</h2>
            <p className="text-sm text-muted-foreground">Real-time pregled mize ↔ rezervacije</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 text-sm border rounded-md bg-background"
          />
          <Button size="sm" variant="outline" onClick={loadData}>
            <RefreshCw className="h-3 w-3 mr-1" /> Osveži
          </Button>
        </div>
      </div>

      {/* Povzetek */}
      <div className="grid grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <CheckCircle className="h-5 w-5 text-green-500 mx-auto mb-1" />
            <p className="text-xl font-bold">{availableTables.length}</p>
            <p className="text-xs text-muted-foreground">Proste mize</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Users className="h-5 w-5 text-red-500 mx-auto mb-1" />
            <p className="text-xl font-bold">{occupiedTables.length}</p>
            <p className="text-xs text-muted-foreground">Zasedene mize</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <BookOpen className="h-5 w-5 text-blue-500 mx-auto mb-1" />
            <p className="text-xl font-bold">{reservedTables.length}</p>
            <p className="text-xs text-muted-foreground">Rezervirane</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Timer className="h-5 w-5 text-amber-500 mx-auto mb-1" />
            <p className="text-xl font-bold">{pendingReservations.length}</p>
            <p className="text-xs text-muted-foreground">Čakajoče rezervacije</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Mize z rezervacijami */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <LayoutGrid className="h-4 w-4" /> Mize
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[400px] overflow-auto">
            {tables.map(table => {
              const config = statusConfig[table.status]
              return (
                <div key={table.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded flex items-center justify-center text-sm font-bold ${config.dot} text-white`}>
                      {table.number}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">Miza {table.number}</span>
                        <Badge className={config.color}>{config.label}</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{table.capacity} mest</span>
                        {table.guests > 0 && <span>· {table.guests} gostov</span>}
                        {table.server && <span>· {table.server}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {table.reservation && (
                      <div className="text-right">
                        <p className="text-xs font-medium">{table.reservation.guestName}</p>
                        <p className="text-xs text-muted-foreground">{table.reservation.time} · {table.reservation.partySize} oseb</p>
                      </div>
                    )}
                    {table.reservation && table.reservation.status === 'confirmed' && (
                      <Button size="sm" variant="outline" onClick={() => handleSeatReservation(table.reservation!.id, table.id)}>
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* Čakajoče rezervacije */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <BookOpen className="h-4 w-4" /> Rezervacije za {new Date(selectedDate).toLocaleDateString('sl-SI', { day: 'numeric', month: 'short' })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[400px] overflow-auto">
            {pendingReservations.length === 0 ? (
              <div className="p-6 text-center">
                <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Vse rezervacije so urejene</p>
              </div>
            ) : (
              pendingReservations.map(res => {
                const resConfig = reservationStatusConfig[res.status as keyof typeof reservationStatusConfig]
                const matchingAvailableTable = availableTables.find(t => t.capacity >= res.partySize)
                return (
                  <div key={res.id} className="p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{res.guestName}</span>
                          <Badge className={resConfig?.color || ''}>{resConfig?.label || res.status}</Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {res.time}</span>
                          <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {res.partySize} oseb</span>
                          <span className="flex items-center gap-1"><Timer className="h-3 w-3" /> {res.duration} min</span>
                        </div>
                        {res.guestPhone && (
                          <p className="text-xs text-muted-foreground mt-1">{res.guestPhone}</p>
                        )}
                        {res.notes && (
                          <p className="text-xs text-muted-foreground mt-1 italic">"{res.notes}"</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {matchingAvailableTable && (
                        <Button size="sm" onClick={() => handleSeatReservation(res.id, matchingAvailableTable.id)}>
                          <ArrowRight className="h-3 w-3 mr-1" /> Sedi mizo {matchingAvailableTable.number}
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => handleCancelReservation(res.id)}>
                        <XCircle className="h-3 w-3 mr-1" /> Prekliči
                      </Button>
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Časovna razdelitev */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4" /> Zasedenost po urah
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-1 overflow-auto pb-2">
            {timeSlots.map(slot => {
              const percent = slot.total > 0 ? ((slot.total - slot.available) / slot.total) * 100 : 0
              const isNow = slot.time === new Date().toLocaleTimeString('sl-SI', { hour: '2-digit', minute: '2-digit' })
              return (
                <div key={slot.time} className={`flex flex-col items-center min-w-[40px] p-1 rounded ${isNow ? 'bg-primary/10 ring-1 ring-primary' : ''}`}>
                  <span className="text-[10px] text-muted-foreground">{slot.time}</span>
                  <div className="h-12 w-6 bg-muted rounded-sm relative overflow-hidden my-1">
                    <div
                      className={`absolute bottom-0 w-full rounded-sm transition-all ${
                        percent >= 80 ? 'bg-red-500' : percent >= 50 ? 'bg-amber-500' : 'bg-green-500'
                      }`}
                      style={{ height: `${percent}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-medium">{slot.available}/{slot.total}</span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
