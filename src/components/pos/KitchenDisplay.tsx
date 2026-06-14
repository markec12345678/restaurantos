'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { ChefHat, Clock, AlertTriangle, Volume2, VolumeX, RefreshCw, Grid3X3, List, Maximize, Minimize, Wifi, WifiOff } from 'lucide-react'
import { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react'
import { useKitchenWebSocket } from '@/lib/websocket-client'
import { queryKeys } from '@/lib/query-keys'
import { KDSData } from './kitchen/types'
import { soundManager } from './kitchen/kitchen-sound'
import { useFullscreen } from './kitchen/use-fullscreen'
import { KitchenOrderCard } from './kitchen/KitchenOrderCard'

// ============================================
// GLAVNA KDS KOMPONENTA
// ============================================
export const KitchenDisplay = memo(function KitchenDisplay() {
  const queryClient = useQueryClient()
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards')
  // FIX MEDIUM: Inicializiraj soundEnabled iz soundManager singletona — prepreči divergenco
  const [soundEnabled, setSoundEnabled] = useState(() => soundManager.isEnabled())
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'in-progress'>('all')
  const [stationFilter, setStationFilter] = useState<'all' | 'kuhinja' | 'sank'>('all')
  const [_lastOrderCount, _setLastOrderCount] = useState(0)
  const prevOrdersRef = useRef<string[]>([])
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen()

  // WebSocket za real-time posodobitve
  const { connected: wsConnected, lastEvent: wsLastEvent } = useKitchenWebSocket({
    onEvent: (msg) => {
      // FIX HIGH: Ne predvajaj zvoka tukaj — zvok se predvaja v useEffect spodaj
      // S tem se izognemo dvojnemu zvoku (WS + polling detection)
      if (msg.type === 'NEW_ORDER') {
        toast.info(`🍽️ Novo naročilo!`, { duration: 3000 })
      }
      if (msg.type === 'ORDER_CANCELLED' && soundEnabled) {
        soundManager.playUrgent()
      }
    },
  })

  // Fetch KDS data — uporabi polling samo kot fallback, ko WebSocket ni povezan
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.kitchen.all,
    queryFn: async () => {
      const res = await authFetch('/api/kitchen')
      return res.json() as Promise<KDSData>
    },
    // Ko je WS povezan, ne potrebujemo pogostega pollinga (samo vsakih 30s za zagotovitev)
    // Ko WS ni povezan, pollamo vsakih 5s kot fallback
    refetchInterval: wsConnected ? 30000 : 5000,
  })

  // Ob vsakem WS dogodku takoj invalidiraj poizvedbe
  useEffect(() => {
    if (wsLastEvent) {
      queryClient.invalidateQueries({ queryKey: queryKeys.kitchen.all })
    }
  }, [wsLastEvent, queryClient])

  // Detect new orders for sound notification
  useEffect(() => {
    if (!data?.orders) return

    const currentOrderIds = data.orders.map(o => o.id)
    const newOrders = currentOrderIds.filter(id => !prevOrdersRef.current.includes(id))

    if (newOrders.length > 0 && prevOrdersRef.current.length > 0) {
      // New order detected!
      if (soundEnabled) {
        soundManager.playNewOrder()
      }
      toast.info(`🍽️ ${newOrders.length > 1 ? `${newOrders.length} nova naročila` : 'Novo naročilo'}!`, {
        duration: 3000,
      })
    }

    // Check for urgent orders
    const urgentOrders = data.orders.filter(o => o.urgency === 'critical')
    if (urgentOrders.length > 0 && soundEnabled) {
      // Play urgent sound for very old orders
      const veryUrgent = urgentOrders.filter(o => o.waitMinutes >= 25)
      if (veryUrgent.length > 0) {
        soundManager.playUrgent()
      }
    }

    prevOrdersRef.current = currentOrderIds
  }, [data?.orders, soundEnabled])

  // Item status mutation
  const itemStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await authFetch(`/api/order-items/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Failed to update item')
      return res.json()
    },
    onSuccess: (_, variables) => {
      if (variables.status === 'ready' && soundEnabled) {
        soundManager.playItemReady()
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.kitchen.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
    },
    onError: () => {
      toast.error('Napaka pri posodobitvi statusa')
    },
  })

  // Order status mutation
  const orderStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await authFetch(`/api/orders/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Failed to update order')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.kitchen.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.all })
      toast.success('Status naročila posodobljen')
    },
  })

  const handleItemStatusChange = useCallback((itemId: string, status: string) => {
    itemStatusMutation.mutate({ id: itemId, status })
  }, [itemStatusMutation])

  const handleOrderStatusChange = useCallback((orderId: string, status: string) => {
    orderStatusMutation.mutate({ id: orderId, status })
  }, [orderStatusMutation])

  const handleToggleSound = useCallback(() => {
    const enabled = soundManager.toggle()
    setSoundEnabled(enabled)
  }, [])

  // Filter orders by status — memoiziraj, da se ne preračuna ob vsakem renderju
  const filteredOrders = useMemo(() => {
    return (data?.orders || []).filter(order => {
      if (filterStatus === 'all') return true
      return order.status === filterStatus
    })
  }, [data?.orders, filterStatus])

  // Separate into columns by urgency for cards view — memoiziraj
  const { urgentOrders, warningOrders, normalOrders } = useMemo(() => ({
    urgentOrders: filteredOrders.filter(o => o.urgency === 'critical'),
    warningOrders: filteredOrders.filter(o => o.urgency === 'warning'),
    normalOrders: filteredOrders.filter(o => o.urgency === 'normal'),
  }), [filteredOrders])

  const stats = data?.stats

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* HEADER - Stats & Controls */}
      <div className="flex-shrink-0 border-b bg-card">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <ChefHat className="h-5 w-5 text-primary" />
              <h1 className="text-lg font-bold">Kuhinjski zaslon</h1>
            </div>
            {/* Station filter - Kuhinja/Šank/Vse */}
            <div className="flex border rounded-lg overflow-hidden ml-2">
              {[
                { value: 'all' as const, label: 'Vse', icon: '📋' },
                { value: 'kuhinja' as const, label: 'Kuhinja', icon: '🍳' },
                { value: 'sank' as const, label: 'Šank', icon: '🍹' },
              ].map(station => (
                <button
                  key={station.value}
                  onClick={() => setStationFilter(station.value)}
                  className={`px-3 py-1 text-xs font-semibold transition-colors touch-manipulation ${
                    stationFilter === station.value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-accent'
                  }`}
                >
                  {station.icon} {station.label}
                </button>
              ))}
            </div>
            {stats && (
              <div className="flex gap-2">
                <Badge variant="outline" className="text-xs h-6">
                  <span className="h-2 w-2 rounded-full bg-yellow-400 mr-1.5" />
                  {stats.pendingOrders} čakajočih
                </Badge>
                <Badge variant="outline" className="text-xs h-6">
                  <span className="h-2 w-2 rounded-full bg-blue-400 mr-1.5" />
                  {stats.inProgressOrders} v pripravi
                </Badge>
                {stats.criticalOrders > 0 && (
                  <Badge variant="destructive" className="text-xs h-6">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {stats.criticalOrders} nujnih!
                  </Badge>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Sound toggle */}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Zvok"
              className="h-8 w-8"
              onClick={handleToggleSound}
              title={soundEnabled ? 'Izklopi zvok' : 'Vklopi zvok'}
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
            </Button>

            {/* View mode */}
            <div className="flex border rounded-md">
              <Button
                variant={viewMode === 'cards' ? 'default' : 'ghost'}
                size="icon"
                aria-label="Kartični pogled"
                className="h-8 w-8 rounded-r-none"
                onClick={() => setViewMode('cards')}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="icon"
                aria-label="Seznamni pogled"
                className="h-8 w-8 rounded-l-none"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>

            {/* Refresh */}
            <Button
              variant="ghost"
              size="icon"
              aria-label="Osveži"
              className="h-8 w-8"
              onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.kitchen.all })}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>

            {/* Fullscreen */}
            <Button
              variant={isFullscreen ? 'default' : 'ghost'}
              size="icon"
              aria-label="Cel zaslon"
              className="h-8 w-8"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Izhod iz cel. zaslona' : 'Celozaslonski način'}
            >
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="px-4 pb-2 flex gap-1.5">
          {[
            { value: 'all', label: 'Vsa naročila', count: filteredOrders.length },
            { value: 'pending', label: 'Čakajoča', count: data?.stats?.pendingOrders || 0 },
            { value: 'in-progress', label: 'V pripravi', count: data?.stats?.inProgressOrders || 0 },
          ].map(tab => (
            <button
              key={tab.value}
              onClick={() => setFilterStatus(tab.value as typeof filterStatus)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                filterStatus === tab.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {isLoading ? (
          <div className={viewMode === 'cards'
            ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'
            : 'space-y-3 max-w-4xl mx-auto'
          }>
            {[...Array(6)].map((_, i) => <Skeleton key={i} className={viewMode === 'cards' ? 'h-64' : 'h-32'} />)}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
            <ChefHat className="h-16 w-16 opacity-20" />
            <div className="text-center">
              <p className="text-lg font-medium">Kuhinja je prosta</p>
              <p className="text-sm">Ni aktivnih naročil za pripravo</p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              {wsConnected ? (
                <>
                  <Wifi className="h-3 w-3 text-emerald-500" />
                  Real-time povezava
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"><span className="sr-only">Osveževanje</span></span>
                  Samodejno osveževanje vsakih 5s
                </>
              )}
            </div>
          </div>
        ) : viewMode === 'cards' ? (
          /* CARDS VIEW - Prioritized columns */
          <div className="space-y-6">
            {/* Urgent orders - always visible first */}
            {urgentOrders.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <h3 className="text-sm font-bold text-red-600">NUJNO - Čaka več kot 20 min</h3>
                  <Badge variant="destructive" className="text-xs">{urgentOrders.length}</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {urgentOrders.map(order => (
                    <KitchenOrderCard
                      key={order.id}
                      order={order}
                      onItemStatusChange={handleItemStatusChange}
                      onOrderStatusChange={handleOrderStatusChange}
                      viewMode="cards"
                      stationFilter={stationFilter}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Warning orders */}
            {warningOrders.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-4 w-4 text-amber-500" />
                  <h3 className="text-sm font-bold text-amber-600">OPOZORILO - Čaka 10-20 min</h3>
                  <Badge variant="outline" className="text-xs border-amber-400 text-amber-600">{warningOrders.length}</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {warningOrders.map(order => (
                    <KitchenOrderCard
                      key={order.id}
                      order={order}
                      onItemStatusChange={handleItemStatusChange}
                      onOrderStatusChange={handleOrderStatusChange}
                      viewMode="cards"
                      stationFilter={stationFilter}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Normal orders */}
            {normalOrders.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <h3 className="text-sm font-bold text-muted-foreground">Aktivna naročila</h3>
                  <Badge variant="outline" className="text-xs">{normalOrders.length}</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {normalOrders.map(order => (
                    <KitchenOrderCard
                      key={order.id}
                      order={order}
                      onItemStatusChange={handleItemStatusChange}
                      onOrderStatusChange={handleOrderStatusChange}
                      viewMode="cards"
                      stationFilter={stationFilter}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* LIST VIEW - Compact */
          <div className="space-y-3 max-w-5xl mx-auto">
            {filteredOrders.map(order => (
              <KitchenOrderCard
                key={order.id}
                order={order}
                onItemStatusChange={handleItemStatusChange}
                onOrderStatusChange={handleOrderStatusChange}
                viewMode="list"
                stationFilter={stationFilter}
              />
            ))}
          </div>
        )}
      </div>

      {/* FOOTER - Live stats */}
      {stats && (
        <div className="flex-shrink-0 border-t bg-card px-4 py-2 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>Povpr. čakalna doba: <strong className={stats.avgWaitTime >= 10 ? 'text-amber-600' : ''}>{stats.avgWaitTime} min</strong></span>
            <span>Artikli: <strong>{stats.totalItemsPending}</strong> čaka / <strong>{stats.totalItemsPreparing}</strong> v pripravi / <strong className="text-emerald-600">{stats.totalItemsReady}</strong> pripravljeni</span>
          </div>
          <div className="flex items-center gap-2">
            {wsConnected ? (
              <>
                <Wifi className="h-3 w-3 text-emerald-500" />
                <span>Real-time</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3 text-amber-500" />
                <span>Polling: 5s</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
})
