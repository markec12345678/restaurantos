'use client'

// ============================================
// NALOŽNO OKVIRJE — SKELETON
// ============================================

import { memo } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

export const FeedbackLoadingSkeleton = memo(function FeedbackLoadingSkeleton() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
      </div>
      <Skeleton className="h-64" />
    </div>
  )
})
