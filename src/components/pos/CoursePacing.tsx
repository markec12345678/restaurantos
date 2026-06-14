'use client'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Multi-Course Kitchen Pacing
// "Fire Next Course" — profesionalna kuhinja s tempo jedi
// Toast POS + Michelin standard za uravnavanje hittinga jedi
// ═══════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import type { OrderRow, OrderItemRow, ModifierRow } from '@/lib/types'
import { queryKeys } from '@/lib/query-keys'
import { useState, memo } from 'react'
import dynamic from 'next/dynamic'
import {
  DEFAULT_COURSE_ORDER,
  classifyItem,
} from './course-pacing/constants'
import type { PacedOrder, CourseGroup, CourseItem } from './course-pacing/constants'

// Lazy-loaded podkomponente
const PacingHeader = dynamic(() => import('./course-pacing/PacingHeader').then(m => ({ default: m.PacingHeader })), { ssr: false })
const PacingEmptyState = dynamic(() => import('./course-pacing/PacingEmptyState').then(m => ({ default: m.PacingEmptyState })), { ssr: false })
const PacedOrderCard = dynamic(() => import('./course-pacing/PacedOrderCard').then(m => ({ default: m.PacedOrderCard })), { ssr: false })

// ─── Glavna komponenta ──────────────────────────────────────────
export const CoursePacing = memo(function CoursePacing() {
  const queryClient = useQueryClient()
  const [_soundEnabled, _setSoundEnabled] = useState(true)

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.kitchen.pacing,
    queryFn: async () => {
      const res = await authFetch('/api/kitchen')
      if (!res.ok) throw new Error('Failed')
      const kdsData = await res.json()

      // Pretvori KDS podatke v paced orders
      const pacedOrders: PacedOrder[] = kdsData.orders.map((order: OrderRow) => {
        // Razvrsti artikle v jedi
        const courseMap: Record<string, CourseItem[]> = {}

        ;(order.orderItems || []).forEach((item: OrderItemRow) => {
          const menuItem = item.menuItem as { name: string; category?: { menu?: { name: string } } } | undefined
          const courseId = classifyItem(menuItem?.name || '')
          if (!courseMap[courseId]) courseMap[courseId] = []

          const modifiers = (() => {
            try { return JSON.parse((item.modifiersJson as string) || '[]') } catch { return [] }
          })()

          courseMap[courseId].push({
            id: item.id,
            name: menuItem?.name || '',
            quantity: item.quantity,
            modifiers: modifiers.map((m: ModifierRow) => m.name),
            notes: item.notes || '',
            status: item.status === 'preparing' ? 'preparing' : item.status === 'ready' ? 'ready' : item.status === 'served' ? 'served' : 'pending',
            prepStation: menuItem?.category?.menu?.name === 'Pijača' ? 'sank' : 'kuhinja',
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

        const orderTable = order.table as { number?: number; area?: string } | undefined
        return {
          id: order.id,
          orderNumber: order.orderNumber,
          tableNumber: orderTable?.number || null,
          tableName: orderTable?.area || null,
          customerName: (order.customerName as string) || '',
          orderType: order.type,
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
      queryClient.invalidateQueries({ queryKey: queryKeys.kitchen.pacing })
      queryClient.invalidateQueries({ queryKey: queryKeys.kitchen.all })
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
      queryClient.invalidateQueries({ queryKey: queryKeys.kitchen.pacing })
      queryClient.invalidateQueries({ queryKey: queryKeys.kitchen.all })
    },
  })

  const handleFireCourse = (orderId: string, courseIndex: number) => {
    fireCourseMutation.mutate({ orderId, courseIndex })
  }

  const handleReadyCourse = (orderId: string, courseIndex: number) => {
    readyCourseMutation.mutate({ orderId, courseIndex })
  }

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
      <PacingHeader orderCount={pacedOrders.length} />

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {pacedOrders.length === 0 ? (
          <PacingEmptyState />
        ) : (
          pacedOrders.map(order => (
            <PacedOrderCard
              key={order.id}
              order={order}
              onFireCourse={handleFireCourse}
              onReadyCourse={handleReadyCourse}
            />
          ))
        )}
      </div>
    </div>
  )
})
