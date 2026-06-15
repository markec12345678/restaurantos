'use client'

// ═══════════════════════════════════════════════════════════════
// RestaurantOS — Multi-Course Kitchen Pacing
// "Fire Next Course" — profesionalna kuhinja s tempo jedi
// Toast POS + Michelin standard za uravnavanje hittinga jedi
// ═══════════════════════════════════════════════════════════════

import { Skeleton } from '@/components/ui/skeleton'
import { memo } from 'react'
import dynamic from 'next/dynamic'
import { useCoursePacing } from './course-pacing/useCoursePacing'

// Lazy-loaded podkomponente
const PacingHeader = dynamic(() => import('./course-pacing/PacingHeader').then(m => ({ default: m.PacingHeader })), { ssr: false })
const PacingEmptyState = dynamic(() => import('./course-pacing/PacingEmptyState').then(m => ({ default: m.PacingEmptyState })), { ssr: false })
const PacedOrderCard = dynamic(() => import('./course-pacing/PacedOrderCard').then(m => ({ default: m.PacedOrderCard })), { ssr: false })

// ─── Glavna komponenta ──────────────────────────────────────────
export const CoursePacing = memo(function CoursePacing() {
  const { pacedOrders, isLoading, handleFireCourse, handleReadyCourse } = useCoursePacing()

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
