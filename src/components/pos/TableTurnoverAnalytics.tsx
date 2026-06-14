'use client'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Analitika obračuna miz
// Toast POS + OpenTable standard
// Povprečen čas zasedenosti, obračun, predvidevanja
// ═══════════════════════════════════════════════════════════════

import { useQuery } from '@tanstack/react-query'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { authFetch } from '@/components/pos/PinLogin'
import { LayoutGrid } from 'lucide-react'
import { useState, useMemo, memo } from 'react'
import dynamic from 'next/dynamic'

import type { TableData, OrderHistory, AnalyticsData } from './table-turnover/constants'

// ─── Lazy-loaded podkomponente ──────────────────────────────────
const KpiCards = dynamic(() => import('./table-turnover/KpiCards').then(m => ({ default: m.KpiCards })), { ssr: false })
const OccupiedTablesCard = dynamic(() => import('./table-turnover/OccupiedTablesCard').then(m => ({ default: m.OccupiedTablesCard })), { ssr: false })
const VisualOverview = dynamic(() => import('./table-turnover/VisualOverview').then(m => ({ default: m.VisualOverview })), { ssr: false })
const RecommendationsCard = dynamic(() => import('./table-turnover/RecommendationsCard').then(m => ({ default: m.RecommendationsCard })), { ssr: false })

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

  // ─── Analitika ────────────────────────────────────────────────
  const analytics = useMemo<AnalyticsData>(() => {
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
      <KpiCards analytics={analytics} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Trenutno zasedene mize */}
        <OccupiedTablesCard analytics={analytics} />

        {/* Vizualni pregled miz */}
        <VisualOverview tables={tables} analytics={analytics} />
      </div>

      {/* Priporočila */}
      <RecommendationsCard analytics={analytics} />
    </div>
  )
})
