'use client'

import { useQuery } from '@tanstack/react-query'
import { authFetch } from '@/components/pos/PinLogin'
import type { OrderRow, OrderItemRow, ModifierRow } from '@/lib/types'
import { queryKeys } from '@/lib/query-keys'
import { useState } from 'react'
import {
  DEFAULT_COURSE_ORDER,
  classifyItem,
} from './constants'
import type { PacedOrder, CourseGroup, CourseItem } from './constants'
import { useCoursePacingMutations } from './useCoursePacingMutations'

export function useCoursePacing() {
  const [_soundEnabled, _setSoundEnabled] = useState(true)

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.kitchen.pacing,
    queryFn: async () => {
      const res = await authFetch('/api/kitchen')
      if (!res.ok) throw new Error('Failed')
      const kdsData = await res.json()

      const pacedOrders: PacedOrder[] = (kdsData?.orders || []).map((order: OrderRow) => {
        const courseMap: Record<string, CourseItem[]> = {}

        // FIX TypeError: order.orderItems je lahko undefined — Array.isArray guard
        const orderItems = Array.isArray(order?.orderItems) ? order.orderItems : []
        orderItems.forEach((item: OrderItemRow) => {
          const menuItem = item.menuItem as { name: string; category?: { menu?: { name: string } } } | undefined
          const courseId = classifyItem(menuItem?.name || '')
          if (!courseMap[courseId]) courseMap[courseId] = []
          const modifiers = (() => {
            try {
              const parsed = JSON.parse((item.modifiersJson as string) || '[]')
              return Array.isArray(parsed) ? parsed : []
            } catch { return [] }
          })()
          courseMap[courseId].push({
            id: item.id, name: menuItem?.name || '', quantity: item.quantity,
            modifiers: modifiers.map((m: ModifierRow) => m.name),
            notes: item.notes || '',
            status: item.status === 'preparing' ? 'preparing' : item.status === 'ready' ? 'ready' : item.status === 'served' ? 'served' : 'pending',
            prepStation: menuItem?.category?.menu?.name === 'Pijača' ? 'sank' : 'kuhinja',
          })
        })

        const courses: CourseGroup[] = DEFAULT_COURSE_ORDER
          .filter(c => courseMap[c.id])
          .map((c, idx) => ({
            id: c.id, name: c.name, sortOrder: c.sortOrder,
            items: courseMap[c.id] || [],
            status: (courseMap[c.id] || []).every(i => i.status === 'served') ? 'served'
              : (courseMap[c.id] || []).every(i => i.status === 'ready') ? 'ready'
              : (courseMap[c.id] || []).some(i => i.status === 'preparing') ? 'preparing'
              : (courseMap[c.id] || []).some(i => i.status === 'pending') && idx === 0 ? 'firing' : 'waiting',
          }))

        const currentCourseIndex = courses.findIndex(c => c.status !== 'served')
        const orderTable = order.table as { number?: number; area?: string } | undefined
        return {
          id: order.id, orderNumber: order.orderNumber,
          tableNumber: orderTable?.number || null, tableName: orderTable?.area || null,
          customerName: (order.customerName as string) || '', orderType: order.type,
          // FIX RangeError: Invalid time value — order.createdAt je obvezno polje
          // PacedOrder interface, ampak prej ni bilo nastavljeno v return-u!
          createdAt: (order.createdAt as string) || new Date().toISOString(),
          courses, currentCourseIndex, pacing: 'manual' as const, avgGapMinutes: 12,
        }
      })

      return { pacedOrders }
    },
    refetchInterval: 5000,
  })

  const pacedOrders = data?.pacedOrders || []
  const { handleFireCourse, handleReadyCourse } = useCoursePacingMutations(pacedOrders)

  return { pacedOrders, isLoading, handleFireCourse, handleReadyCourse }
}
