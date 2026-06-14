'use client'
import { useState, useEffect, useCallback, useMemo, memo } from 'react'
import { Button } from '@/components/ui/button'
import { OrderRow, OrderItemRow } from '@/lib/types'
import { authFetch } from '@/components/pos/PinLogin'
import { toast } from 'sonner'
import { ChefHat, RefreshCw } from 'lucide-react'
import type { Station, StationOrder } from './kitchen-station/constants'
import { stationDefaults, typeMapping } from './kitchen-station/constants'
import { StationStatsCards } from './kitchen-station/StationStatsCards'
import { StationCard } from './kitchen-station/StationCard'

// ============================================
// KUHINJSKE POSTAJE — Upravljanje in prikaz
// ============================================
export const KitchenStationManager = memo(function KitchenStationManager() {
  const [stations, setStations] = useState<Station[]>([])
  const [_loading, setLoading] = useState(true)

  useEffect(() => {
    loadStations()
    const interval = setInterval(loadStations, 10000) // Osveži vsakih 10s
    return () => clearInterval(interval)
  }, [])

  const loadStations = async () => {
    try {
      // Naloži aktivna naročila
      const ordersRes = await authFetch('/api/orders?status=in_kitchen')
      const ordersData = await ordersRes.json()
      // Naloži zaposlene
      const empRes = await authFetch('/api/employees')
      const _empData = await empRes.json()

      // Razporedi naročila po postajah
      const stationMap: Record<string, StationOrder[]> = {}
      stationDefaults.forEach(s => { stationMap[s.id] = [] })

      ;(ordersData || []).forEach((order: OrderRow) => {
        const items = order.items || order.orderItems || []
        items.forEach((item: OrderItemRow) => {
          const cat = (item.category || item.itemName || '').toLowerCase()
          let stationId = 'general'
          for (const [keyword, sId] of Object.entries(typeMapping)) {
            if (cat.includes(keyword)) {
              stationId = sId
              break
            }
          }
          if (!stationMap[stationId]) stationId = 'prep'
          if (!stationMap[stationId]) stationId = 'grill'
          const startedAt = item.startedAt || order.createdAt
          const elapsed = startedAt
            ? Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000)
            : 0
          stationMap[stationId]?.push({
            id: item.id || `${order.id}-${item.menuItemId}`,
            orderId: order.id,
            itemName: item.itemName || item.name || 'Artikel',
            quantity: item.quantity || 1,
            priority: (item.priority || order.priority) === 'rush' ? 'rush' : (item.priority || order.priority) === 'high' ? 'high' : 'normal',
            startedAt,
            estimatedMinutes: item.prepTime || 10,
            elapsedMinutes: elapsed,
            notes: item.notes || item.specialInstructions || null,
          })
        })
      })

      // Zgradi postaje
      const activeStations: Station[] = stationDefaults.map(defaultStation => {
        const queue = stationMap[defaultStation.id] || []
        // Sortiraj po prioriteti
        queue.sort((a, b) => {
          const prio = { rush: 0, high: 1, normal: 2 }
          return prio[a.priority] - prio[b.priority]
        })
        return {
          ...defaultStation,
          queue,
          currentLoad: queue.length,
          lastOrderAt: queue.length > 0 ? queue[0].startedAt : null,
        }
      })
      setStations(activeStations)
    } catch {
      toast.error('Napaka pri nalaganju kuhinjskih postaj')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleStation = useCallback((stationId: string) => {
    setStations(prev => prev.map(s =>
      s.id === stationId
        ? { ...s, status: s.status === 'active' ? 'paused' : 'active' }
        : s
    ))
  }, [])

  const handleCompleteItem = useCallback(async (orderId: string, itemId: string) => {
    try {
      await authFetch(`/api/order-items/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ready' }),
      })
      await loadStations()
    } catch {
      toast.error('Napaka pri zaključevanju postavke')
    }
  }, [loadStations])

  // Memoizirani izračuni
  const stats = useMemo(() => ({
    totalOrders: stations.reduce((s, st) => s + st.currentLoad, 0),
    activeStations: stations.filter(s => s.status === 'active').length,
    overloadedStations: stations.filter(s => s.currentLoad >= s.capacity).length,
    avgLoad: stations.length > 0 ? stations.reduce((s, st) => s + (st.currentLoad / st.capacity) * 100, 0) / stations.length : 0,
  }), [stations])

  return (
    <div className="p-4 space-y-4 h-full overflow-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-100 dark:bg-rose-900/30">
            <ChefHat className="h-5 w-5 text-rose-600 dark:text-rose-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Kuhinjske postaje</h2>
            <p className="text-sm text-muted-foreground">Upravljanje kuhinjskih postaj in obremenitve</p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={loadStations}>
          <RefreshCw className="h-3 w-3 mr-1" /> Osveži
        </Button>
      </div>

      {/* Povzetek */}
      <StationStatsCards
        activeStations={stats.activeStations}
        totalOrders={stats.totalOrders}
        overloadedStations={stats.overloadedStations}
        avgLoad={stats.avgLoad}
      />

      {/* Postaje */}
      <div className="grid grid-cols-2 gap-3">
        {stations.map(station => (
          <StationCard
            key={station.id}
            station={station}
            onToggleStation={handleToggleStation}
            onCompleteItem={handleCompleteItem}
          />
        ))}
      </div>
    </div>
  )
})
