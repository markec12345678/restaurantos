'use client'
// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Wait Time Estimator
// AI-ocena čakalne dobe za goste
// Bazirano na: trenutna zasedenost, povprečen čas obroka,
// velikost skupine, dan v tednu, ura
// ═══════════════════════════════════════════════════════════════
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { authFetch } from '@/components/pos/PinLogin'
import type { OrderRow } from '@/lib/types'
import { queryKeys } from '@/lib/query-keys'
import { Clock, Users, Timer, ChefHat, BarChart3, CheckCircle2, AlertTriangle, Zap } from 'lucide-react'
import { useState, useMemo, useCallback, memo } from 'react'
interface TableData {
  id: string
  number: number
  capacity: number
  status: string
  area: string
}
interface WaitlistData {
  id: string
  customerName: string
  partySize: number
  quotedTime: number
  createdAt: string
  status: string
}
export const WaitTimeEstimator = memo(function WaitTimeEstimator() {
  const [partySize, setPartySize] = useState('2')
  const [diningType, setDiningType] = useState('dine-in')
  const { data: tables, isLoading: loadingTables } = useQuery({
    queryKey: queryKeys.tables.all,
    queryFn: async () => {
      const res = await authFetch('/api/tables')
      return res.json()
    },
  })
  const { data: waitlist, isLoading: loadingWaitlist } = useQuery({
    queryKey: queryKeys.waitlist.all,
    queryFn: async () => {
      const res = await authFetch('/api/waitlist')
      return res.json()
    },
  })
  const { data: orders } = useQuery({
    queryKey: ['active-orders'],
    queryFn: async () => {
      const res = await authFetch('/api/orders?status=pending,in-progress&limit=50')
      return res.json()
    },
  })
  // Izračunaj čakalno dobo
  const estimation = useMemo(() => {
    const allTables = (tables || []) as TableData[]
    const activeWaitlist = (waitlist || []) as WaitlistData[]
    const _activeOrders = (orders || []) as OrderRow[]
    const size = parseInt(partySize) || 2
    // Proste mize, ki ustrezajo velikosti skupine
    const availableTables = allTables.filter(t => t.status === 'available' && t.capacity >= size)
    const occupiedTables = allTables.filter(t => t.status === 'occupied')
    const totalCapacity = allTables.reduce((sum, t) => sum + t.capacity, 0)
    const occupiedCapacity = occupiedTables.reduce((sum, t) => sum + t.capacity, 0)
    const occupancyRate = totalCapacity > 0 ? (occupiedCapacity / totalCapacity) * 100 : 0
    // Povprečen čas obroka (ocena)
    const now = new Date()
    const hour = now.getHours()
    const dayOfWeek = now.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6
    const isPeakHour = hour >= 11 && hour <= 14 || hour >= 18 && hour <= 21
    let avgMealTime = 60 // minut - osnovna ocena
    if (isPeakHour) avgMealTime += 15
    if (isWeekend) avgMealTime += 10
    if (diningType === 'takeout') avgMealTime = 15
    if (diningType === 'delivery') avgMealTime = 30
    // Čakalna doba
    let estimatedWait = 0
    let confidence = 'high' as 'high' | 'medium' | 'low'
    if (availableTables.length > 0) {
      // Ima proste mize
      estimatedWait = diningType === 'dine-in' ? 5 : 0
      confidence = 'high'
    } else if (activeWaitlist.length === 0) {
      // Brez prostih mize, ampak ni čakalne vrste
      estimatedWait = Math.round(avgMealTime * 0.6)
      confidence = 'medium'
    } else {
      // Brez prostih mize + čakalna vrsta
      const avgQuotedTime = activeWaitlist.reduce((sum, w) => sum + (w.quotedTime || 15), 0) / Math.max(activeWaitlist.length, 1)
      estimatedWait = Math.round(avgQuotedTime * (1 + activeWaitlist.length * 0.2))
      confidence = 'low'
    }
    // Prilagoditev glede na skupino
    if (size >= 6) estimatedWait = Math.round(estimatedWait * 1.4)
    else if (size >= 4) estimatedWait = Math.round(estimatedWait * 1.2)
    // Zasedenost prilagoditev
    if (occupancyRate > 90) estimatedWait = Math.round(estimatedWait * 1.5)
    else if (occupancyRate > 75) estimatedWait = Math.round(estimatedWait * 1.2)
    return {
      estimatedWait,
      confidence,
      availableTables: availableTables.length,
      occupiedTables: occupiedTables.length,
      totalTables: allTables.length,
      occupancyRate,
      waitlistCount: activeWaitlist.length,
      avgMealTime,
      isPeakHour,
      isWeekend,
    }
  }, [tables, waitlist, orders, partySize, diningType])
  const handlePartySizeChange = useCallback((v: string) => setPartySize(v), [])
  const handleDiningTypeChange = useCallback((v: string) => setDiningType(v), [])
  const formatWait = useCallback((mins: number) => {
    if (mins === 0) return 'Brez čakanja'
    if (mins < 60) return `~${mins} min`
    return `~${Math.floor(mins / 60)}h ${mins % 60}min`
  }, [])
  const areaOccupancy = useMemo(() => {
    const allTables = (tables || []) as TableData[]
    const areas = [...new Set(allTables.map(t => t.area))]
    const areaLabels: Record<string, string> = {
      main: 'Glavna dvorana',
      terrace: 'Terasa',
      bar: 'Bar',
      vip: 'VIP',
      garden: 'Vrt',
      private: 'Zasebni prostor',
    }
    return areas.map(area => {
      const areaTables = allTables.filter(t => t.area === area)
      const occupied = areaTables.filter(t => t.status === 'occupied').length
      const total = areaTables.length
      const pct = total > 0 ? (occupied / total) * 100 : 0
      return { area, label: areaLabels[area] || area, occupied, total, pct }
    })
  }, [tables])
  if (loadingTables || loadingWaitlist) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-3 gap-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
        <Skeleton className="h-48" />
      </div>
    )
  }
  return (
    <div className="space-y-4 p-2 overflow-y-auto h-full custom-scrollbar">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Timer className="h-6 w-6 text-blue-500" />
          Ocena čakalne dobe
        </h2>
        <p className="text-muted-foreground">AI ocena čakanja za goste glede na zasedenost</p>
      </div>
      {/* Izbira parametra */}
      <div className="flex items-center gap-4">
        <div>
          <label className="text-sm font-medium">Število oseb</label>
          <Select value={partySize} onValueChange={handlePartySizeChange}>
            <SelectTrigger className="w-28 mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20].map(n => (
                <SelectItem key={n} value={String(n)}>{n} {n === 1 ? 'oseba' : n < 5 ? 'osebe' : 'oseb'}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium">Vrsta</label>
          <Select value={diningType} onValueChange={handleDiningTypeChange}>
            <SelectTrigger className="w-40 mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dine-in">Na mestu</SelectItem>
              <SelectItem value="takeout">Za s seboj</SelectItem>
              <SelectItem value="delivery">Dostava</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {/* Ocena čakanja */}
      <Card className={`border-2 ${
        estimation.estimatedWait === 0 ? 'border-green-300 dark:border-green-800' :
        estimation.estimatedWait <= 15 ? 'border-amber-300 dark:border-amber-800' :
        estimation.estimatedWait <= 30 ? 'border-orange-300 dark:border-orange-800' :
        'border-red-300 dark:border-red-800'
      }`}>
        <CardContent className="p-6 text-center">
          <div className={`text-5xl font-bold mb-2 ${
            estimation.estimatedWait === 0 ? 'text-green-600' :
            estimation.estimatedWait <= 15 ? 'text-amber-600' :
            estimation.estimatedWait <= 30 ? 'text-orange-600' :
            'text-red-600'
          }`}>
            {formatWait(estimation.estimatedWait)}
          </div>
          <div className="flex items-center justify-center gap-2 mb-3">
            <Badge className={
              estimation.confidence === 'high' ? 'bg-green-100 text-green-800' :
              estimation.confidence === 'medium' ? 'bg-amber-100 text-amber-800' :
              'bg-red-100 text-red-800'
            }>
              {estimation.confidence === 'high' ? 'Visoka natančnost' :
               estimation.confidence === 'medium' ? 'Srednja natančnost' :
               'Nizka natančnost'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Za {partySize} {parseInt(partySize) === 1 ? 'osebo' : parseInt(partySize) < 5 ? 'osebe' : 'oseb'}
            {' · '}{diningType === 'dine-in' ? 'na mestu' : diningType === 'takeout' ? 'za s seboj' : 'dostava'}
          </p>
        </CardContent>
      </Card>
      {/* Statistika */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-xs text-muted-foreground">Proste mize</span>
            </div>
            <div className="text-xl font-bold text-green-600">{estimation.availableTables}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-amber-600" />
              <span className="text-xs text-muted-foreground">Zasedenost</span>
            </div>
            <div className="text-xl font-bold text-amber-600">{estimation.occupancyRate.toFixed(0)}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-blue-600" />
              <span className="text-xs text-muted-foreground">V čakalni vrsti</span>
            </div>
            <div className="text-xl font-bold text-blue-600">{estimation.waitlistCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <ChefHat className="h-4 w-4 text-purple-600" />
              <span className="text-xs text-muted-foreground">Povp. čas obroka</span>
            </div>
            <div className="text-xl font-bold text-purple-600">~{estimation.avgMealTime}m</div>
          </CardContent>
        </Card>
      </div>
      {/* Zasedenost po območjih */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Zasedenost po območjih
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {areaOccupancy.map(({ area, label, occupied, total, pct }) => (
                  <div key={area} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{label}</span>
                      <span className="text-muted-foreground">{occupied}/{total} miz ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2">
                      <div className={`h-2 rounded-full ${
                        pct > 90 ? 'bg-red-500' :
                        pct > 70 ? 'bg-amber-500' :
                        'bg-green-500'
                      }`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                ))
            }
          </div>
        </CardContent>
      </Card>
      {/* Dejavniki */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Dejavniki ocene</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-accent/50">
              {estimation.isPeakHour ? (
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              )}
              <span className="text-sm">
                {estimation.isPeakHour ? 'Prometna ura' : 'Mirna ura'}
              </span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-accent/50">
              {estimation.isWeekend ? (
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              )}
              <span className="text-sm">
                {estimation.isWeekend ? 'Vikend' : 'Delovni dan'}
              </span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-accent/50">
              <Users className="h-4 w-4 text-blue-500" />
              <span className="text-sm">
                {parseInt(partySize) >= 6 ? 'Velika skupina' : parseInt(partySize) >= 4 ? 'Srednja skupina' : 'Majhna skupina'}
              </span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-accent/50">
              <Zap className="h-4 w-4 text-purple-500" />
              <span className="text-sm">
                {estimation.occupancyRate > 80 ? 'Visoka zasedenost' : 'Normalna zasedenost'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
      {/* Čakalna vrsta */}
      {estimation.waitlistCount > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" /> Trenutna čakalna vrsta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(waitlist || []).filter((w: WaitlistData) => w.status === 'waiting').map((w: WaitlistData, idx: number) => (
                <div key={w.id} className="flex items-center justify-between p-2 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-muted-foreground">#{idx + 1}</span>
                    <div>
                      <div className="font-medium text-sm">{w.customerName}</div>
                      <div className="text-xs text-muted-foreground">{w.partySize} oseb</div>
                    </div>
                  </div>
                  <Badge variant="outline">
                    <Clock className="h-3 w-3 mr-1" />
                    ~{w.quotedTime} min
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
})
