'use client'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Course Pacing (R134, epic #115 P1-10)
// REALNI Course podatki iz /api/kitchen (flattened course polja).
// Akcije prek PUT /api/courses/[id] + POST /api/orders/[id]/courses/fire.
// Prejšnja heuristika po imenu artikla (classifyItem) je IZBRISANA.
// ═══════════════════════════════════════════════════════════════

import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { memo } from 'react'
import dynamic from 'next/dynamic'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { useCoursePacing } from './course-pacing/useCoursePacing'
import { useCoursePacingMutations } from './course-pacing/useCoursePacingMutations'

// Lazy-loaded podkomponente
const PacingHeader = dynamic(() => import('./course-pacing/PacingHeader').then(m => ({ default: m.PacingHeader })), { ssr: false })
const PacingEmptyState = dynamic(() => import('./course-pacing/PacingEmptyState').then(m => ({ default: m.PacingEmptyState })), { ssr: false })
const PacedOrderCard = dynamic(() => import('./course-pacing/PacedOrderCard').then(m => ({ default: m.PacedOrderCard })), { ssr: false })

// ─── Glavna komponenta ──────────────────────────────────────────
export const CoursePacing = memo(function CoursePacing() {
  const { pacedOrders, isLoading, isError, refetch } = useCoursePacing()
  const { courseActionMutation, orderFireMutation } = useCoursePacingMutations()

  if (isLoading) {
    return (
      <div className="h-full p-4 space-y-3" aria-busy="true">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-40" />)}
      </div>
    )
  }

  // Napaka (404/500/omrežje) — role="alert" + retry, nikoli tiša praznina
  if (isError) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md" role="alert">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Napaka pri nalaganju tokov</AlertTitle>
          <AlertDescription>
            Stanja tokov ni bilo mogoče naložiti. Preveri povezavo in poskusi znova.
          </AlertDescription>
          <Button
            variant="outline"
            size="sm"
            className="mt-2 gap-1.5 pointer-coarse:h-11"
            onClick={() => refetch()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Znova poskusi
          </Button>
        </Alert>
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
              onFireNext={(orderId) => orderFireMutation.mutate({ orderId, mode: 'next' })}
              onFireAll={(orderId) => orderFireMutation.mutate({ orderId, mode: 'all' })}
              onCourseAction={(courseId, action) => courseActionMutation.mutate({ courseId, action })}
              busyCourseId={courseActionMutation.isPending ? courseActionMutation.variables?.courseId ?? null : null}
              busyOrderFire={orderFireMutation.isPending}
            />
          ))
        )}
      </div>
    </div>
  )
})
