'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { Bell, BellRing, ShoppingCart, UtensilsCrossed, RefreshCw, Wifi, WifiOff, HandMetal } from 'lucide-react'
import { toast } from 'sonner'
import { ErrorBoundary } from '@/components/error-boundary'
import { queryKeys } from '@/lib/query-keys'
import dynamic from 'next/dynamic'

import type { WaiterNotification, Order } from './types'
import { useWaiterSound } from './useWaiterSound'

// Lazy-load podkomponente
const WaiterLogin = dynamic(() => import('./WaiterLogin').then(m => ({ default: m.WaiterLogin })), { ssr: false })
const ReadyTab = dynamic(() => import('./ReadyTab').then(m => ({ default: m.ReadyTab })), { ssr: false })
const OrdersTab = dynamic(() => import('./OrdersTab').then(m => ({ default: m.OrdersTab })), { ssr: false })

// ═══════════════════════════════════════════════════════════════
// GOSTILNA POS — Natakarjeva tablica (/waiter)
// Optimiziran pogled za natakarjev Android/iPad:
// - Moje mize in naročila
// - Pripravljeni artikli iz kuhinje
// - Hitro dodajanje naročil
// - Plačevanje na mizi
// ═══════════════════════════════════════════════════════════════

export default function WaiterPage() {
  const queryClient = useQueryClient()
  const [employee, setEmployee] = useState<{ id: string; name: string; role: string } | null>(null)
  const [activeTab, setActiveTab] = useState<'ready' | 'myorders' | 'alltables'>('ready')
  const [notifications, setNotifications] = useState<WaiterNotification[]>([])
  const [now, setNow] = useState(Date.now())
  const [wsConnected, setWsConnected] = useState(false)
  const playSound = useWaiterSound()

  // Refs for setTimeout cleanup on unmount
  const timeoutRefs = useRef<NodeJS.Timeout[]>([])

  // Cleanup all timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach(clearTimeout)
    }
  }, [])

  // Obnovi sejo
  useEffect(() => {
    try {
      const stored = localStorage.getItem('pos_employee')
      if (stored) {
        const emp = JSON.parse(stored)
        if (emp?.id && emp?.name && emp?.role) setEmployee(emp)
      }
    } catch {
      // Poškodovani podatki v localStorage — zahtevaj ponovno prijavo
    }
  }, [])

  // Timer
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 10000); return () => clearInterval(i) }, [])

  // ─── WebSocket za POS obvestila ───
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws`
    let ws: WebSocket | null = null
    let retries = 0

    const connect = () => {
      try {
        ws = new WebSocket(wsUrl)
        ws.onopen = () => { setWsConnected(true); retries = 0 }
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            if (data.type === 'order_ready' && data.data) {
              const d = data.data
              // Filtriraj: prikaži samo če je to natakarjevo naročilo ALI če ni dodeljeno
              const isMyOrder = !d.waiterId || d.waiterId === employee?.id
              if (isMyOrder) {
                const notif: WaiterNotification = {
                  id: `w_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                  orderId: d.orderId, orderNumber: d.orderNumber,
                  tableName: d.tableName, tableNumber: d.tableNumber,
                  waiterName: d.waiterName, itemName: d.itemName, itemQuantity: d.itemQuantity,
                  allReady: d.allReady, readyCount: d.readyCount, totalItems: d.totalItems,
                  readyItems: d.readyItems || [], timestamp: Date.now(), acknowledged: false,
                }
                setNotifications(prev => [notif, ...prev].slice(0, 20))
                playSound()
                // Vibrate na Androidu
                if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200])
              }
            }
            if (data.type === 'order_update') {
              queryClient.invalidateQueries({ queryKey: queryKeys.orders.waiter })
            }
          } catch {
            // Neveljavno sporočilo WebSocket — ignoriraj
          }
        }
        ws.onclose = () => { setWsConnected(false); ws = null; if (retries < 20) { retries++; setTimeout(connect, 5000) } }
        ws.onerror = () => { ws?.close() }
      } catch {
        // WebSocket povezava ni uspela — poskusi znova v onclose
      }
    }
    connect()
    return () => { ws?.close() }
  }, [employee, playSound, queryClient])

  // ─── Pridobi naročila ───
  const { data: ordersData, isLoading, refetch } = useQuery({
    queryKey: queryKeys.orders.waiter,
    queryFn: async () => {
      const token = localStorage.getItem('pos_token')
      const headers: Record<string, string> = {}
      if (token) headers.Authorization = `Bearer ${token}`

      // FIX: Backend uses lowercase statuses: pending, in-progress, ready, completed
      const statuses = ['pending', 'in-progress', 'ready']
      const results = await Promise.all(
        statuses.map(s => fetch(`/api/orders?status=${encodeURIComponent(s)}`, { headers }).then(r => r.json()))
      )
      return results.flatMap(r => r.orders || []) as Order[]
    },
    refetchInterval: 10000,
    enabled: !!employee,
  })

  const allOrders = ordersData || []

  // Moja naročila (kjer je natakar = jaz)
  const myOrders = employee
    ? allOrders.filter(o => o.employee?.id === employee.id)
    : []

  // Naročila s pripravljenimi artikli
  // FIX: Backend item statuses are lowercase: ready, served, cancelled
  const ordersWithReady = allOrders.filter(o =>
    o.items.some(i => i.status === 'ready') && !['completed', 'cancelled'].includes(o.status)
  )

  // ─── Akcije ───
  const handleMarkServed = async (orderId: string, itemIds?: string[]) => {
    try {
      if (itemIds && itemIds.length > 0) {
        // Označi posamezne artikle kot SERVED
        await Promise.all(itemIds.map(itemId =>
          fetch(`/api/orders/${orderId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('pos_token')}` },
            body: JSON.stringify({ action: 'item_status', itemId, status: 'served' }),
          })
        ))
      } else {
        // Označi vse ready artikle kot SERVED
        const order = allOrders.find(o => o.id === orderId)
        if (!order) return
        const readyItems = order.items.filter(i => i.status === 'ready')
        await Promise.all(readyItems.map(item =>
          fetch(`/api/orders/${orderId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('pos_token')}` },
            body: JSON.stringify({ action: 'item_status', itemId: item.id, status: 'served' }),
          })
        ))
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.waiter })
      toast.success('Artikli označeni kot postreženi!')
    } catch { toast.error('Napaka') }
  }

  const acknowledge = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, acknowledged: true } : n))
    const timeout = setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 2000)
    timeoutRefs.current.push(timeout)
  }, [])

  const getElapsed = useCallback((dateStr: string | null) => {
    if (!dateStr) return 0
    return Math.floor((now - new Date(dateStr).getTime()) / 60000)
  }, [now])

  // ─── Če ni prijavljen ───
  if (!employee) return <WaiterLogin onLogin={setEmployee} />

  // ─── Pripravljena naročila iz kuhinje ───
  const unacknowledged = notifications.filter(n => !n.acknowledged)

  return (
    <ErrorBoundary context="Waiter" maxRetries={3}>
    <div className="flex flex-col h-screen bg-background">
      {/* ─── HEADER ─── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-card shadow-sm">
        <div className="flex items-center gap-3">
          <HandMetal className="w-6 h-6 text-blue-500" />
          <h1 className="text-lg font-bold">Natakar</h1>
          <span className="text-sm text-muted-foreground">{employee.name}</span>
        </div>
        <div className="flex items-center gap-2">
          {unacknowledged.length > 0 && (
            <button onClick={() => setActiveTab('ready')}
              className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-bold animate-pulse touch-manipulation min-h-[40px]">
              <BellRing className="w-4 h-4" />
              {unacknowledged.length} pripravljenih
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center font-bold">{unacknowledged.length}</span>
            </button>
          )}
          <button onClick={() => refetch()} className="w-9 h-9 flex items-center justify-center rounded-lg bg-secondary hover:bg-secondary/80 touch-manipulation min-h-[44px]" aria-label="Osveži">
            <RefreshCw className="w-4 h-4" />
          </button>
          <div className={cn('flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg font-medium', wsConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800')}>
            {wsConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {wsConnected ? 'Live' : 'Offline'}
          </div>
        </div>
      </div>

      {/* ─── TAB NAVIGACIJA ─── */}
      <div className="flex border-b bg-card">
        {[
          { key: 'ready' as const, label: 'Pripravljeno', icon: Bell, count: ordersWithReady.length + unacknowledged.length, color: 'text-amber-600' },
          { key: 'myorders' as const, label: 'Moja naročila', icon: ShoppingCart, count: myOrders.length, color: 'text-blue-600' },
          { key: 'alltables' as const, label: 'Vse mize', icon: UtensilsCrossed, count: allOrders.length, color: 'text-emerald-600' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors touch-manipulation min-h-[48px] relative',
              activeTab === tab.key
                ? 'text-primary border-b-2 border-primary bg-primary/5'
                : 'text-muted-foreground hover:text-foreground'
            )}>
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.count > 0 && (
              <span className={cn(
                'min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full flex items-center justify-center',
                activeTab === tab.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              )}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ─── VSEBINA ─── */}
      <div className="flex-1 overflow-y-auto pos-scroll">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (<div key={i} className="h-32 rounded-xl bg-muted animate-pulse" />))}
          </div>
        ) : activeTab === 'ready' ? (
          <ReadyTab
            notifications={unacknowledged}
            orders={ordersWithReady}
            onAcknowledge={acknowledge}
            onMarkServed={handleMarkServed}
            getElapsed={getElapsed}
          />
        ) : activeTab === 'myorders' ? (
          <OrdersTab orders={myOrders} onMarkServed={handleMarkServed} getElapsed={getElapsed} />
        ) : (
          <OrdersTab orders={allOrders} onMarkServed={handleMarkServed} getElapsed={getElapsed} />
        )}
      </div>
    </div>
    </ErrorBoundary>
  )
}
