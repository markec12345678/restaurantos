'use client'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Multi-Course Kitchen Pacing
// "Fire Next Course" — profesionalna kuhinja s tempo jedi
// Toast POS + Michelin standard za uravnavanje hittinga jedi
// ═══════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import {
  Flame, ChefHat, Clock, ArrowRight, CheckCircle2, Zap,
  UtensilsCrossed, GlassWater, AlertTriangle, Play, Pause,
  Layers, Timer, Bell, BellRing, Wifi, WifiOff,
} from 'lucide-react'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { format } from 'date-fns'

// ─── Tipi ──────────────────────────────────────────────────────
interface CourseGroup {
  id: string
  name: string // Predjed, Glavna jed, Sladica, itd.
  sortOrder: number
  items: CourseItem[]
  status: 'waiting' | 'firing' | 'preparing' | 'ready' | 'served'
  firedAt?: string
  readyAt?: string
}

interface CourseItem {
  id: string
  name: string
  quantity: number
  modifiers: string[]
  notes: string
  status: 'pending' | 'preparing' | 'ready' | 'served'
  prepStation: string // kuhinja, šank, itd.
}

interface PacedOrder {
  id: string
  orderNumber: number
  tableNumber: number | null
  tableName: string | null
  customerName: string
  orderType: string
  createdAt: string
  courses: CourseGroup[]
  currentCourseIndex: number
  pacing: 'auto' | 'manual'
  avgGapMinutes: number
}

// ─── Standardni jedilni red ──────────────────────────────────────
const DEFAULT_COURSE_ORDER = [
  { id: 'predjed', name: 'Predjed', sortOrder: 1 },
  { id: 'juha', name: 'Juha', sortOrder: 2 },
  { id: 'medkrožnik', name: 'Medkrožnik', sortOrder: 3 },
  { id: 'glavna', name: 'Glavna jed', sortOrder: 4 },
  { id: 'sir', name: 'Sir', sortOrder: 5 },
  { id: 'sladica', name: 'Sladica', sortOrder: 6 },
  { id: 'kava', name: 'Kava / Čaj', sortOrder: 7 },
]

// ─── Avtomatsko razvrščanje artiklov v jedi ──────────────────────
const COURSE_KEYWORDS: Record<string, string[]> = {
  predjed: ['predjed', 'antipasti', 'starter', 'bruschetta', 'tartar', 'carpaccio', 'pršut', 'narezki'],
  juha: ['juha', 'supa', 'minestra', 'kremna', 'goveja'],
  medkrožnik: ['medkrožnik', 'sorbet', 'palčka'],
  glavna: ['steak', 'file', 'rižota', 'rižoto', 'testenine', 'paste', 'pizza', 'ribe', 'losos', 'tuna', 'puran', 'piščanec', 'svinjina', 'teletina', 'govedina', 'mongolski', 'burger', 'želodec', 'ocvrti', 'pečeno', 'žara', 'foliji', 'mošnjički', 'njoke', 'štruklji'],
  sir: ['sir', 'sirna', 'pladanj'],
  sladica: ['sladica', 'torta', 'tiramisu', 'panna', 'cotta', 'čokolada', 'cheesecake', 'palačinke', 'sladoled', 'kremšnita', 'gibanica', 'štrudelj', 'macaron', 'praline', 'fruit'],
  kava: ['kava', 'cappuccino', 'espresso', 'latte', 'čaj', 'matcha'],
}

function classifyItem(itemName: string): string {
  const lower = itemName.toLowerCase()
  for (const [courseId, keywords] of Object.entries(COURSE_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      return courseId
    }
  }
  return 'glavna' // Privzeto: glavna jed
}

// ─── Status barve ────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string; icon: React.ReactNode }> = {
  waiting: { color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-800', label: 'Čaka', icon: <Clock className="h-4 w-4" /> },
  firing: { color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20', label: 'FIRE!', icon: <Flame className="h-4 w-4 animate-pulse" /> },
  preparing: { color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20', label: 'V pripravi', icon: <Zap className="h-4 w-4" /> },
  ready: { color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-900/20', label: 'Pripravljeno', icon: <CheckCircle2 className="h-4 w-4" /> },
  served: { color: 'text-gray-400', bg: 'bg-gray-50 dark:bg-gray-900/30', label: 'Postreženo', icon: <CheckCircle2 className="h-4 w-4" /> },
}

// ─── Glavna komponenta ──────────────────────────────────────────
export function CoursePacing() {
  const queryClient = useQueryClient()
  const [soundEnabled, setSoundEnabled] = useState(true)

  const { data, isLoading } = useQuery({
    queryKey: ['kitchen-pacing'],
    queryFn: async () => {
      const res = await authFetch('/api/kitchen')
      if (!res.ok) throw new Error('Failed')
      const kdsData = await res.json()

      // Pretvori KDS podatke v paced orders
      const pacedOrders: PacedOrder[] = kdsData.orders.map((order: any) => {
        // Razvrsti artikle v jedi
        const courseMap: Record<string, CourseItem[]> = {}

        order.orderItems.forEach((item: any) => {
          const courseId = classifyItem(item.menuItem.name)
          if (!courseMap[courseId]) courseMap[courseId] = []

          const modifiers = (() => {
            try { return JSON.parse(item.modifiersJson || '[]') } catch { return [] }
          })()

          courseMap[courseId].push({
            id: item.id,
            name: item.menuItem.name,
            quantity: item.quantity,
            modifiers: modifiers.map((m: any) => m.name),
            notes: item.notes || '',
            status: item.status === 'preparing' ? 'preparing' : item.status === 'ready' ? 'ready' : item.status === 'served' ? 'served' : 'pending',
            prepStation: item.menuItem.category?.menu?.name === 'Pijača' ? 'sank' : 'kuhinja',
          })
        })

        // Ustvari course groups
        const courses: CourseGroup[] = DEFAULT_COURSE_ORDER
          .filter(c => courseMap[c.id])
          .map((c, idx) => ({
            id: c.id,
            name: c.name,
            sortOrder: c.sortOrder,
            items: courseMap[c.id] || [],
            status: (courseMap[c.id] || []).every(i => i.status === 'served')
              ? 'served'
              : (courseMap[c.id] || []).every(i => i.status === 'ready')
                ? 'ready'
                : (courseMap[c.id] || []).some(i => i.status === 'preparing')
                  ? 'preparing'
                  : (courseMap[c.id] || []).some(i => i.status === 'pending') && idx === 0
                    ? 'firing'
                    : 'waiting',
          }))

        // Določi trenutni course
        const currentCourseIndex = courses.findIndex(c => c.status !== 'served')

        return {
          id: order.id,
          orderNumber: order.orderNumber,
          tableNumber: order.table?.number || null,
          tableName: order.table?.area || null,
          customerName: order.customerName || '',
          orderType: order.type,
          createdAt: order.createdAt,
          courses,
          currentCourseIndex,
          pacing: 'manual' as const,
          avgGapMinutes: 12,
        }
      })

      return { pacedOrders }
    },
    refetchInterval: 5000,
  })

  const pacedOrders = data?.pacedOrders || []

  // Fire next course mutation
  const fireCourseMutation = useMutation({
    mutationFn: async ({ orderId, courseIndex }: { orderId: string; courseIndex: number }) => {
      // Označi vse artikle v course-u kot "preparing"
      const order = pacedOrders.find(o => o.id === orderId)
      if (!order) throw new Error('Order not found')

      const course = order.courses[courseIndex]
      const results = await Promise.all(
        course.items.map(async (item) => {
          const res = await authFetch(`/api/order-items/${item.id}`, {
            method: 'PUT',
            body: JSON.stringify({ status: 'preparing' }),
          })
          return res.ok
        })
      )
      return results
    },
    onSuccess: (_, variables) => {
      toast.success(`FIRE! ${pacedOrders.find(o => o.id === variables.orderId)?.courses[variables.courseIndex]?.name || 'Jed'} — začni pripravo!`, {
        duration: 3000,
      })
      queryClient.invalidateQueries({ queryKey: ['kitchen-pacing'] })
      queryClient.invalidateQueries({ queryKey: ['kitchen'] })
    },
  })

  // Mark course ready
  const readyCourseMutation = useMutation({
    mutationFn: async ({ orderId, courseIndex }: { orderId: string; courseIndex: number }) => {
      const order = pacedOrders.find(o => o.id === orderId)
      if (!order) throw new Error('Order not found')

      const course = order.courses[courseIndex]
      const results = await Promise.all(
        course.items.map(async (item) => {
          const res = await authFetch(`/api/order-items/${item.id}`, {
            method: 'PUT',
            body: JSON.stringify({ status: 'ready' }),
          })
          return res.ok
        })
      )
      return results
    },
    onSuccess: (_, variables) => {
      toast.success(`${pacedOrders.find(o => o.id === variables.orderId)?.courses[variables.courseIndex]?.name || 'Jed'} pripravljena!`, {
        duration: 2000,
      })
      queryClient.invalidateQueries({ queryKey: ['kitchen-pacing'] })
      queryClient.invalidateQueries({ queryKey: ['kitchen'] })
    },
  })

  if (isLoading) {
    return (
      <div className="h-full p-4 space-y-3">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-40" />)}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card flex-shrink-0">
        <div className="flex items-center gap-3">
          <Layers className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">Tempo jedi</h1>
          <Badge variant="outline" className="text-xs">{pacedOrders.length} naročil</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs gap-1">
            <Flame className="h-3 w-3 text-orange-500" />
            Fire Next Course
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {pacedOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
            <ChefHat className="h-16 w-16 opacity-20" />
            <div className="text-center">
              <p className="text-lg font-medium">Ni aktivnih naročil s tempom jedi</p>
              <p className="text-sm">Naročila z več jedmi se bodo prikazala tukaj</p>
            </div>
          </div>
        ) : (
          pacedOrders.map(order => (
            <Card key={order.id} className="overflow-hidden">
              {/* Order header */}
              <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-lg">#{order.orderNumber}</span>
                  {order.tableNumber && (
                    <Badge variant="secondary" className="text-xs">
                      🪑 Miza {order.tableNumber}
                    </Badge>
                  )}
                  {order.customerName && (
                    <span className="text-sm text-muted-foreground">👤 {order.customerName}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(order.createdAt), 'HH:mm')}
                  </span>
                  <Badge variant="outline" className="text-[9px]">
                    {order.courses.filter(c => c.status === 'served').length}/{order.courses.length} jedi
                  </Badge>
                </div>
              </div>

              {/* Course progress bar */}
              <div className="flex h-2">
                {order.courses.map((course, idx) => (
                  <div
                    key={course.id}
                    className={`flex-1 transition-colors ${
                      course.status === 'served' ? 'bg-gray-400' :
                      course.status === 'ready' ? 'bg-emerald-500' :
                      course.status === 'preparing' || course.status === 'firing' ? 'bg-orange-500' :
                      'bg-gray-200 dark:bg-gray-700'
                    } ${idx > 0 ? 'ml-0.5' : ''}`}
                  />
                ))}
              </div>

              {/* Course cards */}
              <CardContent className="p-3 space-y-2">
                {order.courses.map((course, courseIdx) => {
                  const config = STATUS_CONFIG[course.status]
                  const isCurrentCourse = courseIdx === order.currentCourseIndex
                  const canFire = course.status === 'waiting' && (
                    courseIdx === 0 || order.courses[courseIdx - 1]?.status === 'served' || order.courses[courseIdx - 1]?.status === 'ready'
                  )
                  const canMarkReady = course.status === 'firing' || course.status === 'preparing'

                  return (
                    <div
                      key={course.id}
                      className={`rounded-lg border-2 p-3 transition-all ${
                        isCurrentCourse
                          ? 'border-primary shadow-sm'
                          : 'border-transparent'
                      } ${config.bg}`}
                    >
                      {/* Course header */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={config.color}>{config.icon}</span>
                          <span className="font-semibold text-sm">{course.name}</span>
                          <Badge variant="outline" className="text-[9px] h-4">
                            {course.items.length} {course.items.length === 1 ? 'artikel' : 'artiklov'}
                          </Badge>
                          {course.status === 'firing' && (
                            <Badge className="bg-orange-500 text-white text-[10px] h-5 animate-pulse">
                              🔥 FIRE!
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs font-medium ${config.color}`}>
                            {config.label}
                          </span>
                          {/* Action buttons */}
                          {canFire && (
                            <Button
                              size="sm"
                              className="h-8 text-xs bg-orange-600 hover:bg-orange-700 gap-1"
                              onClick={() => fireCourseMutation.mutate({ orderId: order.id, courseIndex: courseIdx })}
                            >
                              <Flame className="h-3.5 w-3.5" />
                              FIRE
                            </Button>
                          )}
                          {canMarkReady && (
                            <Button
                              size="sm"
                              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 gap-1"
                              onClick={() => readyCourseMutation.mutate({ orderId: order.id, courseIndex: courseIdx })}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Pripravljeno
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Items */}
                      <div className="space-y-1 ml-6">
                        {course.items.map(item => (
                          <div key={item.id} className="flex items-center gap-2 text-sm">
                            <span className="font-bold">{item.quantity}x</span>
                            <span className={item.status === 'served' ? 'line-through text-muted-foreground' : ''}>
                              {item.name}
                            </span>
                            {item.modifiers.length > 0 && (
                              <div className="flex gap-0.5">
                                {item.modifiers.map((m, i) => (
                                  <Badge key={i} variant="outline" className="text-[9px] h-4 px-1">
                                    {m}
                                  </Badge>
                                ))}
                              </div>
                            )}
                            {item.notes && (
                              <span className="text-[10px] text-amber-600 italic">📝 {item.notes}</span>
                            )}
                            <span className={`ml-auto text-[10px] ${
                              item.status === 'served' ? 'text-gray-400' :
                              item.status === 'ready' ? 'text-emerald-500' :
                              item.status === 'preparing' ? 'text-blue-500' :
                              'text-yellow-500'
                            }`}>
                              {item.status === 'served' ? '✓' : item.status === 'ready' ? '✓' : item.status === 'preparing' ? '⏳' : '○'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
