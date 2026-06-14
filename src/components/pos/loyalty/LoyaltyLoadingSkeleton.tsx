'use client'

import { memo } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

// --- Komponenta ---

export const LoyaltyLoadingSkeleton = memo(function LoyaltyLoadingSkeleton() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={`sum-${i}`} className="h-20" />
        ))}
      </div>
      <Skeleton className="h-14" />
      <Skeleton className="h-96" />
    </div>
  )
})
