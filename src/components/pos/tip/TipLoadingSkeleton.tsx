'use client'

import { memo } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

export const TipLoadingSkeleton = memo(function TipLoadingSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-48" />
    </div>
  )
})
