'use client'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Analitika obračuna miz
// Toast POS + OpenTable standard
// Povprečen čas zasedenosti, obračun, predvidevanja
// ═══════════════════════════════════════════════════════════════

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { authFetch } from '@/components/pos/PinLogin'
import { LayoutGrid, Clock, TrendingUp, Users, Timer, UtensilsCrossed, AlertTriangle, CheckCircle2, Zap } from 'lucide-react'
import { useState, useMemo, memo } from 'react'

interface TableData {
  id: string
  number: number
  name?: string
  capacity: number
  status: string
  locationId?: string
  currentOrder?: {
    id: string
    orderNumber: number
    customerName?: string
    createdAt: string
    total: number
    partySize?: number
    type: string
  }
}

interface OrderHistory {
  id: string
  orderNumber: number
  tableId: string
  createdAt: string
  updatedAt: string
  total: number
  type: string
  status: string
}

export const TableTurnoverAnalytics = memo(function TableTurnoverAnalytics() {
  const [period, setPeriod] = useState('today')

  const { data: tablesData, isLoading: tablesLoading } = useQuery<{
    tables: TableData[]
  }>({
    queryKey: ['tables-turnover'],
    queryFn: async () => {
      const res = await authFetch('/api/tables')
      const data = await res.json()
      return { tables: Array.isArray(data) ? data : data.tables || [] }
    },
  })

  const { data: ordersData, isLoading: ordersLoading } = useQuery<{
    orders: OrderHistory[]
  }>({
    queryKey: ['orders-turnover', period],
    queryFn: async () => {
      const res = await authFetch(`/api/dashboard`)
      const data = await res.json()
      return { orders: data.recentOrders || [] }
    },
  })

  const tables = tablesData?.tables || []
  const orders = ordersData?.orders || []

  // Analitika
  const analytics = useMemo(() => {
    const occupiedTables = tables.filter(t => t.status === 'occupied' || t.currentOrder)
    const availableTables = tables.filter(t => t.status === 'available' && !t.currentOrder)
    const reservedTables = tables.filter(t => t.status === 'reserved')
    const totalCapacity = tables.reduce((sum, t) => sum + (t.capacity || 0), 0)
    const occupiedCapacity = occupiedTables.reduce((sum, t) => sum + (t.currentOrder?.partySize || t.capacity || 0), 0)

    // Čas zasedenosti (za trenutno zasedene mize)
    const now = Date.now()
    const occupancyTimes = occupiedTables
      .filter(t => t.currentOrder?.createdAt)
      .map(t => ({
        tableId: t.id,
        tableNumber: t.number,
        minutes: Math.floor((now - new Date(t.currentOrder!.createdAt).getTime()) / 60000),
        customer: t.currentOrder?.customerName,
        total: t.currentOrder?.total || 0,
      }))

    const avgOccupancyTime = occupancyTimes.length > 0
      ? occupancyTimes.reduce((sum, t) => sum + t.minutes, 0) / occupancyTimes.length
      : 0

    // Obračun (stCompletedOrders / stUniqueTables)
    const completedOrders = orders.filter(o => o.status === 'completed' && o.tableId)
    const uniqueTables = new Set(completedOrders.map(o => o.tableId))
    const turnoverRate = uniqueTables.size > 0 ? completedOrders.length / uniqueTables.size : 0

    // Povprečna poraba na mizo
    const avgSpendPerTable = completedOrders.length > 0
      ? completedOrders.reduce((sum, o) => sum + (o.total || 0), 0) / uniqueTables.size
      : 0

    // Revni obračun (mize zasedene > 90 min z enim naročilom)
    const slowTables = occupancyTimes.filter(t => t.minutes > 90)
    const slowTableRate = occupancyTimes.length > 0 ? (slowTables.length / occupancyTimes.length) * 100 : 0

    return {
      totalTables: tables.length,
      occupiedTables: occupiedTables.length,
      availableTables: availableTables.length,
      reservedTables: reservedTables.length,
      occupancyRate: tables.length > 0 ? (occupiedTables.length / tables.length) * 100 : 0,
      capacityUtilization: totalCapacity > 0 ? (occupiedCapacity / totalCapacity) * 100 : 0,
      avgOccupancyTime,
      turnoverRate,
      avgSpendPerTable,
      slowTables,
      slowTableRate,
      occupancyTimes,
      totalCapacity,
      occupiedCapacity,
    }
  }, [tables, orders])

  const isLoading = tablesLoading || ordersLoading

  if (isLoading) {
    return (
      <div className="space-y-6 p-1">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-72" />
      </div>
    )
  }

  return (
    <div className="space-y-6 overflow-y-auto h-full p-1 custom-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <LayoutGrid className="h-6 w-6 text-primary" />
            Analitika obračuna miz
          </h2>
          <p className="text-sm text-muted-foreground">
            Pregled zasedenosti, obračuna in učinkovitosti miz
          </p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Danes</SelectItem>
            <SelectItem value="week">Zadnji teden</SelectItem>
            <SelectItem value="month">Ta mesec</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground font-medium">Zasedenost</p>
            <p className="text-xl font-bold">{analytics.occupancyRate.toFixed(0)}%</p>
            <Progress value={analytics.occupancyRate} className="h-1.5 mt-1" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground font-medium">Mize</p>
            <p className="text-xl font-bold">{analytics.occupiedTables}/{analytics.totalTables}</p>
            <p className="text-[10px] text-muted-foreground">{analytics.availableTables} prostih</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground font-medium">Kapaciteta</p>
            <p className="text-xl font-bold">{analytics.capacityUtilization.toFixed(0)}%</p>
            <p className="text-[10px] text-muted-foreground">{analytics.occupiedCapacity}/{analytics.totalCapacity} oseb</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground font-medium">Povpr. čas</p>
            <p className="text-xl font-bold">{analytics.avgOccupancyTime.toFixed(0)} min</p>
            <p className="text-[10px] text-muted-foreground">zasedenosti</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground font-medium">Obračun</p>
            <p className="text-xl font-bold">{analytics.turnoverRate.toFixed(1)}x</p>
            <p className="text-[10px] text-muted-foreground">na mizo</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground font-medium">Poraba/mizo</p>
            <p className="text-xl font-bold">€{analytics.avgSpendPerTable.toFixed(2)}</p>
            <p className="text-[10px] text-muted-foreground">povprečno</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Trenutno zasedene mize */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <UtensilsCrossed className="h-4 w-4" />
              Trenutno zasedene mize ({analytics.occupiedTables})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.occupancyTimes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <LayoutGrid className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Trenutno ni zasedenih miz</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
                {analytics.occupancyTimes
                  .sort((a, b) => b.minutes - a.minutes)
                  .map(t => (
                    <div key={t.tableId} className={`p-3 rounded-lg border-2 ${
                      t.minutes > 90
                        ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/10'
                        : t.minutes > 60
                          ? 'border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10'
                          : 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/10'
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono">Miza {t.tableNumber}</Badge>
                          {t.minutes > 90 && (
                            <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 text-[10px]">
                              <AlertTriangle className="h-3 w-3 mr-0.5" />Predolgo
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-sm font-mono">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className={t.minutes > 90 ? 'text-red-600 font-bold' : t.minutes > 60 ? 'text-amber-600' : 'text-emerald-600'}>
                            {t.minutes} min
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{t.customer || 'Hodič'}</span>
                        <span>€{t.total.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Vizualni pregled miz */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <LayoutGrid className="h-4 w-4" />
              Vizualni pregled
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {tables.map(table => {
                const isOccupied = table.status === 'occupied' || !!table.currentOrder
                const isReserved = table.status === 'reserved'
                const occupancy = analytics.occupancyTimes.find(t => t.tableId === table.id)
                const minutes = occupancy?.minutes || 0

                return (
                  <div
                    key={table.id}
                    className={`p-3 rounded-xl border-2 text-center transition-all cursor-default ${
                      isOccupied
                        ? minutes > 90
                          ? 'border-red-400 bg-red-100 dark:bg-red-900/30 dark:border-red-700'
                          : 'border-amber-400 bg-amber-100 dark:bg-amber-900/30 dark:border-amber-700'
                        : isReserved
                          ? 'border-blue-400 bg-blue-100 dark:bg-blue-900/30 dark:border-blue-700'
                          : 'border-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 dark:border-emerald-700'
                    }`}
                  >
                    <p className="font-bold text-sm">{table.name || `Miza ${table.number}`}</p>
                    <p className="text-[10px] text-muted-foreground">{table.capacity} oseb</p>
                    {isOccupied && minutes > 0 && (
                      <div className="mt-1">
                        <Badge variant="outline" className={`text-[9px] font-mono ${
                          minutes > 90 ? 'text-red-600 border-red-300' : minutes > 60 ? 'text-amber-600 border-amber-300' : 'text-emerald-600 border-emerald-300'
                        }`}>
                          <Clock className="h-2.5 w-2.5 mr-0.5" />
                          {minutes} min
                        </Badge>
                      </div>
                    )}
                    {!isOccupied && !isReserved && (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto mt-1" />
                    )}
                    {isReserved && (
                      <Badge className="bg-blue-100 text-blue-700 text-[9px] mt-1">Rezervirana</Badge>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Priporočila */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            Priporočila za optimizacijo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {analytics.slowTableRate > 20 && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-semibold text-red-700 dark:text-red-400">Visoka stopnja počasnih miz</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {analytics.slowTableRate.toFixed(0)}% miz je zasedenih več kot 90 minut. Razmislite o boljšem razporejanju miz ali spodbujanju hitrejšega obračuna.
                </p>
              </div>
            )}
            {analytics.occupancyRate > 85 && (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">Visoka zasedenost</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Zasedenost {analytics.occupancyRate.toFixed(0)}% — razmislite o čakalnem seznamu ali dodanih mizah. Povečajte dostavo za razbremenitev.
                </p>
              </div>
            )}
            {analytics.turnoverRate < 1.5 && analytics.occupiedTables > 0 && (
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-1">
                  <Timer className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">Nizek obračun</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Povprečen obračun {analytics.turnoverRate.toFixed(1)}x na mizo je nizek. Predlagamo hitrejše postreženje, prednaročanje in upsell za povečanje vrednosti.
                </p>
              </div>
            )}
            {analytics.capacityUtilization < 50 && (
              <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-semibold text-purple-700 dark:text-purple-400">Nizka izraba kapacitete</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Izraba kapacitete {analytics.capacityUtilization.toFixed(0)}% — veliko prostih mest. Predlagamo promocije za privabljanje večjih skupin ali happy hour ponudbe.
                </p>
              </div>
            )}
            {analytics.occupancyRate < 100 && analytics.slowTableRate < 20 && analytics.turnoverRate >= 1.5 && (
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Odlična optimizacija</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Zasedenost in obračun sta v optimalnem razmerju. Nadaljujte z dobrim delom in spremljajte trende čez teden.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
})
