'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import {
  ChefHat, Clock, AlertTriangle, CheckCircle2, Flame,
  UtensilsCrossed, ArrowRight, Volume2, VolumeX, RefreshCw,
  Grid3X3, List, Timer, Bell, BellRing
} from 'lucide-react'
import { useState, useEffect, useRef, useCallback } from 'react'
import { format } from 'date-fns'
import { sl } from 'date-fns/locale'

// ============================================
// TIPI
// ============================================
interface OrderItemWithMenu {
  id: string
  quantity: number
  price: number
  notes: string
  modifiersJson: string
  status: string
  menuItem: {
    id: string
    name: string
    category: { id: string; name: string; icon: string; menu: { id: string; name: string } }
  }
}

interface EnrichedOrder {
  id: string
  orderNumber: number
  type: string
  status: string
  customerName: string
  notes: string
  createdAt: string
  waitMinutes: number
  urgency: 'normal' | 'warning' | 'critical'
  pendingCount: number
  preparingCount: number
  readyCount: number
  totalItems: number
  table: { id: string; number: number; area: string } | null
  orderItems: OrderItemWithMenu[]
}

interface KDSData {
  orders: EnrichedOrder[]
  stats: {
    totalActive: number
    pendingOrders: number
    inProgressOrders: number
    totalItemsPending: number
    totalItemsPreparing: number
    totalItemsReady: number
    avgWaitTime: number
    criticalOrders: number
  }
}

// ============================================
// ZVOČNO OBVEŠČANJE
// ============================================
class KitchenSoundManager {
  private audioContext: AudioContext | null = null
  private enabled = true

  toggle() {
    this.enabled = !this.enabled
    return this.enabled
  }

  isEnabled() {
    return this.enabled
  }

  private getContext() {
    if (!this.audioContext) {
      this.audioContext = new AudioContext()
    }
    return this.audioContext
  }

  playNewOrder() {
    if (!this.enabled) return
    try {
      const ctx = this.getContext()
      // Pleasant two-tone chime for new orders
      const osc1 = ctx.createOscillator()
      const osc2 = ctx.createOscillator()
      const gain = ctx.createGain()

      osc1.connect(gain)
      osc2.connect(gain)
      gain.connect(ctx.destination)

      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(880, ctx.currentTime)
      osc1.frequency.setValueAtTime(1100, ctx.currentTime + 0.15)

      osc2.type = 'sine'
      osc2.frequency.setValueAtTime(1100, ctx.currentTime + 0.2)
      osc2.frequency.setValueAtTime(1320, ctx.currentTime + 0.35)

      gain.gain.setValueAtTime(0.15, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)

      osc1.start(ctx.currentTime)
      osc2.start(ctx.currentTime + 0.2)
      osc1.stop(ctx.currentTime + 0.5)
      osc2.stop(ctx.currentTime + 0.5)
    } catch { /* Audio not available */ }
  }

  playItemReady() {
    if (!this.enabled) return
    try {
      const ctx = this.getContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.type = 'sine'
      osc.frequency.setValueAtTime(660, ctx.currentTime)
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1)

      gain.gain.setValueAtTime(0.1, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3)

      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.3)
    } catch { /* Audio not available */ }
  }

  playUrgent() {
    if (!this.enabled) return
    try {
      const ctx = this.getContext()
      // Three quick beeps for urgent orders
      for (let i = 0; i < 3; i++) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.type = 'square'
        osc.frequency.value = 800
        gain.gain.setValueAtTime(0.08, ctx.currentTime + i * 0.2)
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + i * 0.2 + 0.15)
        osc.start(ctx.currentTime + i * 0.2)
        osc.stop(ctx.currentTime + i * 0.2 + 0.15)
      }
    } catch { /* Audio not available */ }
  }
}

const soundManager = new KitchenSoundManager()

// ============================================
// KOMPONENTA ZA PRIKAZ ČASA
// ============================================
function WaitTimer({ minutes, urgency }: { minutes: number; urgency: string }) {
  const [elapsed, setElapsed] = useState(minutes)

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(prev => prev + 1)
    }, 60000) // Update every minute
    return () => clearInterval(interval)
  }, [])

  const hours = Math.floor(elapsed / 60)
  const mins = elapsed % 60
  const display = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`

  return (
    <div className={`flex items-center gap-1 text-sm font-bold ${
      urgency === 'critical' ? 'text-red-500 animate-pulse' :
      urgency === 'warning' ? 'text-amber-500' :
      'text-muted-foreground'
    }`}>
      <Timer className="h-3.5 w-3.5" />
      {display}
    </div>
  )
}

// ============================================
// KOMPONENTA ZA POSAMEZNI ARTIKEL
// ============================================
function KitchenOrderItem({
  item,
  onStatusChange,
  compact
}: {
  item: OrderItemWithMenu
  onStatusChange: (id: string, status: string) => void
  compact?: boolean
}) {
  const modifiers = (() => {
    try { return JSON.parse(item.modifiersJson || '[]') } catch { return [] }
  })()

  const statusConfig: Record<string, { color: string; bg: string; icon: React.ReactNode; label: string; nextLabel: string; nextStatus: string }> = {
    pending: {
      color: 'text-yellow-700 dark:text-yellow-400',
      bg: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800',
      icon: <Clock className="h-4 w-4" />,
      label: 'Čaka',
      nextLabel: 'Pripravljam',
      nextStatus: 'preparing',
    },
    preparing: {
      color: 'text-blue-700 dark:text-blue-400',
      bg: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800',
      icon: <Flame className="h-4 w-4" />,
      label: 'V pripravi',
      nextLabel: 'Pripravljeno',
      nextStatus: 'ready',
    },
    ready: {
      color: 'text-emerald-700 dark:text-emerald-400',
      bg: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800',
      icon: <CheckCircle2 className="h-4 w-4" />,
      label: 'Pripravljeno',
      nextLabel: 'Postreženo',
      nextStatus: 'served',
    },
    served: {
      color: 'text-gray-500',
      bg: 'bg-gray-50 border-gray-200 dark:bg-gray-900/20 dark:border-gray-800',
      icon: <CheckCircle2 className="h-4 w-4" />,
      label: 'Postreženo',
      nextLabel: '',
      nextStatus: '',
    },
  }

  const config = statusConfig[item.status] || statusConfig.pending

  if (compact) {
    return (
      <div className={`flex items-center justify-between p-2 rounded-lg border ${config.bg} transition-all`}>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className={`flex-shrink-0 ${config.color}`}>{config.icon}</span>
          <span className="font-bold text-sm">{item.quantity}x</span>
          <span className="text-sm truncate">{item.menuItem.name}</span>
          {modifiers.length > 0 && (
            <div className="flex gap-0.5">
              {modifiers.map((m: { name: string }, i: number) => (
                <Badge key={i} variant="outline" className="text-[9px] h-4 px-1">
                  {m.name}
                </Badge>
              ))}
            </div>
          )}
        </div>
        {item.status !== 'served' && (
          <Button
            size="sm"
            variant="ghost"
            className={`h-7 text-xs flex-shrink-0 ml-2 ${config.color} hover:${config.bg}`}
            onClick={() => onStatusChange(item.id, config.nextStatus)}
          >
            {config.nextLabel} <ArrowRight className="h-3 w-3 ml-1" />
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className={`p-3 rounded-lg border-2 ${config.bg} transition-all hover:shadow-sm`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`flex-shrink-0 ${config.color}`}>{config.icon}</span>
            <span className="font-bold text-lg">{item.quantity}x</span>
            <span className="font-semibold text-base">{item.menuItem.name}</span>
          </div>
          {modifiers.length > 0 && (
            <div className="flex flex-wrap gap-1 ml-8 mb-1">
              {modifiers.map((m: { name: string; price?: number }, i: number) => (
                <Badge key={i} variant="secondary" className="text-[10px] h-5 px-1.5">
                  {m.name}{m.price ? ` (+€${m.price.toFixed(2)})` : ''}
                </Badge>
              ))}
            </div>
          )}
          {item.notes && (
            <p className="text-xs text-amber-700 dark:text-amber-400 ml-8 italic">
              📝 {item.notes}
            </p>
          )}
          <p className="text-[10px] text-muted-foreground ml-8">
            {item.menuItem.category.icon} {item.menuItem.category.name}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <Badge className={`${config.color} ${config.bg} border-0 text-xs font-semibold`}>
            {config.label}
          </Badge>
          {item.status !== 'served' && (
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={() => onStatusChange(item.id, config.nextStatus)}
            >
              {config.nextLabel}
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================
// KOMPONENTA ZA POSAMEZNO NAROČILO
// ============================================
function KitchenOrderCard({
  order,
  onItemStatusChange,
  onOrderStatusChange,
  viewMode
}: {
  order: EnrichedOrder
  onItemStatusChange: (itemId: string, status: string) => void
  onOrderStatusChange: (orderId: string, status: string) => void
  viewMode: 'cards' | 'list'
}) {
  const typeLabels: Record<string, string> = {
    'dine-in': '🍽️ Na mestu',
    'takeout': '📦 Za s seboj',
    'delivery': '🚚 Dostava',
  }

  const urgencyBorder: Record<string, string> = {
    normal: 'border-l-4 border-l-blue-400',
    warning: 'border-l-4 border-l-amber-400',
    critical: 'border-l-4 border-l-red-500',
  }

  const urgencyBg: Record<string, string> = {
    normal: '',
    warning: 'bg-amber-50/50 dark:bg-amber-900/10',
    critical: 'bg-red-50/50 dark:bg-red-900/10',
  }

  // Group items by category (food items together, drinks together)
  const foodItems = order.orderItems.filter(oi =>
    oi.menuItem.category.menu.name === 'Hrana'
  )
  const drinkItems = order.orderItems.filter(oi =>
    oi.menuItem.category.menu.name === 'Pijača'
  )

  if (viewMode === 'list') {
    return (
      <div className={`rounded-lg border bg-card ${urgencyBorder[order.urgency]} ${urgencyBg[order.urgency]} transition-all hover:shadow-md`}>
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <span className="font-bold text-lg">#{order.orderNumber}</span>
              <Badge variant="outline" className="text-xs">
                {typeLabels[order.type] || order.type}
              </Badge>
              {order.table && (
                <Badge variant="secondary" className="text-xs">
                  🪑 Miza {order.table.number}
                </Badge>
              )}
              {order.customerName && (
                <span className="text-sm text-muted-foreground">{order.customerName}</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <WaitTimer minutes={order.waitMinutes} urgency={order.urgency} />
              <div className="flex gap-1">
                {order.pendingCount > 0 && (
                  <Badge variant="outline" className="text-[10px] bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                    {order.pendingCount} čaka
                  </Badge>
                )}
                {order.preparingCount > 0 && (
                  <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    {order.preparingCount} pripravlja
                  </Badge>
                )}
                {order.readyCount > 0 && (
                  <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                    {order.readyCount} pripravljeno
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="space-y-1">
            {order.orderItems.map(item => (
              <KitchenOrderItem key={item.id} item={item} onStatusChange={onItemStatusChange} compact />
            ))}
          </div>
          {order.notes && (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-400 italic bg-amber-50 dark:bg-amber-900/20 p-2 rounded">
              📝 Opombe: {order.notes}
            </p>
          )}
        </div>
      </div>
    )
  }

  // Cards view
  return (
    <Card className={`overflow-hidden ${urgencyBorder[order.urgency]} ${urgencyBg[order.urgency]} transition-all hover:shadow-lg`}>
      {/* Header */}
      <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xl">#{order.orderNumber}</span>
            {order.urgency === 'critical' && (
              <AlertTriangle className="h-4 w-4 text-red-500 animate-pulse" />
            )}
            {order.urgency === 'warning' && (
              <Clock className="h-4 w-4 text-amber-500" />
            )}
          </div>
          <div className="flex gap-1.5">
            <Badge variant="outline" className="text-xs">
              {typeLabels[order.type] || order.type}
            </Badge>
            {order.table && (
              <Badge variant="secondary" className="text-xs font-semibold">
                🪑 Miza {order.table.number}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <WaitTimer minutes={order.waitMinutes} urgency={order.urgency} />
          <span className="text-[10px] text-muted-foreground">
            {format(new Date(order.createdAt), 'HH:mm')}
          </span>
        </div>
      </div>

      {/* Customer & Notes */}
      {(order.customerName || order.notes) && (
        <div className="px-4 py-2 border-b bg-muted/10">
          {order.customerName && (
            <p className="text-sm text-muted-foreground">👤 {order.customerName}</p>
          )}
          {order.notes && (
            <p className="text-xs text-amber-700 dark:text-amber-400 italic mt-1">
              📝 {order.notes}
            </p>
          )}
        </div>
      )}

      {/* Food Items */}
      <CardContent className="p-3 space-y-2">
        {foodItems.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <UtensilsCrossed className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold text-primary">Hrana</span>
              <Badge variant="outline" className="text-[9px] h-4 px-1">{foodItems.length}</Badge>
            </div>
            <div className="space-y-1.5">
              {foodItems.map(item => (
                <KitchenOrderItem key={item.id} item={item} onStatusChange={onItemStatusChange} />
              ))}
            </div>
          </div>
        )}

        {drinkItems.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-sm">🥤</span>
              <span className="text-xs font-semibold text-primary">Pijača</span>
              <Badge variant="outline" className="text-[9px] h-4 px-1">{drinkItems.length}</Badge>
            </div>
            <div className="space-y-1.5">
              {drinkItems.map(item => (
                <KitchenOrderItem key={item.id} item={item} onStatusChange={onItemStatusChange} />
              ))}
            </div>
          </div>
        )}

        {foodItems.length === 0 && drinkItems.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">Ni artiklov</p>
        )}
      </CardContent>

      {/* Footer with progress and bulk action */}
      <div className="px-4 py-2.5 border-t bg-muted/20 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Progress bar */}
          <div className="flex gap-0.5">
            {order.orderItems.map((item, i) => (
              <div
                key={i}
                className={`h-2 w-6 rounded-full transition-colors ${
                  item.status === 'served' ? 'bg-gray-400' :
                  item.status === 'ready' ? 'bg-emerald-500' :
                  item.status === 'preparing' ? 'bg-blue-500' :
                  'bg-yellow-400'
                }`}
              />
            ))}
          </div>
          <span className="text-[10px] text-muted-foreground">
            {order.readyCount + (order.orderItems.filter(oi => oi.status === 'served').length)}/{order.totalItems}
          </span>
        </div>

        {order.status === 'pending' && (
          <Button
            size="sm"
            className="h-7 text-xs bg-blue-600 hover:bg-blue-700"
            onClick={() => onOrderStatusChange(order.id, 'in-progress')}
          >
            <Flame className="h-3 w-3 mr-1" />
            Začni pripravo
          </Button>
        )}
        {order.status === 'in-progress' && order.readyCount === order.totalItems && (
          <Button
            size="sm"
            className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
            onClick={() => onOrderStatusChange(order.id, 'ready')}
          >
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Vse pripravljeno
          </Button>
        )}
      </div>
    </Card>
  )
}

// ============================================
// GLAVNA KDS KOMPONENTA
// ============================================
export function KitchenDisplay() {
  const queryClient = useQueryClient()
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards')
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'in-progress'>('all')
  const [lastOrderCount, setLastOrderCount] = useState(0)
  const prevOrdersRef = useRef<string[]>([])

  // Fetch KDS data with frequent refresh
  const { data, isLoading } = useQuery({
    queryKey: ['kitchen'],
    queryFn: async () => {
      const res = await fetch('/api/kitchen')
      return res.json() as Promise<KDSData>
    },
    refetchInterval: 5000, // Refresh every 5 seconds
  })

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
      const res = await fetch(`/api/order-items/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Failed to update item')
      return res.json()
    },
    onSuccess: (_, variables) => {
      if (variables.status === 'ready' && soundEnabled) {
        soundManager.playItemReady()
      }
      queryClient.invalidateQueries({ queryKey: ['kitchen'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: () => {
      toast.error('Napaka pri posodobitvi statusa')
    },
  })

  // Order status mutation
  const orderStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error('Failed to update order')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kitchen'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
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

  // Filter orders by status
  const filteredOrders = (data?.orders || []).filter(order => {
    if (filterStatus === 'all') return true
    return order.status === filterStatus
  })

  // Separate into columns by urgency for cards view
  const urgentOrders = filteredOrders.filter(o => o.urgency === 'critical')
  const warningOrders = filteredOrders.filter(o => o.urgency === 'warning')
  const normalOrders = filteredOrders.filter(o => o.urgency === 'normal')

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
                className="h-8 w-8 rounded-r-none"
                onClick={() => setViewMode('cards')}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="icon"
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
              className="h-8 w-8"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['kitchen'] })}
            >
              <RefreshCw className="h-4 w-4" />
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
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Samodejno osveževanje vsakih 5s
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
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Samoosvežitev: 5s</span>
          </div>
        </div>
      )}
    </div>
  )
}
