'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import type { OrderRow, OrderItemRow, ModifierRow } from '@/lib/types'
import { queryKeys } from '@/lib/query-keys'
import { useState } from 'react'
import {
  DEFAULT_COURSE_ORDER,
  classifyItem,
} from './constants'
import type { PacedOrder, CourseGroup, CourseItem } from './constants'

export function useCoursePacing() {
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

  return {
    pacedOrders,
    isLoading,
    handleFireCourse,
    handleReadyCourse,
  }
}
