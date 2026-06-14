'use client'
// ═══════════════════════════════════════════════════════════════
// RestaurantOS — KDS (Kitchen Display System) Standalone
// Celozaslonski kuhinjski zaslon za samostojno uporabo
// - PIN prijava (kuharji, chefi)
// - Bump bar / mrežni pogled
// - Postaje (vroča, hladna, bar, pekarna)
// - Časovniki z barvnimi opozorili
// - Zvočno opozorilo za nova naročila
// - Celozaslonski način
// - WebSocket real-time posodobitve
// ═══════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ErrorBoundary } from '@/components/error-boundary'
import { queryKeys } from '@/lib/query-keys'
import dynamic from 'next/dynamic'

import type { OrderKDS } from './types'
import { useKDSSound } from './use-kds-sound'

// Lazy-load podkomponente
const KDSLogin = dynamic(() => import('./KDSLogin').then(m => ({ default: m.KDSLogin })), { ssr: false })
const KDSHeader = dynamic(() => import('./KDSHeader').then(m => ({ default: m.KDSHeader })), { ssr: false })
const KDSOrderGrid = dynamic(() => import('./KDSOrderGrid').then(m => ({ default: m.KDSOrderGrid })), { ssr: false })

// ─── Glavna KDS stran ──────────────────────────────────────────
export default function KDSPage() {
  const queryClient = useQueryClient()
  const [employee, setEmployee] = useState<{ id: string; name: string; role: string } | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [stationFilter, setStationFilter] = useState<string>('all')
  const [_showRecall, setShowRecall] = useState(false)
  const [wsConnected, setWsConnected] = useState(false)
  const [now, setNow] = useState(Date.now())
  const [bumpedOrders, setBumpedOrders] = useState<string[]>([])
  const { play: playSound, toggle: toggleSound, isEnabled: isSoundEnabled } = useKDSSound()

  // Obnovi sejo
  useEffect(() => {
    try {
      const stored = localStorage.getItem('pos_employee')
      if (stored) {
        const emp = JSON.parse(stored)
        if (emp?.id && emp?.name && emp?.role) setEmployee(emp)
      }
    } catch {
      // Poškodovani podatki v localStorage — ignoriraj in zahtevaj ponovno prijavo
    }
  }, [])

  // Timer
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i) }, [])

  // Celozaslonski način
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }

  // ─── WebSocket ───
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    // FIX: WebSocket server path is /ws (exact match), not /ws/kds
    const wsUrl = `${protocol}//${window.location.host}/ws`
    let ws: WebSocket | null = null
    let retries = 0
    const connect = () => {
      try {
        ws = new WebSocket(wsUrl)
        ws.onopen = () => {
          setWsConnected(true); retries = 0
          // FIX: Send AUTH message within 10 seconds or server closes connection
          const token = localStorage.getItem('pos_token')
          if (token) {
            ws?.send(JSON.stringify({ type: 'AUTH', token }))
          }
        }
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            if (data.type === 'new_order' || data.type === 'order_update' || data.type === 'order_ready') {
              queryClient.invalidateQueries({ queryKey: queryKeys.orders.kds })
              if (data.type === 'new_order') {
                playSound()
                if (navigator.vibrate) navigator.vibrate([200, 100, 200])
              }
            }
          } catch {
            // Neveljavno sporočilo WebSocket — ignoriraj
          }
        }
        ws.onclose = () => { setWsConnected(false); ws = null; if (retries < 30) { retries++; setTimeout(connect, 3000) } }
        ws.onerror = () => { ws?.close() }
      } catch {
        // WebSocket povezava ni uspela — poskusi znova v onclose
      }
    }
    if (employee) connect()
    return () => { ws?.close() }
  }, [employee, playSound, queryClient])

  // ─── Pridobi aktivna naročila ───
  const { data: ordersData, isLoading, refetch } = useQuery({
    queryKey: queryKeys.orders.kds,
    queryFn: async () => {
      const token = localStorage.getItem('pos_token')
      const headers: Record<string, string> = {}
      if (token) headers.Authorization = `Bearer ${token}`
      // FIX: Fetch ALL active kitchen statuses, not just pending
      const [pendingRes, inProgressRes, readyRes] = await Promise.all([
        fetch('/api/orders?status=pending&limit=50', { headers }),
        fetch('/api/orders?status=in-progress&limit=50', { headers }),
        fetch('/api/orders?status=ready&limit=50', { headers }),
      ])
      if (!pendingRes.ok || !inProgressRes.ok || !readyRes.ok) throw new Error('Napaka pri nalaganju')
      const [pendingData, inProgressData, readyData] = await Promise.all([
        pendingRes.json(), inProgressRes.json(), readyRes.json(),
      ])
      const allOrders = [
        ...(pendingData.orders || pendingData || []),
        ...(inProgressData.orders || inProgressData || []),
        ...(readyData.orders || readyData || []),
      ] as OrderKDS[]
      // Deduplicate by id (in case of overlap)
      const seen = new Set<string>()
      return allOrders.filter(o => { if (seen.has(o.id)) return false; seen.add(o.id); return true })
    },
    refetchInterval: 5000,
    enabled: !!employee,
  })

  const allOrders = ordersData || []

  // Filtriraj: samo aktivna naročila z nerazvrščenimi artikli
  const activeOrders = useMemo(() =>
    allOrders.filter(o =>
      !bumpedOrders.includes(o.id) &&
      o.items?.some(i => !['served', 'cancelled'].includes(i.status))
    ), [allOrders, bumpedOrders]
  )

  // Postaje
  const stations = useMemo(() => {
    const s = new Set<string>()
    activeOrders.forEach(o => o.items?.forEach(i => { if (i.station) s.add(i.station) }))
    return ['all', ...Array.from(s)]
  }, [activeOrders])

  const filteredOrders = stationFilter === 'all'
    ? activeOrders
    : activeOrders.map(o => ({
        ...o,
        // FIX: Backend item statuses are lowercase; only show items for this station or unassigned
      items: o.items.filter(i => !i.station || i.station === stationFilter || i.status === 'ready')
      })).filter(o => o.items.some(i => !['served', 'cancelled'].includes(i.status)))

  const getElapsed = useCallback((dateStr: string | null) => {
    if (!dateStr) return 0
    return Math.floor((now - new Date(dateStr).getTime()) / 60000)
  }, [now])

  // ─── Akcije ───
  const handleBump = async (orderId: string) => {
    const order = activeOrders.find(o => o.id === orderId)
    if (!order) return
    // FIX: Backend item statuses are lowercase
    const activeItems = order.items.filter(i => !['served', 'cancelled'].includes(i.status))
    try {
      await Promise.all(activeItems.map(item =>
        fetch(`/api/orders/${orderId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('pos_token')}` },
          body: JSON.stringify({ action: 'item_status', itemId: item.id, status: 'ready' }),
        }).then(res => { if (!res.ok) throw new Error('Napaka') })
      ))
      setBumpedOrders(prev => [...prev, orderId])
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.kds })
      toast.success(`Naročilo #${order.orderNumber} bump!`)
    } catch { toast.error('Napaka pri bump') }
  }

  const handleBumpItem = async (orderId: string, itemId: string) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('pos_token')}` },
        // FIX: Backend item status is lowercase
        body: JSON.stringify({ action: 'item_status', itemId, status: 'ready' }),
      })
      if (!res.ok) throw new Error('Napaka')
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.kds })
    } catch { toast.error('Napaka') }
  }

  const handleRecall = () => {
    setBumpedOrders([])
    setShowRecall(false)
  }

  // ─── Če ni prijavljen ───
  if (!employee) return <KDSLogin onLogin={setEmployee} />

  // ─── Render ───
  return (
    <ErrorBoundary context="KDS" maxRetries={3}>
    <div className="flex flex-col h-screen bg-background">
      <KDSHeader
        employeeName={employee.name}
        activeOrderCount={activeOrders.length}
        stations={stations}
        stationFilter={stationFilter}
        onStationFilterChange={setStationFilter}
        viewMode={viewMode}
        onViewModeToggle={() => setViewMode(v => v === 'grid' ? 'list' : 'grid')}
        isSoundEnabled={isSoundEnabled}
        onToggleSound={toggleSound}
        bumpedCount={bumpedOrders.length}
        onRecall={handleRecall}
        onRefresh={() => refetch()}
        wsConnected={wsConnected}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
      />
      <div className="flex-1 overflow-hidden">
        <KDSOrderGrid
          isLoading={isLoading}
          orders={filteredOrders}
          viewMode={viewMode}
          onBump={handleBump}
          onBumpItem={handleBumpItem}
          getElapsed={getElapsed}
        />
      </div>
    </div>
    </ErrorBoundary>
  )
}
