'use client'
import { useCallback, useMemo, memo } from 'react'
import { Button } from '@/components/ui/button'
import { authFetch } from '@/components/pos/PinLogin'
import { toast } from 'sonner'
import { ChefHat, RefreshCw } from 'lucide-react'
import { StationStatsCards } from './kitchen-station/StationStatsCards'
import { StationCard } from './kitchen-station/StationCard'
import { useStationData } from './useStationData'

export const KitchenStationManager = memo(function KitchenStationManager() {
  const { stations, setStations, loadStations } = useStationData()

  const handleToggleStation = useCallback((stationId: string) => {
    setStations(prev => prev.map(s =>
      s.id === stationId ? { ...s, status: s.status === 'active' ? 'paused' : 'active' } : s
    ))
  }, [setStations])

  const handleCompleteItem = useCallback(async (_orderId: string, itemId: string) => {
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
      <StationStatsCards activeStations={stats.activeStations} totalOrders={stats.totalOrders} overloadedStations={stats.overloadedStations} avgLoad={stats.avgLoad} />
      <div className="grid grid-cols-2 gap-3">
        {stations.map(station => (
          <StationCard key={station.id} station={station} onToggleStation={handleToggleStation} onCompleteItem={handleCompleteItem} />
        ))}
      </div>
    </div>
  )
})
