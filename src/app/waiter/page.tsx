'use client'

// ═══════════════════════════════════════════════════════════════
// GOSTILNA POS — Natakarjeva tablica (/waiter)
// Optimiziran pogled za natakarjev Android/iPad:
// - Moje mize in naročila
// - Pripravljeni artikli iz kuhinje
// - Hitro dodajanje naročil
// - Plačevanje na mizi
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { Bell, BellRing, CheckCircle, ShoppingCart, UtensilsCrossed, RefreshCw, Wifi, WifiOff, ShoppingBag, ChevronRight, HandMetal } from 'lucide-react'
import { toast } from 'sonner'
import { ErrorBoundary } from '@/components/error-boundary'
import { queryKeys } from '@/lib/query-keys'

// ─── Tipi ──────────────────────────────────────────────────────
interface ReadyItem { name: string; quantity: number }

interface WaiterNotification {
  id: string
  orderId: string
  orderNumber: number
  tableName: string | null
  tableNumber: number | null
  waiterName: string | null
  itemName: string
  itemQuantity: number
  allReady: boolean
  readyCount: number
  totalItems: number
  readyItems: ReadyItem[]
  timestamp: number
  acknowledged: boolean
}

interface OrderItem {
  id: string
  name: string
  quantity: number
  status: string
  price: number
  notes: string | null
  station: string | null
  course: number
  modifiers: { name: string; priceDelta: number }[]
}

interface Order {
  id: string
  orderNumber: number
  type: string
  status: string
  table: { id: string; number: number; name: string | null } | null
  employee: { id: string; name: string }
  items: OrderItem[]
  total: number
  subtotal: number
  vatAmount: number
  firedAt: string | null
  createdAt: string
  notes: string | null
}

// ─── PIN Login ─────────────────────────────────────────────────
function WaiterLogin({ onLogin }: { onLogin: (_emp: { id: string; name: string; role: string }) => void }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (pin.length < 4) { setError('Vnesite PIN'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Napaka'); return }
      const data = await res.json()
      localStorage.setItem('pos_token', data.token)
      localStorage.setItem('pos_employee', JSON.stringify(data.employee))
      onLogin(data.employee)
    } catch { setError('Povezava ni na voljo') }
    finally { setLoading(false) }
  }

  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30">
      <div className="w-full max-w-sm mx-4">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-blue-500 mx-auto mb-4 flex items-center justify-center shadow-lg">
            <HandMetal className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold">Natakarjeva tablica</h1>
          <p className="text-muted-foreground mt-1 text-sm">Prijavite se za dostop</p>
        </div>
        <div className="bg-card rounded-2xl border shadow-xl p-6 space-y-4">
          <input type="password" inputMode="numeric" maxLength={6} value={pin}
            onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setError('') }}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            placeholder="Vnesite PIN" autoFocus
            className="w-full text-center text-3xl tracking-[0.5em] font-mono py-4 px-4 rounded-xl border-2 focus:border-blue-500 focus:outline-none bg-background" />
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button onClick={handleLogin} disabled={loading || pin.length < 4}
            className="w-full py-4 rounded-xl bg-blue-500 text-white font-bold text-lg hover:bg-blue-600 disabled:opacity-50 transition-colors">
            {loading ? 'Prijava...' : 'Prijava'}
          </button>
          <div className="pt-2 border-t">
            <p className="text-[10px] text-muted-foreground text-center mb-2">Demo PIN-i</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setPin('1111')} className="py-2 px-3 rounded-lg bg-muted text-xs font-medium hover:bg-muted/80">Natakar 1111</button>
              <button onClick={() => setPin('1234')} className="py-2 px-3 rounded-lg bg-muted text-xs font-medium hover:bg-muted/80">Admin 1234</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Zvočni sistem ─────────────────────────────────────────────
function useWaiterSound() {
  const audioRef = useRef<AudioContext | null>(null)
  const play = useCallback(() => {
    try {
      if (!audioRef.current) audioRef.current = new (window.AudioContext || window.webkitAudioContext)()
      const ctx = audioRef.current
      const notes = [660, 880, 1100]
      notes.forEach((freq, i) => {
        setTimeout(() => {
          const osc = ctx.createOscillator(); const gain = ctx.createGain()
          osc.connect(gain); gain.connect(ctx.destination)
          osc.frequency.value = freq; osc.type = 'sine'
          gain.gain.setValueAtTime(0.2, ctx.currentTime)
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)
          osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3)
        }, i * 250)
      })
    } catch {
      // Web Audio API ni podprt ali uporabnik ni interaktiral s stranjo
    }
  }, [])
  return play
}

// ─── Glavna stran ──────────────────────────────────────────────
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
        // FIX: Backend item status values are lowercase
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
        // FIX: Backend item status values are lowercase
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

  const acknowledge = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, acknowledged: true } : n))
    const timeout = setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 2000)
    timeoutRefs.current.push(timeout)
  }

  const getElapsed = (dateStr: string | null) => {
    if (!dateStr) return 0
    return Math.floor((now - new Date(dateStr).getTime()) / 60000)
  }

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
          <button onClick={() => refetch()} className="w-9 h-9 flex items-center justify-center rounded-lg bg-secondary hover:bg-secondary/80 touch-manipulation min-h-[44px]">
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

// ─── READY TAB — Pripravljeni artikli ──────────────────────────
function ReadyTab({ notifications, orders, onAcknowledge, onMarkServed, getElapsed }: {
  notifications: WaiterNotification[]
  orders: Order[]
  onAcknowledge: (_id: string) => void
  onMarkServed: (_orderId: string, _itemIds?: string[]) => void
  getElapsed: (_d: string | null) => number
}) {
  if (notifications.length === 0 && orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
        <div className="w-24 h-24 rounded-3xl bg-emerald-50 dark:bg-emerald-950/20 flex items-center justify-center mb-4">
          <CheckCircle className="w-12 h-12 text-emerald-500 opacity-60" />
        </div>
        <p className="text-xl font-bold">Ni pripravljenih artiklov</p>
        <p className="text-sm mt-1">Čakam na obvestila iz kuhinje...</p>
      </div>
    )
  }

  return (
    <div className="p-3 space-y-3">
      {/* Aktivna obvestila — PRIPRABLJENO! */}
      {notifications.map(notif => (
        <div key={notif.id}
          className={cn(
            'rounded-2xl border-2 overflow-hidden animate-fade-in-up shadow-lg',
            notif.allReady ? 'border-emerald-500' : 'border-amber-500'
          )}>
          <div className={cn('flex items-center justify-between px-4 py-2.5', notif.allReady ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white')}>
            <div className="flex items-center gap-2">
              {notif.allReady ? <BellRing className="w-5 h-5 animate-bounce" /> : <Bell className="w-5 h-5" />}
              <span className="font-bold text-sm">{notif.allReady ? 'VSE PRIPRAVLJENO!' : 'Artikel pripravljen'}</span>
            </div>
            <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full">#{notif.orderNumber}</span>
          </div>
          <div className="px-4 py-3 space-y-2.5">
            {notif.tableNumber && (
              <div className="flex items-center gap-3">
                <span className={cn('text-3xl font-black px-5 py-2 rounded-xl',
                  notif.allReady ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-200 text-amber-900'
                )}>Miza {notif.tableNumber}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-base">
              <UtensilsCrossed className="w-4 h-4 text-muted-foreground" />
              <span className="font-semibold">{notif.itemQuantity}x {notif.itemName}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div className={cn('h-full rounded-full', notif.allReady ? 'bg-emerald-500' : 'bg-amber-500')}
                  style={{ width: `${(notif.readyCount / Math.max(notif.totalItems, 1)) * 100}%` }} />
              </div>
              <span className="text-xs font-bold">{notif.readyCount}/{notif.totalItems}</span>
            </div>
            <button onClick={() => { onAcknowledge(notif.id); onMarkServed(notif.orderId) }}
              className={cn('w-full py-3.5 rounded-xl font-bold text-base transition-all active:scale-95 touch-manipulation min-h-[52px]',
                notif.allReady ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-amber-500 text-white hover:bg-amber-600'
              )}>
              {notif.allReady ? (
                <span className="flex items-center justify-center gap-2">
                  <CheckCircle className="w-5 h-5" />PREVZEM — Miza {notif.tableNumber || '?'}
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <CheckCircle className="w-5 h-5" />PREVZEM
                </span>
              )}
            </button>
          </div>
        </div>
      ))}

      {/* Naročila s pripravljenimi artikli */}
      {orders.filter(o => !notifications.some(n => n.orderId === o.id)).map(order => {
        const readyItems = order.items.filter(i => i.status === 'ready')
        const pendingItems = order.items.filter(i => !['ready', 'cancelled', 'served'].includes(i.status))
        return (
          <div key={order.id} className="rounded-xl border bg-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg">#{order.orderNumber}</span>
                {order.table && <span className="text-base font-black px-3 py-1 rounded-lg bg-primary/15 text-primary">Miza {order.table.number}</span>}
              </div>
              <span className="text-xs text-muted-foreground">{getElapsed(order.firedAt)}min</span>
            </div>
            <div className="space-y-1">
              {readyItems.map(item => (
                <div key={item.id} className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-sm">
                  <span><b>{item.quantity}x</b> {item.name}</span>
                  <span className="text-xs text-emerald-600 font-bold">PRIPRABLJENO</span>
                </div>
              ))}
              {pendingItems.slice(0, 3).map(item => (
                <div key={item.id} className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 text-sm">
                  <span><b>{item.quantity}x</b> {item.name}</span>
                  <span className="text-xs text-amber-600 font-bold">V PRIPRAVI</span>
                </div>
              ))}
              {pendingItems.length > 3 && <p className="text-xs text-muted-foreground text-center">+{pendingItems.length - 3} več</p>}
            </div>
            {readyItems.length > 0 && (
              <button onClick={() => onMarkServed(order.id, readyItems.map(i => i.id))}
                className="w-full py-3 rounded-xl bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-600 active:scale-95 transition-all touch-manipulation min-h-[48px]">
                <CheckCircle className="w-4 h-4 inline mr-1" />Prevzemi pripravljene
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── ORDERS TAB — Seznam naročil ───────────────────────────────
function OrdersTab({ orders, onMarkServed, getElapsed }: {
  orders: Order[]
  onMarkServed: (_orderId: string, _itemIds?: string[]) => void
  getElapsed: (_d: string | null) => number
}) {
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
        <ShoppingCart className="w-12 h-12 opacity-40 mb-3" />
        <p className="text-lg font-bold">Ni naročil</p>
      </div>
    )
  }

  return (
    <div className="p-3 space-y-2">
      {orders.map(order => {
        const isExpanded = expandedOrder === order.id
        const readyItems = order.items.filter(i => i.status === 'ready')
        const elapsed = getElapsed(order.firedAt)
        const statusColor = order.status === 'ready' ? 'bg-emerald-500' : order.status === 'in-progress' ? 'bg-blue-500' : order.status === 'pending' ? 'bg-orange-500' : 'bg-muted'

        return (
          <div key={order.id} className="rounded-xl border bg-card overflow-hidden">
            <button onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
              className="w-full flex items-center justify-between px-4 py-3 touch-manipulation min-h-[56px]">
              <div className="flex items-center gap-3">
                <div className={cn('w-2 h-8 rounded-full', statusColor)} />
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">#{order.orderNumber}</span>
                    {order.table && <span className="text-sm font-black px-2 py-0.5 rounded bg-primary/15 text-primary">Miza {order.table.number}</span>}
                    {order.type === 'TAKEOUT' && <ShoppingBag className="w-3.5 h-3.5 text-blue-500" />}
                  </div>
                  <p className="text-xs text-muted-foreground">{order.employee.name} · {order.items.length} artiklov</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {readyItems.length > 0 && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                    {readyItems.length} pripravljenih
                  </span>
                )}
                <span className="text-xs text-muted-foreground">{elapsed}min</span>
                <ChevronRight className={cn('w-4 h-4 transition-transform', isExpanded && 'rotate-90')} />
              </div>
            </button>

            {isExpanded && (
              <div className="px-4 pb-3 space-y-1.5 border-t pt-2">
                {order.items.map(item => (
                  <div key={item.id} className={cn(
                    'flex items-center justify-between py-1.5 px-2.5 rounded-lg text-sm',
                    item.status === 'ready' && 'bg-emerald-50 dark:bg-emerald-950/30',
                    item.status === 'served' && 'bg-blue-50 dark:bg-blue-950/30 opacity-60',
                    item.status === 'cancelled' && 'opacity-40 line-through',
                    item.status === 'preparing' && 'bg-orange-50 dark:bg-orange-950/20',
                    item.status === 'fired' && 'bg-orange-50 dark:bg-orange-950/20',
                  )}>
                    <div>
                      <span className="font-bold">{item.quantity}x</span> {item.name}
                      {item.notes && <p className="text-[11px] text-muted-foreground ml-5">{item.notes}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">{(item.price * item.quantity).toFixed(2)} €</span>
                      {item.status === 'ready' && (
                        <button onClick={() => onMarkServed(order.id, [item.id])}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 touch-manipulation min-h-[36px]">
                          Postreži
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 border-t mt-2">
                  <span className="font-bold">Skupaj: {order.total.toFixed(2)} €</span>
                  {readyItems.length > 0 && (
                    <button onClick={() => onMarkServed(order.id, readyItems.map(i => i.id))}
                      className="px-4 py-2.5 rounded-xl bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-600 active:scale-95 touch-manipulation min-h-[48px]">
                      <CheckCircle className="w-4 h-4 inline mr-1" />Prevzemi vse pripravljene
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
