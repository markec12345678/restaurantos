'use client'

import { memo } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

export const HaccpLoadingSkeleton = memo(function HaccpLoadingSkeleton() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={`sum-${i}`} className="h-20" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={`card-${i}`} className="h-44" />
        ))}
      </div>
    </div>
  )
})
