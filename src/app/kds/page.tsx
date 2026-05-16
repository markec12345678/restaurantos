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

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { t, getLocale } from '@/lib/i18n'
import {
  ChefHat, Clock, Bell, BellRing, Maximize, Minimize,
  RefreshCw, Wifi, WifiOff, ArrowLeft, Eye, Flame,
  CheckCircle2, AlertTriangle, Grid3X3, List, Settings,
  Volume2, VolumeX, RotateCcw, X, Monitor
} from 'lucide-react'
import { toast } from 'sonner'

// ─── Tipi ──────────────────────────────────────────────────────
interface OrderItemKDS {
  id: string
  name: string
  quantity: number
  status: string
  notes: string | null
  category: string | null
  station: string | null
  modifiers: { name: string }[]
  firedAt: string | null
  prepTimeMinutes: number | null
}

interface OrderKDS {
  id: string
  orderNumber: number
  type: string
  status: string
  table: { number: number; area: string } | null
  employee: { name: string } | null
  items: OrderItemKDS[]
  firedAt: string | null
  createdAt: string
  notes: string | null
  course: number | null
  priority: boolean
}

// ─── Zvočni sistem ─────────────────────────────────────────────
function useKDSSound() {
  const audioRef = useRef<AudioContext | null>(null)
  const enabledRef = useRef(true)

  const play = useCallback(() => {
    if (!enabledRef.current) return
    try {
      if (!audioRef.current) audioRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      const ctx = audioRef.current
      // Trojni ping — nizko-srednje-visoko
      const notes = [523.25, 659.25, 783.99] // C5, E5, G5
      notes.forEach((freq, i) => {
        setTimeout(() => {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.connect(gain); gain.connect(ctx.destination)
          osc.frequency.value = freq; osc.type = 'sine'
          gain.gain.setValueAtTime(0.25, ctx.currentTime)
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4)
          osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.4)
        }, i * 200)
      })
    } catch {}
  }, [])

  const toggle = useCallback(() => { enabledRef.current = !enabledRef.current }, [])
  const isEnabled = useCallback(() => enabledRef.current, [])

  return { play, toggle, isEnabled }
}

// ─── PIN Login ─────────────────────────────────────────────────
function KDSLogin({ onLogin }: { onLogin: (emp: { id: string; name: string; role: string }) => void }) {
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
          <div className="w-20 h-20 rounded-2xl bg-orange-500 mx-auto mb-4 flex items-center justify-center shadow-lg">
            <ChefHat className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold">Kuhinjski zaslon</h1>
          <p className="text-muted-foreground mt-1 text-sm">KDS — Kitchen Display System</p>
        </div>
        <div className="bg-card rounded-2xl border shadow-xl p-6 space-y-4">
          <input type="password" inputMode="numeric" maxLength={6} value={pin}
            onChange={(e) => { setPin(e.target.value.replace(/\D/g, '')); setError('') }}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            placeholder="Vnesite PIN" autoFocus
            className="w-full text-center text-3xl tracking-[0.5em] font-mono py-4 px-4 rounded-xl border-2 focus:border-orange-500 focus:outline-none bg-background" />
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button onClick={handleLogin} disabled={loading || pin.length < 4}
            className="w-full py-4 rounded-xl bg-orange-500 text-white font-bold text-lg hover:bg-orange-600 disabled:opacity-50 transition-colors touch-manipulation min-h-[56px]">
            {loading ? 'Prijava...' : 'Vstopi v kuhinjo'}
          </button>
          <div className="pt-2 border-t">
            <p className="text-[10px] text-muted-foreground text-center mb-2">Demo PIN-i</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setPin('2222')} className="py-2 px-3 rounded-lg bg-muted text-xs font-medium hover:bg-muted/80 touch-manipulation min-h-[44px]">Kuhar 2222</button>
              <button onClick={() => setPin('1234')} className="py-2 px-3 rounded-lg bg-muted text-xs font-medium hover:bg-muted/80 touch-manipulation min-h-[44px]">Admin 1234</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Časovnik ──────────────────────────────────────────────────
function ElapsedTimer({ startTime, warnAt = 15, dangerAt = 25 }: { startTime: string | null; warnAt?: number; dangerAt?: number }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i) }, [])

  if (!startTime) return <span className="text-muted-foreground text-xs">--:--</span>

  const elapsed = Math.floor((now - new Date(startTime).getTime()) / 1000)
  const mins = Math.floor(elapsed / 60)
  const secs = elapsed % 60

  const colorClass = elapsed >= dangerAt * 60
    ? 'text-red-500 animate-pulse'
    : elapsed >= warnAt * 60
      ? 'text-amber-500'
      : 'text-emerald-500'

  return (
    <span className={cn('font-mono text-sm font-bold', colorClass)}>
      {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
    </span>
  )
}

// ─── Naročilna kartica ─────────────────────────────────────────
function OrderCard({
  order,
  onBump,
  onBumpItem,
  getElapsed,
}: {
  order: OrderKDS
  onBump: (orderId: string) => void
  onBumpItem: (orderId: string, itemId: string) => void
  getElapsed: (d: string | null) => number
}) {
  const activeItems = order.items.filter(i => !['SERVED', 'CANCELLED'].includes(i.status))
  const readyItems = activeItems.filter(i => i.status === 'READY')
  const preparingItems = activeItems.filter(i => ['FIRED', 'PREPARING', 'PENDING'].includes(i.status))
  const allReady = activeItems.length > 0 && readyItems.length === activeItems.length

  const elapsed = getElapsed(order.firedAt)
  const isDanger = elapsed >= 25
  const isWarning = elapsed >= 15 && !isDanger

  const typeLabels: Record<string, string> = {
    'dine-in': 'NA MESTU',
    'takeout': 'ZA SEBOJ',
    'delivery': 'DOSTAVA',
  }

  return (
    <div className={cn(
      'rounded-xl border-2 overflow-hidden transition-all shadow-md flex flex-col',
      allReady ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20' :
      isDanger ? 'border-red-500 bg-red-50/50 dark:bg-red-950/20 animate-pulse' :
      isWarning ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/20' :
      'border-border bg-card',
      order.priority && 'ring-2 ring-orange-500 ring-offset-2'
    )}>
      {/* Glava */}
      <div className={cn(
        'flex items-center justify-between px-3 py-2 text-white font-bold text-sm',
        allReady ? 'bg-emerald-600' :
        isDanger ? 'bg-red-600' :
        isWarning ? 'bg-amber-600' :
        'bg-orange-600'
      )}>
        <div className="flex items-center gap-2">
          <span className="text-lg font-black">#{order.orderNumber}</span>
          {order.table && (
            <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-bold">
              Miza {order.table.number}
            </span>
          )}
          <span className="text-xs opacity-80">{typeLabels[order.type] || order.type}</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5" />
          <ElapsedTimer startTime={order.firedAt} />
        </div>
      </div>

      {/* Artikli */}
      <div className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {preparingItems.map(item => (
          <div key={item.id}
            className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-white dark:bg-card border text-sm cursor-pointer hover:bg-orange-50 dark:hover:bg-orange-950/30 transition-colors touch-manipulation min-h-[44px]"
            onClick={() => onBumpItem(order.id, item.id)}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-black text-base">{item.quantity}x</span>
                <span className="font-semibold truncate">{item.name}</span>
              </div>
              {item.modifiers?.length > 0 && (
                <div className="ml-7 text-xs text-muted-foreground">
                  {item.modifiers.map(m => m.name).join(', ')}
                </div>
              )}
              {item.notes && (
                <div className="ml-7 text-xs text-orange-600 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> {item.notes}
                </div>
              )}
            </div>
            <div className="flex-shrink-0 ml-2">
              <Flame className="w-4 h-4 text-orange-500" />
            </div>
          </div>
        ))}

        {readyItems.map(item => (
          <div key={item.id}
            className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/40 text-sm cursor-pointer hover:bg-emerald-200 transition-colors touch-manipulation min-h-[44px]"
            onClick={() => onBumpItem(order.id, item.id)}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-black text-base">{item.quantity}x</span>
                <span className="font-semibold truncate line-through opacity-60">{item.name}</span>
              </div>
            </div>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
        ))}
      </div>

      {/* Spodnja vrstica */}
      <div className="px-3 py-2 border-t flex items-center justify-between bg-muted/30">
        <div className="text-xs text-muted-foreground">
          {order.employee?.name || '—'}
          {order.notes && <span className="ml-2 text-orange-600 font-semibold">★ {order.notes}</span>}
        </div>
        <button
          onClick={() => onBump(order.id)}
          className={cn(
            'px-4 py-2 rounded-lg font-bold text-sm transition-all active:scale-95 touch-manipulation min-h-[44px]',
            allReady
              ? 'bg-emerald-500 text-white hover:bg-emerald-600'
              : 'bg-orange-500 text-white hover:bg-orange-600'
          )}
        >
          {allReady ? '✓ BUMP' : 'BUMP vse'}
        </button>
      </div>
    </div>
  )
}

// ─── Glavna KDS stran ──────────────────────────────────────────
export default function KDSPage() {
  const queryClient = useQueryClient()
  const [employee, setEmployee] = useState<{ id: string; name: string; role: string } | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [stationFilter, setStationFilter] = useState<string>('all')
  const [showRecall, setShowRecall] = useState(false)
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
    } catch {}
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
    const wsUrl = `${protocol}//${window.location.host}/ws/kds`
    let ws: WebSocket | null = null
    let retries = 0

    const connect = () => {
      try {
        ws = new WebSocket(wsUrl)
        ws.onopen = () => { setWsConnected(true); retries = 0 }
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            if (data.type === 'new_order' || data.type === 'order_update' || data.type === 'order_ready') {
              queryClient.invalidateQueries({ queryKey: ['kds-orders'] })
              if (data.type === 'new_order') {
                playSound()
                if (navigator.vibrate) navigator.vibrate([200, 100, 200])
              }
            }
          } catch {}
        }
        ws.onclose = () => { setWsConnected(false); ws = null; if (retries < 30) { retries++; setTimeout(connect, 3000) } }
        ws.onerror = () => { ws?.close() }
      } catch {}
    }
    if (employee) connect()
    return () => { ws?.close() }
  }, [employee, playSound, queryClient])

  // ─── Pridobi aktivna naročila ───
  const { data: ordersData, isLoading, refetch } = useQuery({
    queryKey: ['kds-orders'],
    queryFn: async () => {
      const token = localStorage.getItem('pos_token')
      const headers: Record<string, string> = {}
      if (token) headers.Authorization = `Bearer ${token}`
      const res = await fetch('/api/orders?status=pending&limit=100', { headers })
      const data = await res.json()
      return (data.orders || data || []) as OrderKDS[]
    },
    refetchInterval: 5000,
    enabled: !!employee,
  })

  const allOrders = ordersData || []

  // Filtriraj: samo aktivna naročila z nerazvrščenimi artikli
  const activeOrders = useMemo(() =>
    allOrders.filter(o =>
      !bumpedOrders.includes(o.id) &&
      o.items?.some(i => !['SERVED', 'CANCELLED'].includes(i.status))
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
        items: o.items.filter(i => !i.station || i.station === stationFilter || i.status === 'READY')
      })).filter(o => o.items.some(i => !['SERVED', 'CANCELLED'].includes(i.status)))

  const getElapsed = useCallback((dateStr: string | null) => {
    if (!dateStr) return 0
    return Math.floor((now - new Date(dateStr).getTime()) / 60000)
  }, [now])

  // ─── Akcije ───
  const handleBump = async (orderId: string) => {
    const order = activeOrders.find(o => o.id === orderId)
    if (!order) return
    const activeItems = order.items.filter(i => !['SERVED', 'CANCELLED'].includes(i.status))

    try {
      await Promise.all(activeItems.map(item =>
        fetch(`/api/orders/${orderId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('pos_token')}` },
          body: JSON.stringify({ action: 'item_status', itemId: item.id, status: 'READY' }),
        })
      ))
      setBumpedOrders(prev => [...prev, orderId])
      queryClient.invalidateQueries({ queryKey: ['kds-orders'] })
      toast.success(`Naročilo #${order.orderNumber} bump!`)
    } catch { toast.error('Napaka pri bump') }
  }

  const handleBumpItem = async (orderId: string, itemId: string) => {
    try {
      await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('pos_token')}` },
        body: JSON.stringify({ action: 'item_status', itemId, status: 'READY' }),
      })
      queryClient.invalidateQueries({ queryKey: ['kds-orders'] })
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
    <div className="flex flex-col h-screen bg-background">
      {/* ─── HEADER ─── */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-card shadow-sm">
        <div className="flex items-center gap-3">
          <ChefHat className="w-6 h-6 text-orange-500" />
          <h1 className="text-lg font-bold">KDS</h1>
          <span className="text-sm text-muted-foreground">{employee.name}</span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
            {activeOrders.length} {activeOrders.length === 1 ? 'naročilo' : 'naročil'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Postaje */}
          <div className="flex gap-1">
            {stations.map(s => (
              <button key={s} onClick={() => setStationFilter(s)}
                className={cn(
                  'px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors touch-manipulation min-h-[36px]',
                  stationFilter === s
                    ? 'bg-orange-500 text-white'
                    : 'bg-secondary hover:bg-secondary/80'
                )}>
                {s === 'all' ? 'Vse' : s}
              </button>
            ))}
          </div>

          {/* Pogled */}
          <button onClick={() => setViewMode(v => v === 'grid' ? 'list' : 'grid')}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-secondary hover:bg-secondary/80 touch-manipulation min-h-[36px]">
            {viewMode === 'grid' ? <List className="w-4 h-4" /> : <Grid3X3 className="w-4 h-4" />}
          </button>

          {/* Zvok */}
          <button onClick={toggleSound}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-secondary hover:bg-secondary/80 touch-manipulation min-h-[36px]">
            {isSoundEnabled() ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Recall */}
          {bumpedOrders.length > 0 && (
            <button onClick={handleRecall}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-bold hover:bg-blue-600 touch-manipulation min-h-[36px]">
              <RotateCcw className="w-3.5 h-3.5" />
              Prikljuki ({bumpedOrders.length})
            </button>
          )}

          {/* Osveži */}
          <button onClick={() => refetch()} className="w-9 h-9 flex items-center justify-center rounded-lg bg-secondary hover:bg-secondary/80 touch-manipulation min-h-[36px]">
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* WS status */}
          <div className={cn('flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg font-medium', wsConnected ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800')}>
            {wsConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            {wsConnected ? 'Live' : 'Offline'}
          </div>

          {/* Celozaslonski */}
          <button onClick={toggleFullscreen} className="w-9 h-9 flex items-center justify-center rounded-lg bg-secondary hover:bg-secondary/80 touch-manipulation min-h-[36px]">
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ─── NAROČILA ─── */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-64 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
            <div className="w-28 h-28 rounded-3xl bg-emerald-50 dark:bg-emerald-950/20 flex items-center justify-center mb-6">
              <CheckCircle2 className="w-14 h-14 text-emerald-500 opacity-50" />
            </div>
            <p className="text-2xl font-bold">Kuhinja je prosta</p>
            <p className="text-sm mt-2">Čakam na nova naročila...</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="p-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 overflow-y-auto h-full custom-scrollbar">
            {filteredOrders.sort((a, b) => {
              // Priority orders first, then by firedAt
              if (a.priority && !b.priority) return -1
              if (!a.priority && b.priority) return 1
              return (a.firedAt || a.createdAt).localeCompare(b.firedAt || b.createdAt)
            }).map(order => (
              <OrderCard key={order.id} order={order} onBump={handleBump} onBumpItem={handleBumpItem} getElapsed={getElapsed} />
            ))}
          </div>
        ) : (
          <div className="p-3 space-y-2 overflow-y-auto h-full custom-scrollbar">
            {filteredOrders.sort((a, b) => {
              if (a.priority && !b.priority) return -1
              if (!a.priority && b.priority) return 1
              return (a.firedAt || a.createdAt).localeCompare(b.firedAt || b.createdAt)
            }).map(order => (
              <OrderCard key={order.id} order={order} onBump={handleBump} onBumpItem={handleBumpItem} getElapsed={getElapsed} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
