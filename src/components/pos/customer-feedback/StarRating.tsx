'use client'

// ============================================
// ZVEZDICE ZA OCENO
// ============================================

import { memo } from 'react'
import { Star } from 'lucide-react'

export const StarRating = memo(function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const sz = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <Star
          key={n}
          className={`${sz} ${n <= rating ? 'text-amber-400 fill-amber-400' : 'text-gray-500'}`}
        />
      ))}
    </div>
  )
})
