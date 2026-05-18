'use client'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Napredni kuhinjski pripravljalni vrstni red
// Toast Kitchen + Kitchen Display System (KDS) Pro
// Prednostne vrste, časi priprave, sledenje kurzov, alarmi
// ═══════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import { authFetch } from '@/components/pos/PinLogin'
import {
  Flame, Clock, AlertTriangle, CheckCircle2, ChefHat,
  UtensilsCrossed, ArrowUp, ArrowDown, Timer, Bell,
  Zap, Package, Wine, Coffee, XCircle, RefreshCw,
  ListOrdered, LayoutGrid,
} from 'lucide-react'
import { useState, useEffect, useMemo } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'

// ─── Tipi ──────────────────────────────────────────────────────
interface OrderItem {
  id: string
  menuItemId: string
  menuItem: { name: string; category?: { name: string }; prepTime?: number }
  quantity: number
  status: string
  notes?: string
  modifiers?: string
  course?: number
}

interface KitchenOrder {
  id: string
  orderNumber: number
  type: string
  status: string
  priority: string
  createdAt: string
  orderItems: OrderItem[]
  table?: { number: number; name?: string }
  customerName?: string
  specialInstructions?: string
  elapsedMinutes: number
  estimatedPrepMinutes: number
}

// ─── Konstante ─────────────────────────────────────────────────
const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  urgent: { label: 'NUJNO', color: 'text-red-700 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30', border: 'border-red-400 dark:border-red-800' },
  high: { label: 'VISOKO', color: 'text-orange-700 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/30', border: 'border-orange-400 dark:border-orange-800' },
  normal: { label: 'NORMALNO', color: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30', border: 'border-blue-300 dark:border-blue-800' },
  low: { label: 'NIZKO', color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-800/30', border: 'border-gray-300 dark:border-gray-700' },
}

const CATEGORY_ICONS: Record<string, typeof Flame> = {
  'Predjedi': UtensilsCrossed,
  'Glavne jedi': Flame,
  'Pice': Flame,
  'Sladice': Coffee,
  'Pijače': Wine,
  'Juhe': Coffee,
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Čakajoče',
  preparing: 'V pripravi',
  ready: 'Pripravljeno',
  served: 'Postreženo',
  cancelled: 'Preklicano',
}

type ViewMode = 'list' | 'grid'

export function KitchenPrepQueue() {
  const queryClient = useQueryClient()
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [soundEnabled, setSoundEnabled] = useState(true)

  const { data, isLoading, refetch } = useQuery<{
    orders: KitchenOrder[]
    stats: { pending: number; preparing: number; ready: number; avgWaitTime: number }
  }>({
    queryKey: ['kitchen-prep-queue'],
    queryFn: async () => {
      const res = await authFetch('/api/dashboard')
      const dashboardData = await res.json()

      // Pretvori dashboard podatke v kuhinjske naročila
      const activeOrders = (dashboardData.recentOrders || [])
        .filter((o: { status: string }) => o.status === 'pending' || o.status === 'in-progress')

      const kitchenOrders: KitchenOrder[] = activeOrders.map((order: {
        id: string; orderNumber: number; type: string; status: string; priority?: string;
        createdAt: string; orderItems: OrderItem[]; table?: { number: number; name?: string };
        customerName?: string; specialInstructions?: string;
      }) => {
        const created = new Date(order.createdAt).getTime()
        const now = Date.now()
        const elapsedMinutes = Math.floor((now - created) / 60000)
        const estimatedPrepMinutes = order.orderItems?.reduce(
          (sum: number, oi: OrderItem) => sum + (oi.menuItem?.prepTime || 15), 0
        ) / Math.max(order.orderItems?.length || 1, 1)

        return {
          ...order,
          priority: order.priority || (elapsedMinutes > 30 ? 'urgent' : elapsedMinutes > 15 ? 'high' : 'normal'),
          elapsedMinutes,
          estimatedPrepMinutes: Math.round(estimatedPrepMinutes),
          status: order.status === 'in-progress' ? 'preparing' : order.status,
        }
      })

      // Razvrsti po prednosti nato po času
      const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 }
      kitchenOrders.sort((a: KitchenOrder, b: KitchenOrder) => {
        const pA = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 2
        const pB = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 2
        if (pA !== pB) return pA - pB
        return a.elapsedMinutes - b.elapsedMinutes
      })

      const pending = kitchenOrders.filter((o: KitchenOrder) => o.status === 'pending').length
      const preparing = kitchenOrders.filter((o: KitchenOrder) => o.status === 'preparing').length
      const ready = kitchenOrders.filter((o: KitchenOrder) => o.status === 'ready').length
      const avgWaitTime = kitchenOrders.length > 0
        ? kitchenOrders.reduce((s: number, o: KitchenOrder) => s + o.elapsedMinutes, 0) / kitchenOrders.length
        : 0

      return {
        orders: kitchenOrders,
        stats: { pending, preparing, ready, avgWaitTime },
      }
    },
    refetchInterval: 5000, // Osvežitev vsakih 5s
  })

  // Mutacija za posodobitev statusa artikla
  const updateItemStatus = useMutation({
    mutationFn: async ({ itemId, status }: { itemId: string; status: string }) => {
      const res = await authFetch(`/api/checks/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kitchen-prep-queue'] })
    },
  })

  // Zvočni alarm za nujna naročila
  useEffect(() => {
    if (!soundEnabled) return
    const urgentCount = data?.orders.filter(o => o.priority === 'urgent').length || 0
    if (urgentCount > 0) {
      // Enostaven zvočni signal (uporabi Web Audio API)
      try {
        const ctx = new AudioContext()
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.frequency.value = 880
        gain.gain.value = 0.1
        osc.start()
        osc.stop(ctx.currentTime + 0.15)
      } catch {
        // Zvok ni na voljo
      }
    }
  }, [data?.orders.filter(o => o.priority === 'urgent').length, soundEnabled])

  const orders = data?.orders || []
  const stats = data?.stats

  const pendingOrders = orders.filter(o => o.status === 'pending')
  const preparingOrders = orders.filter(o => o.status === 'preparing')
  const readyOrders = orders.filter(o => o.status === 'ready')

  const getTimeWarning = (minutes: number) => {
    if (minutes > 30) return { level: 'critical', color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/30' }
    if (minutes > 20) return { level: 'warning', color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/30' }
    if (minutes > 10) return { level: 'caution', color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30' }
    return { level: 'ok', color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/30' }
  }

  if (isLoading) {
    return (
      <div className="space-y-6 p-1">
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 overflow-y-auto h-full p-1 custom-scrollbar">
      {/* Header + Stats */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ChefHat className="h-6 w-6 text-primary" />
            Kuhinjski pripravljalni vrsti red
          </h2>
          <p className="text-sm text-muted-foreground">Napredni KDS s prednostnimi vrstami in časi priprave</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={soundEnabled ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="gap-1"
          >
            <Bell className="h-3 w-3" />
            {soundEnabled ? 'Zvon' : 'Tiho'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className="gap-1"
          >
            {viewMode === 'grid' ? <LayoutGrid className="h-3 w-3" /> : <ListOrdered className="h-3 w-3" />}
            {viewMode === 'grid' ? 'Mreža' : 'Seznam'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1">
            <RefreshCw className="h-3 w-3" />
            Osveži
          </Button>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-yellow-300 dark:border-yellow-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats?.pending || 0}</p>
              <p className="text-xs text-muted-foreground">Čakajoča</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-300 dark:border-blue-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Flame className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats?.preparing || 0}</p>
              <p className="text-xs text-muted-foreground">V pripravi</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-emerald-300 dark:border-emerald-800">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats?.ready || 0}</p>
              <p className="text-xs text-muted-foreground">Pripravljena</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Timer className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{Math.round(stats?.avgWaitTime || 0)} min</p>
              <p className="text-xs text-muted-foreground">Povpr. čakanje</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          TRI STOLPCI: Čakajoča | V pripravi | Pripravljena
          ═══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ČAKAJOČA NAROČILA */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-3 w-3 rounded-full bg-yellow-500" />
            <h3 className="font-bold text-sm">ČAKAJOČA ({pendingOrders.length})</h3>
          </div>
          {pendingOrders.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              viewMode={viewMode}
              onItemStatus={(itemId, status) => updateItemStatus.mutate({ itemId, status })}
              onOrderStatus={(orderId) => {
                updateItemStatus.mutate({ itemId: orderId, status: 'preparing' })
              }}
              getTimeWarning={getTimeWarning}
            />
          ))}
          {pendingOrders.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
              Ni čakajočih naročil
            </div>
          )}
        </div>

        {/* V PRIPRAVI */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-3 w-3 rounded-full bg-blue-500" />
            <h3 className="font-bold text-sm">V PRIPRAVI ({preparingOrders.length})</h3>
          </div>
          {preparingOrders.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              viewMode={viewMode}
              onItemStatus={(itemId, status) => updateItemStatus.mutate({ itemId, status })}
              onOrderStatus={(orderId) => {
                updateItemStatus.mutate({ itemId: orderId, status: 'ready' })
              }}
              getTimeWarning={getTimeWarning}
            />
          ))}
          {preparingOrders.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Flame className="h-8 w-8 mx-auto mb-2 opacity-30" />
              Ni naročil v pripravi
            </div>
          )}
        </div>

        {/* PRIPRAVLJENA */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-3 w-3 rounded-full bg-emerald-500" />
            <h3 className="font-bold text-sm">PRIPRAVLJENA ({readyOrders.length})</h3>
          </div>
          {readyOrders.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              viewMode={viewMode}
              onItemStatus={(itemId, status) => updateItemStatus.mutate({ itemId, status })}
              onOrderStatus={(orderId) => {
                updateItemStatus.mutate({ itemId: orderId, status: 'completed' })
                toast.success(`Naročilo #${order.orderNumber} zaključeno`)
              }}
              getTimeWarning={getTimeWarning}
            />
          ))}
          {readyOrders.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
              Ni pripravljenih naročil
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Podkomponenta: Kartica naročila ───────────────────────────
function OrderCard({
  order, viewMode, onItemStatus, onOrderStatus, getTimeWarning,
}: {
  order: KitchenOrder
  viewMode: ViewMode
  onItemStatus: (itemId: string, status: string) => void
  onOrderStatus: (orderId: string) => void
  getTimeWarning: (minutes: number) => { level: string; color: string; bg: string }
}) {
  const priority = PRIORITY_CONFIG[order.priority] || PRIORITY_CONFIG.normal
  const timeWarning = getTimeWarning(order.elapsedMinutes)
  const progress = order.estimatedPrepMinutes > 0
    ? Math.min(100, (order.elapsedMinutes / order.estimatedPrepMinutes) * 100)
    : 0

  return (
    <Card className={`border-2 ${priority.border} ${viewMode === 'grid' ? '' : 'compact'}`}>
      <CardContent className="p-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm">#{order.orderNumber}</span>
            <Badge className={`${priority.bg} ${priority.color} text-[10px] font-bold`}>
              {priority.label}
            </Badge>
          </div>
          <div className={`flex items-center gap-1 text-xs font-mono ${timeWarning.color}`}>
            <Clock className="h-3 w-3" />
            {order.elapsedMinutes} min
          </div>
        </div>

        {/* Table / Type info */}
        <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
          {order.type === 'dine-in' && order.table ? (
            <span className="flex items-center gap-1">
              <UtensilsCrossed className="h-3 w-3" />
              Miza {order.table.number}
            </span>
          ) : order.type === 'takeout' ? (
            <span className="flex items-center gap-1">
              <Package className="h-3 w-3" />
              Za s seboj
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3" />
              Dostava
            </span>
          )}
          {order.customerName && <span>· {order.customerName}</span>}
        </div>

        {/* Progress bar */}
        <div className="mb-2">
          <Progress
            value={progress}
            className={`h-1.5 ${progress > 100 ? '[&>div]:bg-red-500' : progress > 75 ? '[&>div]:bg-amber-500' : '[&>div]:bg-blue-500'}`}
          />
          <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
            <span>{order.elapsedMinutes} min</span>
            <span>~{order.estimatedPrepMinutes} min predvideno</span>
          </div>
        </div>

        {/* Items list */}
        <div className="space-y-1.5">
          {order.orderItems?.map(item => {
            const CatIcon = CATEGORY_ICONS[item.menuItem?.category?.name || ''] || ChefHat
            return (
              <div key={item.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <button
                    onClick={() => {
                      const nextStatus = item.status === 'pending' ? 'preparing' : item.status === 'preparing' ? 'ready' : 'served'
                      onItemStatus(item.id, nextStatus)
                    }}
                    className={`h-2 w-2 rounded-full flex-shrink-0 cursor-pointer transition-colors ${
                      item.status === 'ready' ? 'bg-emerald-500' :
                      item.status === 'preparing' ? 'bg-blue-500' :
                      'bg-yellow-500'
                    }`}
                    title={`Klikni za napredek: ${item.status}`}
                  />
                  <CatIcon className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  <span className="text-xs truncate">{item.quantity}x {item.menuItem?.name || 'Artikel'}</span>
                </div>
                <Badge variant="outline" className="text-[9px] px-1 py-0 ml-1">
                  {STATUS_LABELS[item.status] || item.status}
                </Badge>
              </div>
            )
          })}
        </div>

        {/* Special notes */}
        {order.specialInstructions && (
          <div className="mt-2 p-1.5 rounded bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <p className="text-[10px] text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-3 w-3 inline mr-1" />
              {order.specialInstructions}
            </p>
          </div>
        )}

        {/* Action button */}
        <div className="mt-2">
          <Button
            size="sm"
            variant={order.status === 'pending' ? 'default' : order.status === 'preparing' ? 'secondary' : 'outline'}
            className="w-full text-xs gap-1"
            onClick={() => onOrderStatus(order.id)}
          >
            {order.status === 'pending' && <><Flame className="h-3 w-3" /> Začni pripravo</>}
            {order.status === 'preparing' && <><CheckCircle2 className="h-3 w-3" /> Pripravljeno</>}
            {order.status === 'ready' && <><Package className="h-3 w-3" /> Zaključi</>}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
