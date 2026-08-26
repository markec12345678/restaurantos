'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import type { PacedOrder } from './constants'

export function useCoursePacingMutations(pacedOrders: PacedOrder[]) {
  const queryClient = useQueryClient()

  const fireCourseMutation = useMutation({
    mutationFn: async ({ orderId, courseIndex }: { orderId: string; courseIndex: number }) => {
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
      toast.success(`FIRE! ${pacedOrders.find(o => o.id === variables.orderId)?.courses[variables.courseIndex]?.name || 'Jed'} — začni pripravo!`, { duration: 3000 })
      queryClient.invalidateQueries({ queryKey: queryKeys.kitchen.pacing })
      queryClient.invalidateQueries({ queryKey: queryKeys.kitchen.all })
    },
  })

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
      toast.success(`${pacedOrders.find(o => o.id === variables.orderId)?.courses[variables.courseIndex]?.name || 'Jed'} pripravljena!`, { duration: 2000 })
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

  return { handleFireCourse, handleReadyCourse }
}
