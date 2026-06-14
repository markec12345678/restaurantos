'use client'

import { memo } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

// --- Komponenta za nalagalni skeleton ---

export const GiftCardLoadingSkeleton = memo(function GiftCardLoadingSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Darilne kartice</h2>
          <p className="text-muted-foreground">Nalaganje...</p>
        </div>
      </div>
      <div className="space-y-3">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={`sum-${i}`} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-16" />
        <Skeleton className="h-64" />
      </div>
    </div>
  )
})
