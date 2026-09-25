'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { authFetch } from '@/components/pos/PinLogin'
import { queryKeys } from '@/lib/query-keys'
import type { CourseAction } from './constants'

// ============================================
// KURSNE AKCIJE (kanon R134) — realne Course akcije
// ============================================
// a/d/e) PUT /api/courses/[courseId]  body { action: fire|hold|unhold|ready|served }
// b/c)   POST /api/orders/[orderId]/courses/fire  body { mode: 'next'|'all' }
// Invalidacije po VSAKI mutaciji: kitchen.pacing + kitchen.all + KDS ključi
// (orders.kds + kdsMetrics) — FOH in KDS morata videti isto stanje.
// Idempotentni replay je strežniški kanon (fire na 'fired' → 200 NO-OP).
// ============================================

export function useCoursePacingMutations() {
  const queryClient = useQueryClient()

  const invalidateAfterAction = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.kitchen.pacing })
    queryClient.invalidateQueries({ queryKey: queryKeys.kitchen.all })
    queryClient.invalidateQueries({ queryKey: queryKeys.orders.kds })
    queryClient.invalidateQueries({ queryKey: queryKeys.orders.kdsMetrics })
  }

  /** Course-level akcija: fire / hold / unhold / ready / served */
  const courseActionMutation = useMutation({
    mutationFn: async ({ courseId, action }: { courseId: string; action: CourseAction }) => {
      const res = await authFetch(`/api/courses/${courseId}`, {
        method: 'PUT',
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error(`Napaka ${res.status}`)
      return res.json().catch(() => null)
    },
    onSuccess: (_data, variables) => {
      const messages: Record<CourseAction, string> = {
        fire: 'Tok požgan — začni pripravo!',
        hold: 'Tok zadržan (hold).',
        unhold: 'Tok sproščen — spet v vrsti.',
        ready: 'Tok je pripravljen.',
        served: 'Tok postrežen.',
      }
      toast.success(messages[variables.action], { duration: 2500 })
      invalidateAfterAction()
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Neznana napaka'
      toast.error(`Napaka pri akciji toka: ${message}`)
    },
  })

  /** Order-level fire: next (najnižji pending) ali all (vsi pending, held preskočeni) */
  const orderFireMutation = useMutation({
    mutationFn: async ({ orderId, mode }: { orderId: string; mode: 'next' | 'all' }) => {
      const res = await authFetch(`/api/orders/${orderId}/courses/fire`, {
        method: 'POST',
        body: JSON.stringify({ mode }),
      })
      if (!res.ok) throw new Error(`Napaka ${res.status}`)
      return res.json().catch(() => null)
    },
    onSuccess: (data, variables) => {
      // Strežniški kanon: NO-OP (brez kandidatov) je uspeh — 200 { firedCourseId(s): null/[] }
      if (variables.mode === 'next') {
        const fired = data && typeof data === 'object' && 'firedCourseId' in data
          ? (data as { firedCourseId: unknown }).firedCourseId
          : undefined
        toast.success(fired ? 'Naslednji tok požgan!' : 'Ni čakajočih tokov (nič požganega).', { duration: 2500 })
      } else {
        const firedCount = data && typeof data === 'object' && 'firedCourseIds' in data && Array.isArray((data as { firedCourseIds: unknown }).firedCourseIds)
          ? (data as { firedCourseIds: unknown[] }).firedCourseIds.length
          : null
        toast.success(firedCount ? `Požganih ${firedCount} ${firedCount === 1 ? 'tok' : 'tokov'}.` : 'Ni čakajočih tokov (nič požganega).', { duration: 2500 })
      }
      invalidateAfterAction()
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Neznana napaka'
      toast.error(`Napaka pri požiganju tokov: ${message}`)
    },
  })

  return {
    courseActionMutation,
    orderFireMutation,
  }
}
